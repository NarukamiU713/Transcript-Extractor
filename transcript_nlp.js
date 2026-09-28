/* Local, lossless German transcript paragraph formatting.
 * TextTiling-inspired lexical cohesion, not a full reproduction of Hearst (1997):
 * https://aclanthology.org/J97-1003/
 * Sentence windows + TF-IDF + valley depth + length-constrained dynamic programming.
 * No network requests, language model, or changes to the original words/punctuation.
 */
(function (root) {
  'use strict';
  const STOP = new Set(('aber als am an auch auf aus bei bin bis bist da das dass dein dem den der des die dies diese diesen dieser dieses doch dort du durch ein eine einem einen einer eines er es etwas für gegen hat haben hatte hier ich ihr ihre im in ist ja kann kein keine man mehr mein mit muss nach nicht noch nun nur ob oder ohne sehr sein seine selbst sich sie sind so über um und uns unter vom von vor war waren was wenn wer werden wie wieder wir wird wo zu zum zur').split(' '));
  const ABBREVIATION = /\b(?:Dr|Prof|Dipl|Ing|Nr|Abb|Abs|Art|Bd|bzw|ca|ggf|inkl|usw|vgl|z\.\s*B|d\.\s*h|u\.\s*a)\.$/i;
  const MONTH = /^(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b/i;
  const CLOSERS = /["'»“”’\])]+$/u;
  const normalize = value => String(value || '').replace(/\s+/gu, ' ').trim();
  const originalText = data => (data.items || []).map(item => normalize(item.german)).filter(Boolean).join(' ');
  const words = text => text.match(/[\p{L}\p{N}]+/gu) || [];

  function mustJoin(left, right) {
    const bare = left.replace(CLOSERS, '');
    return ABBREVIATION.test(bare)
      || (/\bz\.$/i.test(bare) && /^B\./.test(right))
      || (/\bd\.$/i.test(bare) && /^h\./i.test(right))
      || (/\bu\.$/i.test(bare) && /^(?:a|U)\./i.test(right))
      || /\b[A-ZÄÖÜ]\.$/u.test(bare)
      || (/\d\.$/.test(bare) && MONTH.test(right))
      || /^[\p{Ll}]/u.test(right)
      || /[,;:]/.test(right[0] || '');
  }

  function sentences(text) {
    text = normalize(text);
    if (!text) return [];
    let chunks;
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      chunks = Array.from(new Intl.Segmenter('de', {granularity: 'sentence'}).segment(text), x => x.segment.trim());
    } else {
      // Conservative fallback: only sentence punctuation followed by whitespace.
      // Decimal numbers/URLs stay intact; abbreviation fragments are repaired below.
      chunks = text.match(/.+?(?:[.!?…]+["'»“”’\])]*(?=\s+|$)|$)/gu) || [text];
    }
    const result = [];
    for (const part of chunks) {
      const chunk = part.trim();
      if (!chunk) continue;
      if (result.length && mustJoin(result[result.length - 1], chunk)) {
        result[result.length - 1] += ' ' + chunk;
      } else result.push(chunk);
    }
    return result;
  }

  function terms(text) {
    return words(text.toLocaleLowerCase('de')).filter(w => w.length > 2 && !STOP.has(w) && /\p{L}/u.test(w))
      .map(w => w.replace(/ß/g, 'ss').normalize('NFD').replace(/\p{M}/gu, ''))
      // Deliberately light inflection normalization, NOT a full German lemmatizer.
      .map(w => w.length > 6 ? w.replace(/(?:ern|en|er|es|em|e|n|s)$/, '') : w);
  }

  function cohesion(units) {
    const tokens = units.map(terms);
    const frequency = new Map();
    for (const sentence of tokens) {
      for (const term of new Set(sentence)) frequency.set(term, (frequency.get(term) || 0) + 1);
    }
    function vector(start, end) {
      const counts = new Map();
      for (let i = start; i < end; i++) for (const term of tokens[i]) counts.set(term, (counts.get(term) || 0) + 1);
      let norm = 0;
      for (const [term, count] of counts) {
        const value = (1 + Math.log(count)) * (1 + Math.log((units.length + 1) / (frequency.get(term) + 1)));
        counts.set(term, value); norm += value * value;
      }
      return {counts, norm: Math.sqrt(norm)};
    }
    const raw = [];
    for (let i = 1; i < units.length; i++) {
      const left = vector(Math.max(0, i - 3), i), right = vector(i, Math.min(units.length, i + 3));
      let dot = 0;
      for (const [term, value] of left.counts) dot += value * (right.counts.get(term) || 0);
      raw.push(left.norm && right.norm ? dot / (left.norm * right.norm) : 0);
    }
    const smooth = raw.map((value, i) => ((raw[i - 1] ?? value) + 2 * value + (raw[i + 1] ?? value)) / 4);
    const depth = smooth.map((value, i) => {
      // Compare the valley with nearby peaks, not with an absolute low similarity:
      // unrelated one-off vocabulary alone is not evidence for many tiny paragraphs.
      const left = Math.max(...smooth.slice(Math.max(0, i - 3), i + 1));
      const right = Math.max(...smooth.slice(i, i + 4));
      return Math.max(0, left + right - 2 * value);
    });
    const mean = depth.reduce((sum, v) => sum + v, 0) / (depth.length || 1);
    const std = Math.sqrt(depth.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (depth.length || 1));
    return depth.map((v, i) => ({
      similarity: raw[i], depth: v,
      score: v >= Math.max(0.10, mean + 0.3 * std) && v >= (depth[i - 1] || 0) && v >= (depth[i + 1] || 0)
        ? Math.min(1, v / 0.6) : 0,
    }));
  }

  function analyze(data) {
    const text = originalText(data), units = sentences(text);
    if (!units.length) return {paragraphs: [], sentences: [], boundaries: [], cuts: []};
    const boundaries = cohesion(units);
    for (let i = 0; i < boundaries.length; i++) {
      // A weak signal only. It cannot force each "aber"/"und" into a new paragraph.
      if (/^(?:Kommen wir (?:nun )?zu|Ein anderes Thema|Inzwischen|Zum Schluss|Abschließend|Zusammenfassend|Nun (?:zum|zur))\b/i.test(units[i + 1])) {
        boundaries[i].score = Math.min(1, boundaries[i].score + 0.45);
      }
    }
    const prefix = [0];
    for (const unit of units) prefix.push(prefix[prefix.length - 1] + words(unit).length);
    const costs = new Array(units.length + 1).fill(Infinity), previous = new Array(units.length + 1).fill(0);
    costs[0] = 0;
    for (let end = 1; end <= units.length; end++) {
      for (let start = end - 1; start >= Math.max(0, end - 24); start--) {
        const count = end - start, size = prefix[end] - prefix[start];
        if (size > 260 && count > 1) break;
        // Soft preferred paragraph length, not a fixed sentence count.
        // Permit a long unsplittable sentence; penalize isolated short sentences.
        const lengthPenalty = ((size - 95) / 95) ** 2;
        const singletonPenalty = count === 1 && size < 60 && units.length > 1 ? 2.5 : 0;
        const boundaryReward = end < units.length ? 2.8 * boundaries[end - 1].score : 0;
        const cost = costs[start] + 0.65 + lengthPenalty + singletonPenalty - boundaryReward;
        if (cost < costs[end]) { costs[end] = cost; previous[end] = start; }
      }
    }
    const blocks = [], cuts = [];
    for (let end = units.length; end > 0;) {
      const start = previous[end];
      blocks.push(units.slice(start, end).join(' '));
      if (start) cuts.push(start);
      end = start;
    }
    blocks.reverse(); cuts.reverse();
    // Fail closed to the unmodified text if a browser segmenter/fallback ever loses
    // punctuation, words or ordering. Whitespace is the only permitted difference.
    if (normalize(blocks.join(' ')) !== text) return {paragraphs: [text], sentences: units, boundaries, cuts: []};
    return {paragraphs: blocks, sentences: units, boundaries, cuts};
  }
  const api = {analyze, paragraphs: data => analyze(data).paragraphs, sentences, originalText};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TranscriptNLP = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

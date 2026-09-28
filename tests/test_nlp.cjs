const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const nlp = require('../transcript_nlp.js');
const sample = text => ({items: [{german: text}]});
const rail = [
  'Der Bahnhof wird für die neue Bahnstrecke gebaut.',
  'Die Bahnstrecke verbindet den Bahnhof mit Berlin.',
  'Züge fahren vom Bahnhof nach Berlin.',
  'Die Bahn plant weitere Züge für die Bahnstrecke.',
  'Die Züge halten am neuen Bahnhof an der Bahnstrecke.',
];
const health = [
  'Im Krankenhaus behandeln Ärzte neue Patienten.',
  'Das Krankenhaus stellt zusätzliche Ärzte ein.',
  'Die Patienten bekommen im Krankenhaus neue Medikamente.',
  'Die Ärzte untersuchen die Wirkung der Medikamente.',
  'Patienten im Krankenhaus werden von den Ärzten behandelt.',
];
for (const count of [3, 4, 5]) {
  const analysis = nlp.analyze(sample([...rail.slice(0, count), ...health].join(' ')));
  assert.deepEqual(analysis.cuts, [count], 'Topic boundary must follow the content, not a fixed sentence count.');
}
// A single short topic should remain together, not be split by sentence count.
for (const topic of [rail, health]) {
  assert.equal(nlp.paragraphs(sample(topic.join(' '))).length, 1);
}
const unsplittable = Array(300).fill('Bahnhof').join(' ');
assert.deepEqual(nlp.paragraphs(sample(unsplittable)), [unsplittable]);
const abbreviationText = 'Dr. Müller kommt am 3. Oktober. Er zahlt 3.50 Euro, z. B. für Brot. Er sagt: „Das ist gut.“ Danach geht er.';
assert.deepEqual(nlp.sentences(abbreviationText), [
  'Dr. Müller kommt am 3. Oktober.', 'Er zahlt 3.50 Euro, z. B. für Brot.',
  'Er sagt: „Das ist gut.“', 'Danach geht er.',
]);
assert.deepEqual(nlp.paragraphs({items: []}), []);
assert.deepEqual(nlp.paragraphs(sample('Hallo!')), ['Hallo!']);
assert.equal(nlp.paragraphs(sample('Ja. Nein. Vielleicht. Gut. Danke. Ende.')).length, 1);
const fragmented = {items: [
  {german: 'Dr.', paragraph: 1}, {german: 'Müller sieht die', paragraph: 2},
  {german: 'Bahnstrecke.', paragraph: 3}, {german: 'Der Bahnhof liegt in Berlin.', paragraph: 4},
]};
assert.deepEqual(nlp.paragraphs(fragmented), ['Dr. Müller sieht die Bahnstrecke. Der Bahnhof liegt in Berlin.']);
const multilingual = 'Er fragt: „Warum?“ – Das weiß niemand. Grüße, Straße, Café, €10, 12:30 Uhr, https://example.com, <script>…</script>.';
const sameWords = data => assert.equal(nlp.paragraphs(data).join(' '), nlp.originalText(data));
sameWords(sample(multilingual));
sameWords(fragmented);
const repeated = sample(Array.from({length: 100}, () => rail.join(' ')).join(' '));
const start = performance.now();
const longResult = nlp.analyze(repeated);
assert.equal(longResult.paragraphs.join(' '), nlp.originalText(repeated));
assert.ok(longResult.paragraphs.length > 1);
assert.ok(longResult.paragraphs.every(p => (p.match(/[\p{L}\p{N}]+/gu) || []).length <= 260));
console.log(`500-sentence test: ${Math.round(performance.now() - start)} ms, ${longResult.paragraphs.length} paragraphs.`);
// Older browser path without Intl.Segmenter must retain every character as well.
const fallback = vm.createContext({Intl: {}});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'transcript_nlp.js'), 'utf8'), fallback);
assert.equal(fallback.TranscriptNLP.paragraphs(sample(abbreviationText)).join(' '), abbreviationText);
assert.equal(fallback.TranscriptNLP.sentences(abbreviationText).length, 4);
// A faulty segmenter must trigger the no-data-loss guard rather than corrupt output.
const faulty = vm.createContext({Intl: {Segmenter: class { segment() { return [{segment: 'lost text'}]; }}}});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'transcript_nlp.js'), 'utf8'), faulty);
assert.equal(faulty.TranscriptNLP.paragraphs(sample(abbreviationText)).join(' '), abbreviationText);
// Existing checked-in real transcript: no dropped, duplicated, reordered text.
const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'godic_full_transcript.json'), 'utf8'));
sameWords(real);
const analysis = nlp.analyze(real);
console.log(`Saved transcript: ${real.items.length} subtitle entries → ${analysis.sentences.length} sentences → ${analysis.paragraphs.length} paragraphs.`);
console.log('NLP segmentation tests passed.');

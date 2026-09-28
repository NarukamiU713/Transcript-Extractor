const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
let clipboard = '', removed = false;
const listeners = {};
const elements = new Map();
const context = vm.createContext({
  navigator: {clipboard: {writeText: async text => { clipboard = text; }}},
  document: {
    querySelector: selector => {
      if (!elements.has(selector)) elements.set(selector, {addEventListener(event, cb) { listeners[`${selector}:${event}`] = cb; }});
      return elements.get(selector);
    },
    body: {appendChild() {}}, activeElement: {focus() {}},
    createElement: () => ({style: {}, focus() {}, select() {}, remove() { removed = true; }}),
    execCommand: () => true,
  },
});
vm.runInContext(script + '\nthis.helpers = {paragraphs, plainText, timestampedText, copyText};', context);
const {paragraphs, plainText, timestampedText, copyText} = context.helpers;
const data = {items: [
  {german: '  Guten   Tag.', start: '00:01', paragraph: 1},
  {german: 'Wie geht es Ihnen?', paragraph: 1},
  {german: '', paragraph: 2},
  {german: 'Danke!', paragraph: 2},
]};
assert.equal(plainText(data), 'Guten Tag. Wie geht es Ihnen? Danke!');
assert.equal(plainText({items: []}), '');
assert.equal(plainText({items: [
  {german: 'Das ist'}, {german: 'ein Satz.'}, {german: 'Noch einer!'},
  {german: 'Wirklich?'}, {german: 'Ja.'},
]}), 'Das ist ein Satz. Noch einer! Wirklich? Ja.');
assert.equal(plainText({items: [{german: 'A', paragraph: 0}, {german: 'B', paragraph: 0}, {german: 'C', paragraph: 1}]}), 'A B C');
assert.equal(plainText({items: [{german: 'Treffen um 12:30 Uhr.'}]}), 'Treffen um 12:30 Uhr.');
assert.equal(paragraphs(data).length, 1);
assert.equal(timestampedText(data), '[00:01] Guten   Tag.\n\nWie geht es Ihnen?\n\nDanke!');
assert.equal(timestampedText({items: []}), '');
const singleSentenceParagraphs = {items: Array.from({length: 8}, (_, i) => ({german: `Satz ${i + 1}.`, paragraph: i + 1}))};
assert.equal(plainText(singleSentenceParagraphs), 'Satz 1. Satz 2. Satz 3.\n\nSatz 4. Satz 5. Satz 6.\n\nSatz 7. Satz 8.');
assert.equal(plainText({items: singleSentenceParagraphs.items.slice(0, 4)}), 'Satz 1. Satz 2. Satz 3. Satz 4.');
const fragments = {items: [
  {german: 'Eins.', paragraph: 1}, {german: 'Zwei.', paragraph: 1},
  {german: 'Drei.', paragraph: 1}, {german: 'Ein langer', paragraph: 1},
  {german: 'Satz geht weiter.', paragraph: 2},
]};
assert.equal(plainText(fragments), 'Eins. Zwei. Drei. Ein langer Satz geht weiter.');
assert.equal(plainText({items: [{german: 'Dr.', paragraph: 1}, {german: 'Müller kommt.', paragraph: 2}]}), 'Dr. Müller kommt.');
assert.equal(plainText(singleSentenceParagraphs).replace(/\s+/g, ' '), singleSentenceParagraphs.items.map(x => x.german).join(' '));
assert.match(html, /id="copy-timestamps"/);
(async () => {
  await copyText(plainText(data));
  assert.equal(clipboard, plainText(data));
  vm.runInContext('current = ' + JSON.stringify(data), context);
  await listeners['#copy-timestamps:click']();
  assert.equal(clipboard, timestampedText(data));
  assert.match(elements.get('#status').textContent, /带时间戳/);
  await listeners['#copy:click']();
  assert.equal(clipboard, plainText(data));
  assert.match(elements.get('#status').textContent, /连续句子已合并分段/);
  context.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
  await copyText('fallback');
  assert.equal(removed, true);
  removed = false;
  context.document.execCommand = () => false;
  await assert.rejects(copyText('fail'), /自动复制失败/);
  assert.equal(removed, true);
  console.log('Paragraph formatting and clipboard tests passed.');
})().catch(error => {console.error(error); process.exitCode = 1;});

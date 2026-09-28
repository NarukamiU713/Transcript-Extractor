const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
let clipboard = '', removed = false;
const context = vm.createContext({
  navigator: {clipboard: {writeText: async text => { clipboard = text; }}},
  document: {
    querySelector: () => ({addEventListener() {}}),
    body: {appendChild() {}}, activeElement: {focus() {}},
    createElement: () => ({style: {}, focus() {}, select() {}, remove() { removed = true; }}),
    execCommand: () => true,
  },
});
vm.runInContext(script + '\nthis.helpers = {paragraphs, plainText, copyText};', context);
const {paragraphs, plainText, copyText} = context.helpers;
const data = {items: [
  {german: '  Guten   Tag.', start: '00:01', paragraph: 1},
  {german: 'Wie geht es Ihnen?', paragraph: 1},
  {german: '', paragraph: 2},
  {german: 'Danke!', paragraph: 2},
]};
assert.equal(plainText(data), 'Guten Tag. Wie geht es Ihnen?\n\nDanke!');
assert.equal(plainText({items: []}), '');
assert.equal(plainText({items: [
  {german: 'Das ist'}, {german: 'ein Satz.'}, {german: 'Noch einer!'},
  {german: 'Wirklich?'}, {german: 'Ja.'},
]}), 'Das ist ein Satz. Noch einer! Wirklich?\n\nJa.');
assert.equal(plainText({items: [{german: 'A', paragraph: 0}, {german: 'B', paragraph: 0}, {german: 'C', paragraph: 1}]}), 'A B\n\nC');
assert.equal(plainText({items: [{german: 'Treffen um 12:30 Uhr.'}]}), 'Treffen um 12:30 Uhr.');
assert.equal(paragraphs(data).length, 2);
(async () => {
  await copyText(plainText(data));
  assert.equal(clipboard, plainText(data));
  context.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
  await copyText('fallback');
  assert.equal(removed, true);
  removed = false;
  context.document.execCommand = () => false;
  await assert.rejects(copyText('fail'), /自动复制失败/);
  assert.equal(removed, true);
  console.log('Paragraph formatting and clipboard tests passed.');
})().catch(error => {console.error(error); process.exitCode = 1;});

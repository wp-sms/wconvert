import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poFile, readPo, wordsFile } from '../../../bin/template-words.mjs';

const words = {
  'Say "hello"': { kind: 'headline', limit: 2000, refs: ['b.json'] },
  'Take the\nscenic route': { kind: 'design name', limit: 120, refs: ['a.json', 'a.json', 'c.json'] },
  Untranslated: { kind: 'button label', limit: 2000, refs: ['a.json'] },
};
const translated = new Map([['Say "hello"', 'Sag „hallo“ "nett"'], ['Take the\nscenic route', 'Nimm den\nschönen Weg']]);

test('a .po round-trips quotes and line breaks, and holds no translation for an empty msgstr', () => {
  const read = readPo(poFile('de_DE', words, translated));
  assert.deepEqual([...read].sort(), [...translated].sort());
  assert.equal(read.has('Untranslated'), false);
});

test('a .po keeps a design\'s words together and tells a translator what each is', () => {
  const text = poFile('de_DE', words, translated);
  assert.match(text, /"Language: de_DE\\n"/);
  assert.match(text, /#\. design name, at most 120 bytes\n#: a\.json c\.json\nmsgid "Take the\\nscenic route"/);
  assert.ok(text.indexOf('Untranslated') < text.indexOf('Say'), 'a.json comes first');
});

test('a list holds only what its set uses and has a translation for, one pair to a line', () => {
  const file = wordsFile({ Untranslated: words.Untranslated, 'Say "hello"': words['Say "hello"'] }, new Map([...translated, ['Elsewhere', 'Anderswo']]));
  assert.deepEqual(JSON.parse(file), { 'Say "hello"': 'Sag „hallo“ "nett"' });
  assert.equal(file.split('\n').length, 4);
});

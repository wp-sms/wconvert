import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hamming, nearDuplicates, paletteDistance } from './near-duplicates.mjs';

const design = (id, tokens, extra = {}) => ({ id, name: id, display_type: 'popup', tokens, tree: { v: 2, steps: [{ id: 's', kind: 'input', content: {
  type: 'stack', children: [{ type: 'heading', id: 'n1', text: id, role: 'headline' }, { type: 'field', id: 'n2', name: 'email', label: 'Email' }, { type: 'button', id: 'n3', text: 'Go', action: 'submit' }, ...(extra.more ?? [])] } }] } });
const warm = { bg: '#fff8ee', fg: '#222222', accent: '#aa3300' };

test('the same structure, palette and picture is a duplicate; a different palette or picture is not', () => {
  const pair = [design('a', warm), design('b', { ...warm, bg: '#fff8ef' })];
  assert.deepEqual(nearDuplicates(pair).map(found => [found.a, found.b]), [['a', 'b']]);
  assert.deepEqual(nearDuplicates([design('a', warm), design('b', { ...warm, accent: '#0044cc' })]), [], 'A clearly different accent is a different design');
  assert.deepEqual(nearDuplicates(pair, new Map([['a', '0000000000000000'], ['b', 'ffffffffffffffff']])), [], 'Pictures far apart win over structure');
  assert.deepEqual(nearDuplicates(pair, new Map([['a', '0000000000000000'], ['b', '000000000000000f']])).length, 1);
  assert.deepEqual(nearDuplicates(pair, new Map(), [{ a: 'b', b: 'a', reason: 'family' }]), [], 'A listed pair is deliberate');
});

test('palette and picture distances', () => {
  assert.equal(paletteDistance(warm, warm), 0);
  assert.equal(paletteDistance(warm, { ...warm, bg: 'var(--x)' }), null);
  assert.equal(hamming('0000000000000000', '000000000000000f'), 4);
});

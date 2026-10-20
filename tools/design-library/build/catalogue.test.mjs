import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assignRevisions, canonical, contentHash, retireMissing } from './catalogue.mjs';
import { literalColours } from './catalogue-lint.mjs';

const empty = { schema: 1, designs: {}, setups: {}, retired: [] };
const design = (id, tokens = {}) => ({ id, json: JSON.stringify({ schema: 3, id, revision: 1, name: id, tree: { v: 2, steps: [] }, tokens }), entry: { id } });
const setup = (id, designId) => ({ id, json: JSON.stringify({ schema: 3, id, revision: 1, design: { id: designId, revision: 1 }, playbook: { goal: 'grow_email_list' } }), entry: { id } });

test('a revision follows content, not key order, and only increases', () => {
  assert.equal(canonical({ b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}');
  assert.equal(contentHash({ revision: 1, a: 1 }), contentHash({ a: 1, revision: 9 }));
  const first = assignRevisions(empty, { designs: [design('card')], setups: [setup('start', 'card')] });
  assert.deepEqual([first.designs[0].revision, first.setups[0].revision], [1, 1]);
  const same = assignRevisions(first.registry, { designs: [design('card')], setups: [setup('start', 'card')] });
  assert.deepEqual(same.changed, [], 'Republishing unchanged content renumbers nothing');
  const changed = assignRevisions(first.registry, { designs: [design('card', { bg: '#fff' })], setups: [setup('start', 'card')] });
  assert.equal(changed.designs[0].revision, 2);
  assert.equal(JSON.parse(changed.designs[0].json).revision, 2);
  assert.equal(changed.setups[0].revision, 2, 'A setup pinned to a changed design is a changed setup');
  assert.equal(JSON.parse(changed.setups[0].json).design.revision, 2);
  assert.equal(changed.registry.designs.card.added, first.registry.designs.card.added, 'Order of first publication never moves');
});

test('an id is never reused once its design is gone', () => {
  const first = assignRevisions(empty, { designs: [design('old-card')], setups: [] });
  const retired = retireMissing(first.registry, { designs: new Set(), setups: new Set() });
  assert.deepEqual(retired.retired, ['old-card']);
  assert.throws(() => assignRevisions(retired, { designs: [design('old-card')], setups: [] }), /retired id/);
});

test('literal colours in node tokens are counted; top-level tokens are the palette', () => {
  const tree = { steps: [{ content: { type: 'stack', tokens: { bg: '#fff', gap: '1rem' }, children: [{ type: 'heading', id: 'h', tokens: { fg: 'rgb(0, 0, 0)' } }] } }] };
  assert.equal(literalColours({ tokens: { bg: '#000' }, tree }), 2);
  const baseline = JSON.parse(readFileSync(new URL('../publishing/colour-baseline.json', import.meta.url)));
  assert.ok(Object.values(baseline.designs).every(count => Number.isInteger(count) && count > 0));
});

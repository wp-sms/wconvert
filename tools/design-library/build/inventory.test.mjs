import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalDesign, analyseDesigns, readDesigns } from './inventory.mjs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const designs = readDesigns(root);
const original = designs.find(entry => entry.id === 'studio-window');

test('renaming IDs and copy cannot disguise the same composition', () => {
  const renamed = JSON.parse(JSON.stringify(original).replaceAll('n1"', 'renamed-node"').replaceAll('primary"', 'renamed-submission"'));
  renamed.name = 'A different name';
  assert.deepEqual(canonicalDesign(original), canonicalDesign(renamed));
  assert.equal(analyseDesigns([original, { ...renamed, id: 'renamed' }])[0].nearest[0].same_design, true);
});

test('colour variants share structure but not the style fingerprint', () => {
  const other = structuredClone(original); other.id = 'recolour'; other.tokens.bg = '#000000';
  const nearest = analyseDesigns([original, other])[0].nearest[0];
  assert.equal(nearest.same_structure, true); assert.equal(nearest.same_design, false);
});

test('capture channels, required fields and submission links are meaningful differences', () => {
  for (const mutate of [
    entry => { entry.tree.submissions[0].required = false; },
    entry => { entry.tree.submissions[0].fields = []; },
    entry => { entry.tree.steps[0].content.end[0].children.find(node => node.type === 'field').name = 'phone'; },
  ]) {
    const other = structuredClone(original); mutate(other);
    assert.notDeepEqual(canonicalDesign(original), canonicalDesign(other));
  }
});

test('inventory covers paid questions and fullscreens as well as Free', () => {
  assert.ok(designs.some(entry => entry.id === 'journey-product-finder'));
  assert.ok(designs.some(entry => entry.display_type === 'fullscreen'));
  assert.equal(new Set(designs.map(entry => entry.id)).size, designs.length);
});

test('every pilot is a registered, complete snapshot with the intended privacy behaviour', () => {
  const entries = JSON.parse(execFileSync('php', [resolve(import.meta.dirname, 'pilot.php')], { encoding: 'utf8' }));
  assert.equal(entries.length, 12);
  assert.equal(new Set(entries.map(entry => entry.id)).size, 12);
  assert.deepEqual(new Set(entries.map(entry => entry.display_type)), new Set(['popup', 'inline', 'floating_bar', 'fullscreen', 'slide_in']));
  const nodes = value => !value || typeof value !== 'object' ? [] : [value, ...Object.values(value).flatMap(nodes)];
  for (const entry of entries) {
    const all = nodes(entry.tree);
    assert.ok(all.some(node => node.type === 'heading' && node.text?.trim()), entry.id);
    assert.ok(all.some(node => node.type === 'button' && node.label?.trim()), entry.id);
    if (entry.goal === 'grow_email_list') assert.ok(all.some(node => node.type === 'consent' && !node.hidden), entry.id);
    if (entry.goal === 'collect_enquiries') assert.ok(all.filter(node => node.type === 'consent').every(node => node.hidden), entry.id);
    assert.ok(entry.notes && entry.requirements.length && entry.config.display_rules);
  }
});

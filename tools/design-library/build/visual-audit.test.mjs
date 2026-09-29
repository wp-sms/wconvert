import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readDesigns } from './inventory.mjs';
import { visualAuditReport, validateDirections } from './visual-audit.mjs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const designs = readDesigns(root);
const audit = JSON.parse(readFileSync(new URL('../review/visual-audit.json', import.meta.url)));
const plan = JSON.parse(readFileSync(new URL('../pilot/next-batch.json', import.meta.url)));

test('visual triage becomes stale after source or renderer changes; new designs are not silently approved', () => {
  assert.equal(visualAuditReport(audit, designs, audit.renderer_revision).filter(r => r.current).length, audit.records.length);
  const changed = structuredClone(designs);
  changed[0].tokens.pad = '9rem';
  assert.equal(visualAuditReport(audit, changed, audit.renderer_revision).find(r => r.id === changed[0].id).current, false);
  assert.ok(visualAuditReport(audit, designs, 'changed-renderer').every(r => !r.current));
  const added = { ...designs[0], id: 'not-reviewed-yet' };
  const result = visualAuditReport(audit, [...designs, added], audit.renderer_revision).at(-1);
  assert.equal(result.current, false);
  assert.equal(result.decision, undefined);
});

test('comparison and reuse directions cannot silently point at absent or incompatible designs', () => {
  validateDirections(plan, audit.references, designs);
  const invalid = structuredClone(audit);
  invalid.records[0].compare_to = ['not-a-design'];
  assert.throws(() => visualAuditReport(invalid, designs, audit.renderer_revision));
  const duplicate = structuredClone(audit);
  duplicate.records.push(duplicate.records[0]);
  assert.throws(() => visualAuditReport(duplicate, designs, audit.renderer_revision));
  const broken = structuredClone(plan);
  broken.entries.find(e => e.design_intent === 'reuse_design').reuse_template = 'inline-signpost';
  assert.throws(() => validateDirections(broken, audit.references, designs));
});

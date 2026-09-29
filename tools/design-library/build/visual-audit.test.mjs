import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readDesigns } from './inventory.mjs';
import { visualAuditReport, validateDirections } from './visual-audit.mjs';
import { designRevision } from './maintenance.mjs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const designs = readDesigns(root);
const audit = JSON.parse(readFileSync(new URL('../review/visual-audit.json', import.meta.url)));
const plan = JSON.parse(readFileSync(new URL('../pilot/next-batch.json', import.meta.url)));

test('variant groups reject cycles and incompatible types, and expire when the canonical source changes', () => {
  const grouped = structuredClone(audit);
  const variant = grouped.records.find(r => r.id === 'popup-flash');
  variant.variant_of = 'flash-offer';
  variant.canonical_revision = designRevision(designs.find(d => d.id === 'flash-offer'));
  assert.equal(visualAuditReport(grouped, designs, audit.renderer_revision).find(r => r.id === variant.id).current, true);
  const changed = structuredClone(designs);
  changed.find(d => d.id === variant.variant_of).tokens.pad = '9rem';
  assert.equal(visualAuditReport(grouped, changed, audit.renderer_revision).find(r => r.id === variant.id).current, false);
  const canonical = grouped.records.find(r => r.id === variant.variant_of);
  canonical.variant_of = variant.id;
  canonical.canonical_revision = variant.source_revision;
  assert.throws(() => visualAuditReport(grouped, designs, audit.renderer_revision), /Invalid visual variant/);
  delete canonical.variant_of;
  variant.variant_of = 'inline-rule';
  assert.throws(() => visualAuditReport(grouped, designs, audit.renderer_revision), /Invalid visual variant/);
});

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

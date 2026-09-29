import { designRevision } from './maintenance.mjs';

/** Advisory triage, deliberately separate from campaign approval and retirement. */
export function visualAuditReport(audit, designs, rendererRevision) {
  const known = new Set(designs.map(d => d.id)), byId = new Map(designs.map(d => [d.id, d])), records = new Map();
  if (audit.schema !== 1 || !Array.isArray(audit.records) || !audit.scope?.trim()) throw new Error('Invalid visual audit');
  for (const record of audit.records) {
    if (!known.has(record.id) || records.has(record.id)
      || !['keep', 'improve', 'consolidate'].includes(record.decision)
      || !['family', 'reason', 'action'].every(key => record[key]?.trim())
      || ![1, 2, 3].includes(record.priority)
      || !/^[a-f0-9]{64}$/.test(record.source_revision)
      || !Array.isArray(record.compare_to)
      || record.compare_to.some(id => !known.has(id) || id === record.id)
      || record.decision === 'consolidate' && !record.compare_to.length) {
      throw new Error(`Invalid visual audit record: ${record.id}`);
    }
    records.set(record.id, record);
  }
  for (const record of records.values()) {
    if (record.variant_of !== undefined && (!known.has(record.variant_of)
      || record.variant_of === record.id || records.get(record.variant_of)?.variant_of
      || byId.get(record.variant_of).display_type !== byId.get(record.id).display_type
      || !/^[a-f0-9]{64}$/.test(record.canonical_revision))) {
      throw new Error(`Invalid visual variant: ${record.id}`);
    }
  }
  return designs.map(design => {
    const record = records.get(design.id);
    return { id: design.id, ...record, current: Boolean(record && record.source_revision === designRevision(design)
      && audit.renderer_revision === rendererRevision
      && (!record.variant_of || record.canonical_revision === designRevision(byId.get(record.variant_of)))) };
  });
}

export function validateDirections(plan, references, designs) {
  const refs = new Set(references.map(r => r.id));
  const concepts = new Set(['matrix', 'callback', 'excerpt', 'calendar', 'product', 'process', 'reuse']);
  for (const entry of plan.entries) {
    const reuse = designs.find(d => d.id === entry.reuse_template);
    if (!concepts.has(entry.concept) || !refs.has(entry.reference) || !entry.example?.trim()
      || entry.design_intent === 'reuse_design' && (!reuse || reuse.display_type !== entry.display_type || entry.concept !== 'reuse')
      || entry.design_intent === 'new_design' && (entry.concept === 'reuse' || entry.reuse_template)) {
      throw new Error(`Invalid visual direction: ${entry.id}`);
    }
  }
}

/** Explain a review's blast radius without changing approvals or revision rules. */
import { createHash } from 'node:crypto';

const designPath = path => /^(resources\/templates\/library|pro\/modules\/[^/]+\/templates)\/([^/]+)\.json$/.exec(path)?.[2];
const setupPath = path => /^(resources\/playbooks|pro\/modules\/[^/]+\/playbooks)\/([^/]+)\.php$/.exec(path)?.[2];
const changedIds = (before, after) => [...new Set([...before, ...after].map(e => e.id))]
  .filter(id => JSON.stringify(before.find(e => e.id === id)) !== JSON.stringify(after.find(e => e.id === id)));
export const scopeDigest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** A named batch gates its designs; the unscoped release review gates all designs. */
export function maintenanceScope(maintenance, selected, batch) {
  const ids = new Set(selected.map(e => e.template_id));
  const pending = maintenance.filter(d => d.unrecorded_change);
  return { required: pending.filter(d => !batch || ids.has(d.id)),
    outside: batch ? pending.filter(d => !ids.has(d.id)) : [] };
}

export function reviewScope({ base, paths, designs, setups, briefsBefore = [], briefsAfter = [], collectionsBefore = [], collectionsAfter = [], queue = [] }) {
  // Unknown production source changes are deliberately broad. Never guess that a
  // runtime/style change is harmless from a filename or a representative render.
  const shared = paths.filter(p => /^(src\/|resources\/(renderer|loader|phone)\/|pro\/(src|resources)\/|pro\/modules\/[^/]+\/(src|loader)\/)/.test(p)
    || (/^pro\/modules\//.test(p) && p.endsWith('.php') && !setupPath(p))
    || (/^tools\/design-library\/pilot\/assets\//.test(p) && !p.endsWith('.md'))
    || ['wconvert.php', 'pro/wconvert-pro.php', 'resources/templates/manifest.json'].includes(p));
  const designIds = new Set(paths.map(designPath).filter(Boolean));
  const setupIds = new Set([...paths.map(setupPath).filter(Boolean), ...changedIds(briefsBefore, briefsAfter)]);
  const affected = setups.filter(e => shared.length || designIds.has(e.template_id) || setupIds.has(e.id));
  const removedSetups = [...setupIds].filter(id => !setups.some(e => e.id === id));
  const affectedIds = new Set(affected.map(e => e.id));
  const collectionIds = new Set(changedIds(collectionsBefore, collectionsAfter));
  for (const c of collectionsAfter) if (c.items.some(e => affectedIds.has(e.setup_id))) collectionIds.add(c.id);
  const selectedDesigns = designs.filter(d => shared.length || designIds.has(d.id) || affected.some(e => e.template_id === d.id));
  const entries = affected.map(e => ({ id: e.id, design: e.template_id, format: e.display_type,
    // These fingerprints describe the CURRENT prepared output, not an approval.
    output: scopeDigest({tree:e.tree,tokens:e.tokens,config:e.config}),
    in_studio: briefsAfter.some(b => b.id === e.id),
    screens: e.tree.steps.flatMap(s => (s.results?.length ? s.results : [null]).map(r => ({id:s.id, name:s.name, kind:s.kind, result:r?.id ?? null}))),
    review: queue.find(q => q.id === e.id)?.state ?? 'review' }));
  const knownDesigns = new Set(designs.map(d=>d.id));
  return {schema:1, base, mode:shared.length?'whole-library':'affected-only', shared_changes:shared,
    changed_designs:[...designIds], removed_designs:[...designIds].filter(id=>!knownDesigns.has(id)), removed_setups:removedSetups,
    designs:selectedDesigns.map(d=>({id:d.id, screens:d.tree.steps.length})), setups:entries, collections:[...collectionIds].sort(),
    unrelated_pending:queue.filter(q=>q.state!=='approved'&&!affectedIds.has(q.id)).map(q=>({id:q.id,state:q.state})),
    widths:[320,390,768,1440], additional_checks:['Every screen/result at each width; LTR and RTL; normal and longer copy.',
      'Inspect before/after any layout transition, not only fixed widths.',
      'Required fields, invalid input, failure/retry, success and dismissal.',
      'Mounted WordPress output with settled motion, scrolling and real local capture.',
      'Fresh screenshots plus a composition judgement; automated measurements are not approval.'],
    notice:'Planning only. Existing stale approvals remain stale; this report cannot approve or publish anything.'};
}

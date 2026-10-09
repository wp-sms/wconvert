/** Planned work is never included in the published campaign/design counts. */
export function validateBacklog(plan, entries) {
  const ids = new Set(entries.map(e => e.id)), seen = new Set(), needs = new Set();
  const goals = new Set(entries.map(e => e.goal)), types = new Set(entries.map(e => e.display_type));
  if (plan.schema !== 1 || !Array.isArray(plan.entries)) throw new Error('Invalid next-batch plan');
  for (const entry of plan.entries) {
    const need = entry.visitor_need?.trim().toLowerCase();
    if (!entry.id || ids.has(entry.id) || seen.has(entry.id) || needs.has(need)
      || entry.status !== 'planned' || !['stores','services','publishers'].includes(entry.audience)
      || !goals.has(entry.goal) || !types.has(entry.display_type)
      || !['new_design','reuse_design'].includes(entry.design_intent)
      || !['name','visitor_need','difference'].every(key => typeof entry[key] === 'string' && entry[key].trim())
      || !entry.compare_campaigns?.length || entry.compare_campaigns.some(id => !ids.has(id))
      || !entry.acceptance?.length || entry.acceptance.some(check => typeof check !== 'string' || !check.trim())) throw new Error(`Invalid or duplicate planned brief: ${entry.id}`);
    seen.add(entry.id); needs.add(need);
  }
}

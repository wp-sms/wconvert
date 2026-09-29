/** Editorial requirements fail before a candidate enters the review gallery. */
export function validateBriefs(collection, entries, designs) {
  const designIds = new Set(designs.map(d => d.id));
  const batchIds = new Set(collection.batches.map(b => b.id));
  const seen = new Set();
  if (collection.schema !== 2 || batchIds.size !== collection.batches.length) throw new Error('Invalid collection or repeated batch');
  for (const entry of entries) {
    const comparison = entry.comparison;
    if (seen.has(entry.id)) throw new Error(`Repeated campaign brief: ${entry.id}`);
    seen.add(entry.id);
    if (!designIds.has(entry.template_id) || !batchIds.has(entry.batch)
      || !['stores', 'services', 'publishers'].includes(entry.audience)
      || !['family', 'visitor_need', 'difference', 'measure', 'source'].every(key => typeof entry[key] === 'string' && entry[key].trim())
      || !['requirements', 'suggested_setup'].every(key => Array.isArray(entry[key]) && entry[key].length && entry[key].every(s => typeof s === 'string' && s.trim()))
      || !comparison || !['new_design', 'reuse_design'].includes(comparison.decision)
      || !comparison.reason?.trim() || !Array.isArray(comparison.against)
      || (entry.batch !== 'benchmark' && !comparison.against.length)
      || comparison.against.some(id => !designIds.has(id))) throw new Error(`Incomplete or invalid brief: ${entry.id}`);
  }
  if (entries.length !== collection.entries.length) throw new Error('Collection and prepared campaigns differ');
}

export function coverage(entries) {
  const counts = key => Object.fromEntries([...new Set(entries.map(e => e[key]))].sort().map(value => [value, entries.filter(e => e[key] === value).length]));
  return { setups: entries.length, designs: new Set(entries.map(e => e.template_id)).size,
    audiences: counts('audience'), goals: counts('goal'), types: counts('display_type'), batches: counts('batch') };
}

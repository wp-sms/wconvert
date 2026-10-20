/** Additive schema: old readers continue using only designs (pack members). */
export function galleryExtensions(designs, bundled, collections, setupDesigns) {
  const all = new Map(designs.map(design => [design.id, design]));
  for (const design of bundled) {
    if (all.has(design.id)) throw Error(`Repeated bundled/pack design: ${design.id}`);
    if (!design.bundled || !design.bundle_tier || design.packs.length) throw Error('Invalid bundled-only design');
    all.set(design.id, design);
  }
  const ids = new Set();
  const projected = [...collections].sort((a, b) => a.id.localeCompare(b.id)).map(collection => {
    if (ids.has(collection.id)) throw Error('Repeated gallery collection');
    ids.add(collection.id);
    const items = collection.items.map(item => {
      const reference = setupDesigns.get(item.setup_id), design = all.get(reference?.design_id);
      if (!design) throw Error(`Collection design is absent: ${item.setup_id}`);
      return { setup_id: item.setup_id, design_id: design.id, stage: item.stage,
        ...(reference.pack_id ? { pack_id: reference.pack_id, pack_digest: reference.pack_digest } : {}) };
    });
    return {
      id: collection.id, name: collection.name, description: collection.description,
      items, design_ids: [...new Set(items.map(item => item.design_id))],
      ...(collection.event ? { event: { ...collection.event, date_basis: 'site-calendar', end_semantics: 'exclusive' } } : {}),
    };
  });
  return { schema: 1, capabilities: { design_only_embed: 1, bundled_designs: 1, collection_designs: 1 },
    bundled_designs: bundled, collections: projected };
}

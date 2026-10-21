/**
 * Setups whose latest decision was an approval of a version that is no longer
 * current. A setup still waiting for a first approval, or last sent back for
 * revision, is not one: it was never on the website.
 */
export function staleApprovals(queue) {
  return queue.filter(row => row.state === 'stale' && row.record?.decision === 'approved');
}

/**
 * What the catalogue puts online, and what it holds back and why — derived,
 * never listed (ADR 0162).
 *
 * Every current approval is published when its setup exports, and shown on
 * the website bundled-only, with the exporter's own reason, when it does not.
 * Every Collection whose review is current is published. A setup or design
 * that `withdrawn` names without a revision is neither. A stale approval is
 * neither too, which is why the release refuses one first ({@link staleApprovals}).
 *
 * `entries` are the pilot's setups (for each one's design), `queue` their
 * review states, `exported` the exporter's output over every authored design
 * and setup, `compiled` the Collections from `buildCollections`, `designs`
 * the designs `catalog.json` publishes without a setup.
 */
export function delivery({ entries, queue, exported, compiled = [], designs = [], withdrawn = [] }) {
  const gone = new Set(withdrawn.filter(row => row.revision === undefined).map(row => row.id));
  const designOf = new Map(entries.map(entry => [entry.id, entry.template_id]));
  const online = new Set(exported.setups.map(setup => setup.id));
  const failure = (kind, id) => exported.failures.find(row => row.kind === kind && row.id === id);
  const published = [], held = [];
  for (const row of queue) {
    const design = designOf.get(row.id);
    if (row.state !== 'approved' || gone.has(row.id) || gone.has(design)) continue;
    if (online.has(row.id)) { published.push(row.id); continue; }
    const cause = failure('design', design);
    held.push({ setup: row.id, design, reason: cause ? `Design ${design}: ${cause.reason}` : failure('setup', row.id)?.reason ?? 'It was not exported.' });
  }
  return { published, held, designs: designs.filter(id => !gone.has(id)), collections: compiled.filter(collection => collection.status === 'published').map(collection => collection.id) };
}

/**
 * Each published Collection as the release lists it. A member that is held
 * back is listed as its design, shown bundled-only; one that is neither
 * published nor held is left out.
 */
export function releaseCollections(compiled, online) {
  const published = new Set(online.published), held = new Map(online.held.map(row => [row.setup, row.design]));
  return online.collections.map(id => {
    const collection = compiled.find(item => item.id === id);
    return { id: collection.id, revision: collection.revision, name: collection.name, description: collection.description, cover: collection.cover,
      priority: collection.priority, business_types: collection.business_types, markets: collection.markets,
      items: collection.items.filter(item => published.has(item.setup_id) || held.has(item.setup_id)).map(item => published.has(item.setup_id)
        ? { setup: item.setup_id, stage: item.stage } : { design: held.get(item.setup_id), stage: item.stage, bundled_only: true }),
      ...(collection.event ? { event: collection.event } : {}) };
  });
}

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { latestReview, loadReviews, reviewQueue } from './reviews.mjs';
import { designSource, designSources, setupSource } from './sources.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const identifier = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
export function validateCollection(collection) {
  if (!identifier(collection.id) || !collection.name || collection.name.length > 120 || !collection.description || collection.description.length > 1000
    || !['sale', 'launch', 'services', 'reading'].includes(collection.cover) || !Array.isArray(collection.items) || !collection.items.length || collection.items.length > 100
    || !Array.isArray(collection.business_types) || collection.business_types.some(id => !['stores', 'services', 'publishers'].includes(id))
    || !Array.isArray(collection.markets) || collection.markets.some(id => !/^[A-Z]{2}$/.test(id)) || !Number.isInteger(collection.priority)) throw new Error('Invalid collection metadata');
  const seen = new Set();
  for (const item of collection.items) {
    if (!identifier(item.setup_id) || seen.has(item.setup_id) || !['any', 'before', 'during', 'after'].includes(item.stage)
      || !/^[a-f0-9]{64}$/.test(item.setup_hash) || !/^[a-f0-9]{64}$/.test(item.design_hash)) throw new Error('Invalid or repeated collection reference');
    seen.add(item.setup_id);
  }
  if (collection.event) {
    const event = collection.event;
    if (!identifier(event.family) || !['start', 'end_exclusive', 'feature_start', 'feature_end_exclusive'].every(key => date(event[key]))
      || event.start >= event.end_exclusive || event.feature_start >= event.feature_end_exclusive || event.feature_start > event.start || event.feature_end_exclusive > event.end_exclusive) throw new Error('Invalid event calendar dates');
  }
}

/** What a Collection is reviewed as: its own source, and what each of its setups is. */
export const collectionRevision = (collection, revisions) => hash(JSON.stringify([collection, revisions]));

/**
 * Carry the decision on every Collection that moved only because its setups'
 * revisions did, where every one of those setups was itself carried as
 * pixel-identical (ADR 0156, ADR 0159).
 *
 * A Collection's revision hashes its setups' revisions, so a renderer change
 * that draws nothing differently stales every Collection with no change to its
 * items, order, words or screens. `previous` gives each setup's revisions as
 * they were under the base renderer — one per identity scheme it may have been
 * reviewed under — and a Collection is carried only where its latest decision
 * was current against one of them. Anything else is left for a person.
 *
 * Returns the chained records; writing them is the caller's.
 */
export function carryCollections({ source, entries, store, carried, previous, at, evidence = [] }) {
  const byId = new Map(entries.map(entry => [entry.id, entry])), moved = new Set(carried), records = [];
  for (const collection of source.collections) {
    const latest = latestReview(store, `collection-${collection.id}`);
    const items = collection.items.map(item => byId.get(item.setup_id));
    if (!latest || items.some(entry => !entry)) continue;
    const now = collectionRevision(collection, items.map(entry => entry.revision));
    if (latest.revision === now) continue;
    const schemes = Math.max(...items.map(entry => previous.get(entry.id)?.length ?? 0));
    const wasCurrent = Array.from({ length: schemes }, (_, scheme) => collectionRevision(collection, items.map(entry => previous.get(entry.id)?.[scheme])))
      .includes(latest.revision);
    // Every setup either carried as pixel-identical, or exactly what it was.
    const unchanged = items.every(entry => moved.has(entry.id) || previous.get(entry.id)?.includes(entry.revision));
    if (!wasCurrent || !unchanged) continue;
    const checks = structuredClone(latest.checks);
    for (const file of evidence) if (!checks.visual.evidence.some(item => item.path === file.path)) checks.visual.evidence.push(file);
    const body = { id: latest.id, revision: now, base_id: latest.record_id, decision: latest.decision, reviewer: 'Renderer carry (ADR 0156)',
      note: 'Every setup in it pixel-identical under the new renderer and carried by templates:visual-diff; items, order and words unchanged; only setup revisions moved. Not a new review.', at, checks };
    records.push({ ...body, record_id: hash(JSON.stringify(body)) });
  }
  return records;
}

export function buildCollections(root, source, entries, setupQueue, reviews) {
  if (source.schema !== 1 || !Array.isArray(source.collections) || source.collections.length > 100) throw new Error('Invalid collection source');
  const byId = new Map(entries.map(entry => [entry.id, entry])); const seen = new Set(); const designs = designSources(root);
  const compiled = source.collections.map(collection => {
    validateCollection(collection);
    if (seen.has(collection.id)) throw new Error('Duplicate collection'); seen.add(collection.id);
    const dependencies = collection.items.map(item => {
      const entry = byId.get(item.setup_id); const approval = setupQueue.find(row => row.id === item.setup_id);
      if (!entry || !approval) throw new Error(`Missing reviewed setup reference: ${item.setup_id}`);
      const setupFile = setupSource(root, entry.id);
      const designFile = designSource(root, entry.template_id, designs);
      if (hash(readFileSync(setupFile)) !== item.setup_hash || hash(readFileSync(designFile)) !== item.design_hash) throw new Error(`Stale collection dependency: ${item.setup_id}`);
      return { revision: entry.revision, current: approval.state === 'approved' };
    });
    // Keyed on what the setups are, not on which record approved them: carrying an approval does not stale a collection.
    return { ...collection, dependencies_current: dependencies.every(item => item.current), revision: collectionRevision(collection, dependencies.map(item => item.revision)) };
  });
  const queue = reviewQueue(reviews, compiled.map(collection => ({ id: `collection-${collection.id}`, revision: collection.revision })), root);
  return { compiled: compiled.map((collection, at) => ({ ...collection, status: collection.dependencies_current && queue[at].state === 'approved' ? 'published' : 'draft' })), queue };
}

/** Check the shipped snapshot against fresh renderer-bound reviews, without publishing. */
export function collectionLabels(compiled) {
  const php = value => "'" + value.replaceAll('\\', '\\\\').replaceAll("'", "\\'") + "'";
  return "<?php\n// Generated from the reviewed collection source.\ndefined('ABSPATH') || exit;\nreturn [\n" + compiled.map(collection => `    ${php(collection.id)} => ['name' => __(${php(collection.name)}, 'wconvert'), 'description' => __(${php(collection.description)}, 'wconvert')],`).join('\n') + "\n];\n";
}

/**
 * A Collection never approved is a draft: it ships nowhere until it is. One
 * already shipped that has lost its approval is refused, so a stale review
 * cannot ship or drop silently (ADR 0162).
 */
function shippedDrafts(root, compiled) {
  return compiled.filter(collection => collection.status !== 'published' && existsSync(resolve(root, 'resources/collections', `${collection.id}.json`)));
}

export function checkRuntimeCollections(root, compiled) {
  const unapproved = shippedDrafts(root, compiled);
  if (unapproved.length) throw new Error(`Collection or setup review is missing or stale: ${unapproved.map(collection => collection.id).join(', ')}`);
  const published = compiled.filter(collection => collection.status === 'published');
  const destination = resolve(root, 'resources/collections');
  const expected = new Set(published.map(collection => `${collection.id}.json`));
  if (readdirSync(destination).some(file => file.endsWith('.json') && !expected.has(file))) throw new Error('Retire obsolete runtime collections explicitly');
  for (const collection of published) {
    if (readFileSync(resolve(destination, `${collection.id}.json`), 'utf8') !== JSON.stringify(collection, null, 2) + '\n') throw new Error(`Runtime collection differs from its reviewed revision: ${collection.id}`);
  }
  if (readFileSync(resolve(destination, 'labels.php'), 'utf8') !== collectionLabels(published)) throw new Error('Collection labels differ from their reviewed source');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
  const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const result = buildCollections(root, read('tools/design-library/collections/source.json'), read('tools/design-library/out/pilot.json'), read('tools/design-library/out/review-queue.json'), loadReviews(root));
  const out = resolve(root, 'tools/design-library/out'); mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'collections-review.json'), JSON.stringify(result, null, 2) + '\n');
  if (process.argv.includes('--check')) checkRuntimeCollections(root, result.compiled);
  // Preview candidates stay in /tools until the shared review approves them.
  if (process.argv.includes('--publish')) {
    if (shippedDrafts(root, result.compiled).length) throw new Error('Review every collection revision before generating runtime data');
    const published = result.compiled.filter(collection => collection.status === 'published');
    const destination = resolve(root, 'resources/collections'); mkdirSync(destination, { recursive: true });
    const expected = new Set(published.map(collection => `${collection.id}.json`));
    if (readdirSync(destination).some(file => file.endsWith('.json') && !expected.has(file))) throw new Error('Retire obsolete runtime collections explicitly');
    for (const collection of published) writeFileSync(resolve(destination, `${collection.id}.json`), JSON.stringify(collection, null, 2) + '\n');
    // Generated literals let WordPress extract bundled collection translations.
    writeFileSync(resolve(destination, 'labels.php'), collectionLabels(published));
  }
  const coverage = entries => {
    const matrix = new Map();
    for (const entry of entries) for (const business of entry.audience ? [entry.audience] : ['general']) {
      const key = `${entry.goal}/${business}/${entry.display_type}`; const row = matrix.get(key) ?? { goal: entry.goal, business, format: entry.display_type, setups: 0, designs: new Set() };
      row.setups++; row.designs.add(entry.template_id); matrix.set(key, row);
    }
    return [...matrix.values()].map(row => ({ ...row, designs: row.designs.size }));
  };
  writeFileSync(resolve(out, 'collection-coverage.json'), JSON.stringify(coverage(read('tools/design-library/out/pilot.json')), null, 2) + '\n');
  console.log(`${result.compiled.length} curated collections; ${result.queue.filter(row => row.state === 'approved').length} approved. See out/collections-review.json.`);
}

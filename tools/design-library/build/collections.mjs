import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { reviewQueue } from './reviews.mjs';

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

export function buildCollections(root, source, entries, setupQueue, reviews) {
  if (source.schema !== 1 || !Array.isArray(source.collections) || source.collections.length > 100) throw new Error('Invalid collection source');
  const byId = new Map(entries.map(entry => [entry.id, entry])); const seen = new Set();
  const compiled = source.collections.map(collection => {
    validateCollection(collection);
    if (seen.has(collection.id)) throw new Error('Duplicate collection'); seen.add(collection.id);
    const dependencies = collection.items.map(item => {
      const entry = byId.get(item.setup_id); const approval = setupQueue.find(row => row.id === item.setup_id);
      if (!entry || !approval) throw new Error(`Missing reviewed setup reference: ${item.setup_id}`);
      const setupFile = globSync([`resources/playbooks/${entry.id}.php`, `pro/modules/*/playbooks/${entry.id}.php`], { cwd: root }).map(file => resolve(root, file))[0];
      const designFile = globSync([`resources/templates/library/${entry.template_id}.json`, `pro/modules/*/templates/${entry.template_id}.json`], { cwd: root }).map(file => resolve(root, file))[0];
      if (hash(readFileSync(setupFile)) !== item.setup_hash || hash(readFileSync(designFile)) !== item.design_hash) throw new Error(`Stale collection dependency: ${item.setup_id}`);
      return { revision: entry.revision, record: approval.record?.record_id, current: approval.state === 'approved' };
    });
    return { ...collection, dependencies_current: dependencies.every(item => item.current), revision: hash(JSON.stringify([collection, dependencies])) };
  });
  const queue = reviewQueue(reviews, compiled.map(collection => ({ id: `collection-${collection.id}`, revision: collection.revision })), root);
  return { compiled: compiled.map((collection, at) => ({ ...collection, status: collection.dependencies_current && queue[at].state === 'approved' ? 'published' : 'draft' })), queue };
}

/** Check the shipped snapshot against fresh renderer-bound reviews, without publishing. */
export function collectionLabels(compiled) {
  const php = value => "'" + value.replaceAll('\\', '\\\\').replaceAll("'", "\\'") + "'";
  return "<?php\n// Generated from the reviewed collection source.\ndefined('ABSPATH') || exit;\nreturn [\n" + compiled.map(collection => `    ${php(collection.id)} => ['name' => __(${php(collection.name)}, 'wconvert'), 'description' => __(${php(collection.description)}, 'wconvert')],`).join('\n') + "\n];\n";
}

export function checkRuntimeCollections(root, compiled) {
  if (compiled.some(collection => collection.status !== 'published')) throw new Error('Collection or setup review is missing or stale');
  const destination = resolve(root, 'resources/collections');
  const expected = new Set(compiled.map(collection => `${collection.id}.json`));
  if (readdirSync(destination).some(file => file.endsWith('.json') && !expected.has(file))) throw new Error('Retire obsolete runtime collections explicitly');
  for (const collection of compiled) {
    if (readFileSync(resolve(destination, `${collection.id}.json`), 'utf8') !== JSON.stringify(collection, null, 2) + '\n') throw new Error(`Runtime collection differs from its reviewed revision: ${collection.id}`);
  }
  if (readFileSync(resolve(destination, 'labels.php'), 'utf8') !== collectionLabels(compiled)) throw new Error('Collection labels differ from their reviewed source');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
  const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const result = buildCollections(root, read('tools/design-library/collections/source.json'), read('tools/design-library/out/pilot.json'), read('tools/design-library/out/review-queue.json'), read('tools/design-library/review/shared-reviews.json'));
  const out = resolve(root, 'tools/design-library/out'); mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'collections-review.json'), JSON.stringify(result, null, 2) + '\n');
  if (process.argv.includes('--check')) checkRuntimeCollections(root, result.compiled);
  // Preview candidates stay in /tools until the shared review approves them.
  if (process.argv.includes('--publish')) {
    if (result.compiled.some(collection => collection.status !== 'published')) throw new Error('Review every collection revision before generating runtime data');
    const destination = resolve(root, 'resources/collections'); mkdirSync(destination, { recursive: true });
    const expected = new Set(result.compiled.map(collection => `${collection.id}.json`));
    if (readdirSync(destination).some(file => file.endsWith('.json') && !expected.has(file))) throw new Error('Retire obsolete runtime collections explicitly');
    for (const collection of result.compiled) writeFileSync(resolve(destination, `${collection.id}.json`), JSON.stringify(collection, null, 2) + '\n');
    // Generated literals let WordPress extract bundled collection translations.
    writeFileSync(resolve(destination, 'labels.php'), collectionLabels(result.compiled));
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

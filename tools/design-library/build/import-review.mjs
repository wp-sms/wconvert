import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECORDS, loadReviews, mergeReviews, reviewQueue, writeReviews } from './reviews.mjs';
import { buildCollections } from './collections.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const source = process.argv[2];
if (!source || process.argv.length !== 3) throw new Error('Usage: npm run templates:review -- /path/to/export.json');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
// Serialize local imports; across checkouts a fork in a record chain is refused on read.
const lock = resolve(root, RECORDS) + '.lock';
try { mkdirSync(lock); } catch (error) { if (error.code === 'EEXIST') throw new Error('Another review import holds the lock. Retry after it finishes.'); throw error; }
try {
  const store = loadReviews(root);
  const entries = read(resolve(root, 'tools/design-library/out/pilot.json'));
  const collections = buildCollections(root, read(resolve(root, 'tools/design-library/collections/source.json')), entries, reviewQueue(store, entries, root), store).compiled;
  const reviewable = [...entries, ...collections.map(collection => ({ id: `collection-${collection.id}`, revision: collection.revision }))];
  const next = mergeReviews(store, read(resolve(source)), reviewable, root);
  const written = writeReviews(root, store, next);
  console.log(`Imported ${written} review records. Commit the new record files and evidence together; rebuild the studio to display them.`);
} finally { rmSync(lock, { recursive: true }); }

import { readFileSync, writeFileSync, renameSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyReviews, mergeReviews, reviewQueue } from './reviews.mjs';
import { buildCollections } from './collections.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const source = process.argv[2];
if (!source || process.argv.length !== 3) throw new Error('Usage: npm run templates:review -- /path/to/export.json');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const target = resolve(root, 'tools/design-library/review/shared-reviews.json');
// Serialize local imports; Git handles cross-checkout conflicts in the review PR.
const lock = target + '.lock';
try { mkdirSync(lock); } catch (error) { if (error.code === 'EEXIST') throw new Error('Another review import holds the lock. Retry after it finishes.'); throw error; }
const temporary = target + `.${process.pid}.tmp`;
try {
  let store;
  try { store = read(target); } catch (error) { if (error.code !== 'ENOENT') throw error; store = emptyReviews(); }
  const entries = read(resolve(root, 'tools/design-library/out/pilot.json'));
  const collections = buildCollections(root, read(resolve(root, 'tools/design-library/collections/source.json')), entries, reviewQueue(store, entries, root), store).compiled;
  const reviewable = [...entries, ...collections.map(collection => ({ id: `collection-${collection.id}`, revision: collection.revision }))];
  const next = mergeReviews(store, read(resolve(source)), reviewable, root);
  writeFileSync(temporary, JSON.stringify(next, null, 2) + '\n', { flag: 'wx' });
  renameSync(temporary, target);
  console.log(`Imported ${next.records.length - store.records.length} review records. Commit the shared store and evidence together; rebuild the studio to display them.`);
} finally { rmSync(temporary, { force: true }); rmSync(lock, { recursive: true }); }

/**
 * Remove pages in `out/` that no current generator writes, so the folder holds
 * the studio and its on-demand tools rather than every past experiment.
 *
 * Keep this list in step with the generators: a page missing here is deleted.
 */
import { readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
const library = resolve(import.meta.dirname, '..');
const out = resolve(library, 'out');
const batches = JSON.parse(readFileSync(resolve(library, 'pilot/collection.json'), 'utf8')).batches.map(batch => batch.id);
const generated = new Set([
  'index', 'pilot', 'library-review', 'collection-studio', 'bench', // the four tabs
  'gallery', 'flagships', 'proof', 'control-proof', 'roadmap', 'starting-points', 'visual-diff',
  'collection-audit', 'queue-audit', ...batches.map(id => `${id}-audit`), // collection-audit.mjs, batch-audit.mjs
]);
const removed = readdirSync(out).filter(file => file.endsWith('.html')
  && !generated.has(file.slice(0, -5)) && !/^contact-sheet-\d+-(ltr|rtl)\.html$/.test(file));
for (const file of removed) unlinkSync(resolve(out, file));
console.log(`  removed ${removed.length} pages no generator writes${removed.length ? ': ' + removed.join(', ') : ''}`);

/** Review every prepared screen in one authored batch using the shared audit surface. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../..');
const out = resolve(root, 'tools/design-library/out');
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const batch = read('tools/design-library/pilot/collection.json').batches.find(item => item.id === process.argv[2]);
if (!batch) throw new Error('Pass an existing batch ID, for example: node tools/design-library/build/batch-audit.mjs practical-moments');
const entries = read('tools/design-library/out/pilot.json').filter(entry => entry.batch === batch.id);
if (!entries.length) throw new Error('Rebuild the pilot before reviewing this batch.');
const data = { title: batch.name, intro: 'Prepared campaign setups, every screen. Review four widths, both directions, visible consent and longer copy. These previews create no leads or messages.', entries, before: [], decisions: {} };
writeFileSync(resolve(out, `${batch.id}-audit.html`), readFileSync(resolve(root, 'tools/design-library/review/library.html'), 'utf8')
  .replace('/*__RENDERER__*/', () => readFileSync(resolve(out, 'renderer.iife.js'), 'utf8'))
  .replace('/*__DATA__*/', () => JSON.stringify(data).replaceAll('<', '\\u003c')));
console.log(`${batch.id}-audit.html: ${entries.length} prepared setups, every screen`);

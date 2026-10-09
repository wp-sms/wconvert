/** All prepared screens used by the curated collection release, with shipping controls. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../..'), out = resolve(root, 'tools/design-library/out');
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const ids = new Set(read('tools/design-library/collections/source.json').collections.flatMap(collection => collection.items.map(item => item.setup_id)));
const entries = read('tools/design-library/out/pilot.json').filter(entry => ids.has(entry.id));
if (entries.length !== ids.size) throw new Error('Every collection member must exist in the prepared pilot');
const data = { title: 'Prepared collection setups', intro: 'Exact prepared setups selected for the customer collections. Inspect every screen, four widths, both directions and longer copy. No capture, publication or provider delivery.', entries, before: [], decisions: {} };
writeFileSync(resolve(out, 'collection-audit.html'), readFileSync(resolve(root, 'tools/design-library/review/library.html'), 'utf8')
  .replace('/*__RENDERER__*/', () => readFileSync(resolve(out, 'renderer.iife.js'), 'utf8'))
  .replace('/*__DATA__*/', () => JSON.stringify(data).replaceAll('<', '\\u003c')));
console.log(`collection-audit.html — ${entries.length} prepared setups, every screen`);

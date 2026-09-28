import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readDesigns, analyseDesigns } from './inventory.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = process.env.WCONVERT_PLUGIN ?? resolve(here, '../../..');
const out = resolve(here, '../out');
const designs = readDesigns(root);
const inventory = analyseDesigns(designs);
const entries = JSON.parse(execFileSync('php', [resolve(here, 'pilot.php')], { encoding: 'utf8', env: { ...process.env, WCONVERT_PLUGIN: root } }));
const renderer = readFileSync(resolve(out, 'renderer.iife.js'), 'utf8');
const rendererRevision = createHash('sha256').update(renderer).digest('hex');
const seen = new Set();
for (const entry of entries) {
  if (seen.has(entry.id)) throw new Error(`Repeated campaign brief: ${entry.id}`);
  seen.add(entry.id);
  const design = inventory.find(item => item.id === entry.template_id);
  if (!design || !entry.visitor_need || !entry.difference || !entry.requirements.length || !entry.suggested_setup?.length || !entry.measure) throw new Error(`Incomplete brief: ${entry.id}`);
  entry.tier = design.tier;
  entry.nearest = design.nearest;
  entry.fingerprint = design.fingerprint;
  entry.revision = createHash('sha256').update(rendererRevision).update(JSON.stringify(entry)).digest('hex');
}
const data = { entries, inventory, designs, rendererRevision };
writeFileSync(resolve(out, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
writeFileSync(resolve(out, 'pilot.json'), JSON.stringify(entries, null, 2) + '\n');
writeFileSync(resolve(out, 'pilot.html'), readFileSync(resolve(here, '../pilot/review.html'), 'utf8')
  .replace('/*__RENDERER__*/', () => renderer)
  .replace('/*__DATA__*/', () => JSON.stringify(data).replaceAll('<', '\\u003c')));
console.log(`  pilot.html (${entries.length} actual campaign setups; ${inventory.length} indexed designs)`);

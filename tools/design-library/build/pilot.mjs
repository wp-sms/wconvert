import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readDesigns, analyseDesigns } from './inventory.mjs';
import { validateBriefs, coverage } from './briefs.mjs';
import { reviewQueue } from './reviews.mjs';
import { campaignRevision } from './revision.mjs';
import { maintenanceReport, editorialFindings } from './maintenance.mjs';
import { validateBacklog } from './backlog.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = process.env.WCONVERT_PLUGIN ?? resolve(here, '../../..');
const out = resolve(here, '../out');
const designs = readDesigns(root);
const inventory = analyseDesigns(designs);
const entries = JSON.parse(execFileSync('php', [resolve(here, 'pilot.php')], { encoding: 'utf8', env: { ...process.env, WCONVERT_PLUGIN: root } }));
const renderer = readFileSync(resolve(out, 'renderer.iife.js'), 'utf8');
const rendererRevision = createHash('sha256').update(renderer).digest('hex');
const collection = JSON.parse(readFileSync(resolve(root, 'tools/design-library/pilot/collection.json'), 'utf8'));
validateBriefs(collection, entries, designs);
for (const entry of entries) {
  const design = inventory.find(item => item.id === entry.template_id);
  if (!design || !entry.visitor_need || !entry.difference || !entry.requirements.length || !entry.suggested_setup?.length || !entry.measure) throw new Error(`Incomplete brief: ${entry.id}`);
  entry.nearest = design.nearest;
  entry.fingerprint = design.fingerprint;
  entry.revision = campaignRevision(entry, rendererRevision);
}
const sharedReviews = JSON.parse(readFileSync(resolve(root, 'tools/design-library/review/shared-reviews.json'), 'utf8'));
const queue = reviewQueue(sharedReviews, entries, root);
writeFileSync(resolve(out, 'review-queue.json'), JSON.stringify(queue, null, 2) + '\n');
const backlog = JSON.parse(readFileSync(resolve(root, 'tools/design-library/pilot/next-batch.json'), 'utf8'));
validateBacklog(backlog, entries);
const usage = JSON.parse(execFileSync('php', [resolve(here, 'pilot.php')], { encoding: 'utf8', env: { ...process.env, WCONVERT_PLUGIN: root, WCONVERT_EXPORT_USAGE: '1' } }));
const lifecycle = JSON.parse(readFileSync(resolve(root, 'tools/design-library/review/design-history.json'), 'utf8'));
const maintenance = maintenanceReport(designs, usage, entries, lifecycle);
const editorial = entries.flatMap(editorialFindings);
writeFileSync(resolve(out, 'maintenance.json'), JSON.stringify({ maintenance, editorial }, null, 2) + '\n');
const data = { maintenance, editorial, backlog, queue, entries, inventory, designs, rendererRevision, batches: collection.batches, coverage: coverage(entries) };
writeFileSync(resolve(out, 'coverage.json'), JSON.stringify(data.coverage, null, 2) + '\n');
writeFileSync(resolve(out, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
writeFileSync(resolve(out, 'pilot.json'), JSON.stringify(entries, null, 2) + '\n');
writeFileSync(resolve(out, 'pilot.html'), readFileSync(resolve(here, '../pilot/review.html'), 'utf8')
  .replace('/*__RENDERER__*/', () => renderer)
  .replace('/*__DATA__*/', () => JSON.stringify(data).replaceAll('<', '\\u003c')));
console.log(`  pilot.html (${entries.length} actual campaign setups; ${inventory.length} indexed designs)`);

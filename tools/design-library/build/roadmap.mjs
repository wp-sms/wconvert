import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readDesigns } from './inventory.mjs';
import { containerCss } from './containers.mjs';
import { visualAuditReport, validateDirections } from './visual-audit.mjs';
import { validateBacklog } from './backlog.mjs';

const root = process.env.WCONVERT_PLUGIN ?? resolve(import.meta.dirname, '../../..');
const base = resolve(root, 'tools/design-library');
const read = path => JSON.parse(readFileSync(resolve(base, path), 'utf8'));
containerCss();
const designs = readDesigns(root), entries = read('out/pilot.json');
const audit = read('review/visual-audit.json'), plan = read('pilot/next-batch.json');
const renderer = readFileSync(resolve(base, 'out/renderer.iife.js'), 'utf8');
const rendererRevision = createHash('sha256').update(renderer).digest('hex');
validateBacklog(plan, entries);
validateDirections(plan, audit.references, designs);
const data = { designs, entries, audit, plan, inventory: read('out/inventory.json'), maintenance: read('out/maintenance.json').maintenance,
  decisions: visualAuditReport(audit, designs, rendererRevision) };
writeFileSync(resolve(base, 'out/roadmap.json'), JSON.stringify(data, null, 2) + '\n');
writeFileSync(resolve(base, 'out/roadmap.html'), readFileSync(resolve(base, 'review/roadmap.html'), 'utf8')
  .replace('/*__RENDERER__*/', () => renderer)
  .replace('/*__DATA__*/', () => JSON.stringify(data).replaceAll('<', '\\u003c')));
console.log(`  roadmap.html (${designs.length} designs; ${plan.entries.length} planned briefs, excluded from library counts)`);

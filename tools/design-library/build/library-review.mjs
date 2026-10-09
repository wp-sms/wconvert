/** Full-library visual review; browser checks run through the page's own controls. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { containerCss } from './containers.mjs';
import { readDesigns } from './inventory.mjs';
import { visualAuditReport } from './visual-audit.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const plugin = process.env.WCONVERT_PLUGIN ?? resolve(here, '../../..');
const out = resolve(here, '../out');
containerCss(); // Fail if the shipping display geometry has changed.
const entries = readDesigns(plugin);
const baseline = process.env.WCONVERT_REVIEW_BASELINE;
const renderer = readFileSync(resolve(out, 'renderer.iife.js'), 'utf8');
const decisions = visualAuditReport(JSON.parse(readFileSync(resolve(here, '../review/visual-audit.json'), 'utf8')), entries, createHash('sha256').update(renderer).digest('hex'));
const data = { entries, before: baseline ? JSON.parse(readFileSync(baseline, 'utf8')) : [], decisions: Object.fromEntries(decisions.map(d => [d.id, { ...d, decision: d.current ? d.decision : 'Needs a fresh review' }])) };
writeFileSync(resolve(out, 'library-review.html'), readFileSync(resolve(here, '../review/library.html'), 'utf8')
  .replace('/*__RENDERER__*/', () => readFileSync(resolve(out, 'renderer.iife.js'), 'utf8'))
  .replace('/*__DATA__*/', () => JSON.stringify(data).replaceAll('<', '\\u003c')));
console.log(`  library-review.html (${entries.length} current designs, ${data.before.length} baseline designs)`);

/** Full-library visual review; browser checks run through the page's own controls. */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { containerCss } from './containers.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const plugin = process.env.WCONVERT_PLUGIN ?? resolve(here, '../../..');
const out = resolve(here, '../out');
containerCss(); // Fail if the shipping display geometry has changed.
const entries = ['resources/templates/library', 'pro/modules/display-types/templates'].flatMap(dir =>
  readdirSync(resolve(plugin, dir)).filter(name => name.endsWith('.json')).map(name => JSON.parse(readFileSync(resolve(plugin, dir, name), 'utf8'))));
const baseline = process.env.WCONVERT_REVIEW_BASELINE;
const decisionsPath = resolve(here, '../review/library-decisions.json');
const data = { entries, before: baseline ? JSON.parse(readFileSync(baseline, 'utf8')) : [], decisions: existsSync(decisionsPath) ? JSON.parse(readFileSync(decisionsPath, 'utf8')) : {} };
writeFileSync(resolve(out, 'library-review.html'), readFileSync(resolve(here, '../review/library.html'), 'utf8')
  .replace('/*__RENDERER__*/', () => readFileSync(resolve(out, 'renderer.iife.js'), 'utf8'))
  .replace('/*__DATA__*/', () => JSON.stringify(data).replaceAll('<', '\\u003c')));
console.log(`  library-review.html (${entries.length} current designs, ${data.before.length} baseline designs)`);

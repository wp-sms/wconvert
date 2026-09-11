/** The twelve complete starts, using the same review harness as the library. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { containerCss } from './containers.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../out');
containerCss();
const entries = JSON.parse(execFileSync('php', [resolve(here, 'starting-points.php')], { encoding: 'utf8' }));
const data = {
  title: 'Twelve considered starting points.',
  intro: 'Four for stores, four for publishers, four for services. These are the actual prefilled drafts, with both screens and setup notes. Brand names, valid codes and destination links are yours to add. Pictures are placeholders. This review sends no details and supplies all capabilities; the app checks your installed plan and plugins.',
  entries, before: [], decisions: {},
};
writeFileSync(resolve(out, 'starting-points.html'), readFileSync(resolve(here, '../review/library.html'), 'utf8')
  .replace('/*__RENDERER__*/', () => readFileSync(resolve(out, 'renderer.iife.js'), 'utf8'))
  .replace('/*__DATA__*/', () => JSON.stringify(data).replaceAll('<', '\\u003c')));
console.log(`  starting-points.html (${entries.length} prefilled starting points)`);

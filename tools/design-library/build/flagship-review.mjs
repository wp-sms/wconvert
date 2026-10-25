import { studioPage } from './studio-theme.mjs';
import { inlineArtwork } from './artwork-files.mjs';
/** A repeatable review of the first three flagship designs, using the shipping renderer. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../out');
const plugin = process.env.WCONVERT_PLUGIN ?? resolve(here, '../../..');
const ids = ['fieldwork', 'sunday-marginalia', 'callback-notes'];
const entries = ids.map((id) => inlineArtwork(JSON.parse(readFileSync(resolve(plugin, `resources/templates/library/${id}.json`), 'utf8')), plugin));
const template = studioPage(readFileSync(resolve(here, '../review/flagships.html'), 'utf8'), 'flagships');
const renderer = readFileSync(resolve(out, 'renderer.iife.js'), 'utf8');
writeFileSync(resolve(out, 'flagships.html'), template
  .replace('/*__RENDERER__*/', () => renderer)
  .replace('/*__ENTRIES__*/', () => JSON.stringify(entries).replaceAll('<', '\\u003c')));
console.log('  flagships.html (three designs, shipping renderer, local preview only)');

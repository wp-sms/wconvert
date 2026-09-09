/**
 * `bench.html` — the Design Bench, with everything it needs inlined.
 *
 * ============================================================================
 * THE RETURN PATH. `tools/design-system` IS ONE-WAY AND THIS IS NOT.
 * ============================================================================
 * That build pushes the admin's vocabulary OUT to a canvas and never reads
 * anything back, because a screen is code and the canvas is a picture of it. A
 * design is not: it is JSON, it has to come BACK, and the only way to know
 * whether it is any good is to watch the real renderer draw it.
 *
 * So the Bench takes a tree in, drives every token live, shows it in its real
 * container at three widths in both directions and against the shipping
 * themes, and hands the JSON back out.
 *
 * ============================================================================
 * EVERYTHING IS INLINED, AND THAT IS FORCED RATHER THAN TIDY.
 * ============================================================================
 * A published Artifact cannot load an external script outside its CDN
 * allowlist, so a `<script src>` pointing at the renderer would fail silently
 * and the page would render nothing with no error. Inlining also happens to be
 * what makes the file work from `file://` with no server.
 *
 * Three markers are replaced, and each one carries the SHIPPING thing rather
 * than a copy of it: the renderer bundle (which also carries the real theme
 * presets), the manifest's tokens and choices, and a real library entry as the
 * seed.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../out');
const PLUGIN = process.env.WCONVERT_PLUGIN ?? process.cwd();

const template = readFileSync(resolve(HERE, '../bench/bench.html'), 'utf8');
const renderer = readFileSync(resolve(OUT, 'renderer.iife.js'), 'utf8');
const manifest = JSON.parse(readFileSync(resolve(PLUGIN, 'resources/templates/manifest.json'), 'utf8'));

/**
 * The seed, which is a REAL entry off disk rather than a hand-written one.
 *
 * `split-hero` is the richest free design — two steps, a `split`, an image, a
 * field, a consent line and fine print — so the Bench opens showing every kind
 * of control it has rather than a blank page with one heading on it.
 */
const seed = JSON.parse(
  readFileSync(resolve(PLUGIN, 'resources/templates/library/split-hero.json'), 'utf8'),
);

const page = template
  .replace('/*__RENDERER__*/', () => renderer)
  .replace('/*__MANIFEST__*/', () => JSON.stringify({ tokens: manifest.tokens, choices: manifest.choices }))
  .replace('/*__SEED__*/', () => JSON.stringify(seed));

for (const marker of ['/*__RENDERER__*/', '/*__MANIFEST__*/', '/*__SEED__*/']) {
  if (page.includes(marker)) {
    throw new Error(`bench/bench.html still holds ${marker} — a published Bench with an unreplaced marker renders nothing and says nothing`);
  }
}

writeFileSync(resolve(OUT, 'bench.html'), page);

/*
 * The library, beside it, so a Bench session can paste in any shipped design
 * rather than only the seed. Written as JSON rather than inlined: the Bench is
 * an editor for ONE design at a time, and 40 trees in the page would be 40
 * trees downloaded to look at one.
 */
const entries = [
  resolve(PLUGIN, 'resources/templates/library'),
  ...readdirSync(resolve(PLUGIN, 'pro/modules'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(PLUGIN, 'pro/modules', entry.name, 'templates')),
].flatMap((library) => {
  try {
    return readdirSync(library)
      .filter((file) => file.endsWith('.json'))
      .map((file) => JSON.parse(readFileSync(resolve(library, file), 'utf8')));
  } catch {
    return [];
  }
});

writeFileSync(resolve(OUT, 'library.json'), JSON.stringify(entries, null, 2));

console.log(`  bench.html (${(page.length / 1024).toFixed(0)} kB inlined), library.json (${entries.length} entries)`);

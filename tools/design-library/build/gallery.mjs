/**
 * `gallery.html` — the whole library on one page, drawn by the real renderer.
 *
 * ============================================================================
 * THE THIRD VIEW, AND EACH OF THE THREE ANSWERS A DIFFERENT QUESTION.
 * ============================================================================
 * - The **contact sheets** answer *"are these forty designs or one design
 *   forty times?"* — they are PNGs, tiled, deliberately joyless, and they live
 *   on the disk of whoever ran the build.
 * - The **Bench** answers *"what would this design look like if I changed
 *   that?"* — one design, every token live, and a way back out to JSON.
 * - This answers *"where can I see the templates?"*, which is the question
 *   neither of those is any good at. It is a link you can send someone.
 *
 * Same inlining rule as the Bench, for the same reason: a published Artifact
 * cannot load an external script outside its CDN allowlist, so a `<script src>`
 * pointing at the renderer would fail silently and the page would render
 * nothing with no error anywhere.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { containerCss } from './containers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../out');
const PLUGIN = process.env.WCONVERT_PLUGIN ?? process.cwd();

const template = readFileSync(resolve(HERE, '../gallery/gallery.html'), 'utf8');
const renderer = readFileSync(resolve(OUT, 'renderer.iife.js'), 'utf8');

/** Free's one library, and every Pro module that keeps designs (ADR 0056). */
const libraries = [
  resolve(PLUGIN, 'resources/templates/library'),
  ...readdirSync(resolve(PLUGIN, 'pro/modules'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(PLUGIN, 'pro/modules', entry.name, 'templates')),
];

const designs = libraries
  .flatMap((library) => {
    try {
      return readdirSync(library)
        .filter((file) => file.endsWith('.json'))
        .map((file) => JSON.parse(readFileSync(resolve(library, file), 'utf8')));
    } catch {
      return [];
    }
  })
  /*
   * A `locked.json` stub has no tree by construction — shipping premium trees
   * in the free ZIP and refusing the save is trialware (issue #7). Nothing
   * reaches here without one, but a stub that did would draw an empty card,
   * which reads as a broken design rather than an absent one.
   */
  .filter((design) => design.tree !== undefined);

if (designs.length === 0) {
  throw new Error('no designs found — a gallery of nothing is worse than no gallery');
}

designs.sort(
  (a, b) =>
    a.display_type.localeCompare(b.display_type) ||
    (a.tier === 'free' ? 0 : 1) - (b.tier === 'free' ? 0 : 1) ||
    a.id.localeCompare(b.id),
);

const page = template
  .replace('/*__RENDERER__*/', () => renderer)
  .replace('/*__CONTAINERS__*/', () => containerCss())
  .replace(
    '/*__LIBRARY__*/',
    () =>
      JSON.stringify(
        designs.map(({ id, name, display_type, tier, tokens, tree }) => ({
          id,
          name,
          display_type,
          tier: tier ?? 'free',
          tokens,
          tree,
        })),
      ),
  );

for (const marker of ['/*__RENDERER__*/', '/*__LIBRARY__*/', '/*__CONTAINERS__*/']) {
  if (page.includes(marker)) {
    throw new Error(`gallery/gallery.html still holds ${marker} — a published gallery with an unreplaced marker renders nothing and says nothing`);
  }
}

writeFileSync(resolve(OUT, 'gallery.html'), page);

const free = designs.filter((design) => (design.tier ?? 'free') === 'free').length;

console.log(
  `  gallery.html (${(page.length / 1024).toFixed(0)} kB inlined, ${designs.length} designs — ${free} free, ${designs.length - free} Pro)`,
);

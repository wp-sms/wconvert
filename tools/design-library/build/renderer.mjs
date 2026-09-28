/**
 * `renderer.iife.js` — the shipping renderer and the shipping themes, in a
 * form a blank page can load.
 *
 * ============================================================================
 * THE ONE THING THAT MAKES THIS CAPTURE SIMPLER THAN THE ADMIN'S.
 * ============================================================================
 * `tools/design-system` boots Playground, seeds a WordPress, filters
 * `rest_pre_dispatch` and resolves wp-admin stylesheets against a candidate
 * list — because its subject is a React admin that only exists inside a
 * running install.
 *
 * Ours is not. `resources/renderer/src` is four files that import nothing but
 * their own types, and `render(tree, tokens, step)` asks nothing of the
 * document it will be attached to, nothing of the site, and nothing of the
 * Optin. So a card is a blank page, this bundle, a tree and a token map —
 * **no WordPress at all**, and none of that README's traps apply.
 *
 * An IIFE rather than an ES module, for two reasons that happen to agree. A
 * `file://` page cannot load an ES module without a server, which the capture
 * would then have to run; and an Artifact cannot load any external script
 * outside its CDN allowlist, so the Bench has to INLINE this file — and an
 * inlined `<script type="module">` inside a published page is a second set of
 * rules to remember. One global, `WConvertRenderer`, works in both.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../out');
const PLUGIN = process.env.WCONVERT_PLUGIN ?? process.cwd();

/*
 * Written rather than kept as a file in the repo: it is three lines that exist
 * only to name the bundle's surface, and a file for it would be a fifth thing
 * to keep in step with `mount.ts`'s exports.
 */
const entry = resolve(OUT, 'renderer-entry.ts');

writeFileSync(
  entry,
  [
    `export { render } from '${resolve(PLUGIN, 'resources/renderer/src/mount')}';`,
    `import { mountedStyles } from '${resolve(PLUGIN, 'resources/renderer/src/css')}';`,
    `import { registerPremiumJourneyRenderer } from '${resolve(PLUGIN, 'pro/modules/journeys/loader/render')}';`,
    `registerPremiumJourneyRenderer();`,
    `export const SHADOW_CSS = mountedStyles();`,
    `export { chooseResult, journeyTrace } from '${resolve(PLUGIN, 'resources/loader/src/journey-rules')}';`,
    `export { decorateFullscreen } from '${resolve(PLUGIN, 'pro/modules/display-types/loader/surface')}';`,
    /*
     * The themes ride along so the Bench switches between the SHIPPING presets
     * rather than a copy of them — the same reason the renderer is bundled
     * rather than reimplemented. `themes.ts` builds its labels at render
     * through `__()`, so the shim below is all it needs from WordPress.
     */
    `export { themePresets } from '${resolve(PLUGIN, 'resources/admin/src/builder/themes')}';`,
    '',
  ].join('\n'),
);

/*
 * `@wordpress/i18n` is a real dependency of the admin and is not one of a
 * blank page. Aliasing it to an identity `__()` keeps the presets' English
 * labels, which is the only locale a design tool has.
 */
const i18nShim = resolve(OUT, 'i18n-shim.js');

writeFileSync(i18nShim, 'export const __ = (text) => text;\n');

const result = await build({
  root: resolve(HERE, '..'),
  logLevel: 'warn',
  // Review the visitor renderer, including its stripped editing metadata.
  define: { __WCONVERT_VISITOR__: 'true' },
  resolve: {
    alias: {
      '@renderer': resolve(PLUGIN, 'resources/renderer/src'),
      '@wordpress/i18n': i18nShim,
    },
  },
  build: {
    outDir: OUT,
    emptyOutDir: false,
    lib: {
      entry,
      name: 'WConvertRenderer',
      formats: ['iife'],
      fileName: () => 'renderer.iife.js',
    },
    // Readable on purpose. This is a design tool, and the one question worth
    // asking of a card that came out wrong is what the renderer actually did.
    minify: false,
  },
});

const bytes = result?.[0]?.output?.[0]?.code?.length ?? 0;

console.log(`  renderer.iife.js (${(bytes / 1024).toFixed(1)} kB, unminified)`);

import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;

/**
 * The five editor packages this block imports and never carries.
 *
 * ============================================================================
 * `external` + `output.globals`, WHICH IS THE MECHANISM THE ADMIN CANNOT USE.
 * ============================================================================
 * `vite.config.admin.mjs` argues at length that an external in an ES build is
 * emitted as a bare specifier no browser can resolve, and replaces the globals
 * map with a shim module per package. **None of that applies here**, because
 * this bundle is an `iife`: Rollup drops the import and reads `wp.blocks` off
 * the window at the call site, natively, which is the plain mechanism the
 * admin lost when it had to code-split. The block has one screen's worth of
 * code and nothing to split, so it keeps the simpler half.
 *
 * **They must stay external, and only one of the five reasons is size.**
 * `wp.element` IS the editor's React, and a second copy of it bundled here
 * would render `<Placeholder>` — built against WordPress's copy — through
 * hooks belonging to a React that never rendered it, which is the *"Invalid
 * hook call"* the admin bundle's own comments were written after. `wp.i18n`
 * has the quieter version of the same problem: a second `__()` reads an empty
 * catalogue, so every string ships English on a translated site with nothing
 * to say why.
 */
const WORDPRESS_GLOBALS = {
  '@wordpress/data': 'wp.data',
  '@wordpress/compose': 'wp.compose',
  '@wordpress/api-fetch': 'wp.apiFetch',
  '@wordpress/blocks': 'wp.blocks',
  '@wordpress/block-editor': 'wp.blockEditor',
  '@wordpress/components': 'wp.components',
  '@wordpress/element': 'wp.element',
  '@wordpress/i18n': 'wp.i18n',
};

/**
 * The block editor's authoring surface for placing an `inline` Optin.
 *
 * A sixth Vite config rather than a sixth entry on an existing one, for the
 * reason `vite.loader-config.mjs` gives about the inspector: every build here
 * sets `emptyOutDir`, so two artifacts sharing an output directory leave
 * whichever ran last as the only survivor. `public/blocks/` is its own.
 *
 * It carries NO byte budget. The 8,192 bytes the loader is held to are what
 * every visitor of every matching page downloads; this is fetched by one
 * authenticated person who has opened the post editor, after WordPress has
 * already sent them the whole block editor.
 */
export default defineConfig({
  // There is no static asset directory to copy; without this Vite treats the
  // plugin's public/ build root as one and warns that it overlaps outDir.
  publicDir: false,
  // The campaign picker is free code that Pro's content lock blocks import
  // (`vite.config.block-pro.mjs` spreads this config), spelled as in
  // tsconfig.json and vitest.config.ts.
  resolve: {
    alias: { '@block': resolve(root, 'resources/blocks/inline-optin/src') },
  },
  esbuild: {
    /*
     * ========================================================================
     * THE CLASSIC JSX RUNTIME, DELIBERATELY, AND IT IS NOT A STYLE CHOICE.
     * ========================================================================
     * The automatic runtime compiles JSX to an import from
     * `react/jsx-runtime`, which imports `react` — so the bundle would carry a
     * SECOND React beside the editor's own, and every `wp.components` element
     * rendered through it would throw on its first hook. WordPress registers a
     * `react-jsx-runtime` script exposing that module on a global, which would
     * also solve it on the supported WordPress 6.8+ range. The existing
     * classic JSX transform remains a direct reference to WordPress React.
     *
     * So JSX compiles to `wp.element.createElement`, which is WordPress's own
     * React and has been on every install since 5.0. `tsconfig.json` keeps
     * `react-jsx` for the whole tree — `tsc` only typechecks, and the admin
     * bundle genuinely uses the automatic runtime.
     */
    /*
     * `jsx: 'transform'` is NOT redundant beside the factory below, and the
     * build says nothing when it is left out. esbuild reads `tsconfig.json`
     * for a `.tsx` file, finds `"jsx": "react-jsx"`, and that WINS over a
     * factory — so the automatic runtime ran anyway, `createElement` was
     * imported and never used, and **React 19 was bundled**: 35 kB, and a
     * second React under every `wp.components` element. The only symptom was
     * a Rollup warning about an unused import.
     */
    jsx: 'transform',
    jsxFactory: 'createElement',
    jsxFragment: 'Fragment',
    jsxInject: "import { createElement, Fragment } from '@wordpress/element'",
  },
  build: {
    outDir: resolve(root, 'public/blocks'),
    emptyOutDir: true,
    target: 'es2020',
    minify: 'terser',
    lib: {
      entry: resolve(root, 'resources/blocks/inline-optin/src/index.tsx'),
      formats: ['iife'],
      name: 'wconvertInlineOptinBlock',
      fileName: () => 'inline-optin.js',
      cssFileName: 'inline-optin',
    },
    rollupOptions: {
      external: Object.keys(WORDPRESS_GLOBALS),
      output: { globals: WORDPRESS_GLOBALS },
      /*
       * **A name WordPress does not put on the global is a build failure, not
       * a warning.** `resources/blocks/inline-optin/src/wordpress.d.ts` spells
       * these packages' surfaces by hand, so the way this goes wrong is an
       * import of something that was never declared — which Rollup reports as
       * a warning and then emits as `undefined`, giving an editor that loads
       * and a component that is not there. Copied from the admin config, which
       * has the same hazard for the same reason.
       */
      onwarn(warning, warn) {
        if (warning.code === 'MISSING_EXPORT') {
          throw new Error(warning.message);
        }

        // `jsxInject` above imports `Fragment` beside `createElement` into
        // every file, and a file with no `<>` in it does not use it. Silenced
        // rather than dropped from the inject: a fragment is one keystroke
        // away in any of these components, and its absence would surface as
        // `Fragment is not defined` at runtime in the editor rather than as
        // anything a build says.
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') {
          return;
        }

        warn(warning);
      },
    },
  },
});

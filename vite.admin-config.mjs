import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

/**
 * The two WordPress packages this bundle imports and never carries.
 *
 * ============================================================================
 * THEY WERE IIFE GLOBALS, AND AN IIFE CANNOT CODE-SPLIT.
 * ============================================================================
 * `rollupOptions.external` plus `output.globals` is the IIFE mechanism: Rollup
 * drops the import and reads `wp.i18n` off the window at the call site. It has
 * no ES equivalent — an external in an ES build is emitted as
 * `import { __ } from "@wordpress/i18n"`, a bare specifier no browser can
 * resolve and no import map here can supply, because WordPress ships these as
 * CLASSIC scripts rather than as script modules. So the split this bundle now
 * makes (ADR 0038, [#73](https://github.com/navidkashani/wconvert/issues/73))
 * needed the format to change, and the format change needed this.
 *
 * **They must stay external either way**, and the reason is not size. WordPress
 * ships both, and `wp_set_script_translations()` loads its catalogue into the
 * `wp.i18n` WordPress provides — a second copy bundled here would be a second
 * `__()` reading an empty catalogue, so every string would render in English on
 * a translated site and nothing would say why.
 *
 * What replaces the globals map is a module per package whose whole body reads
 * the global back out, so the import stays an import and the code that runs is
 * still WordPress's. Named exports are the package's whole public surface
 * rather than the three this bundle happens to use today, and a fourth arriving
 * needs no edit here.
 */
const WORDPRESS_MODULES = {
  '@wordpress/i18n': {
    global: 'wp.i18n',
    named: [
      '__',
      '_n',
      '_nx',
      '_x',
      'createI18n',
      'defaultI18n',
      'getLocaleData',
      'hasTranslation',
      'isRTL',
      'resetLocaleData',
      'setLocaleData',
      'sprintf',
      'subscribe',
    ],
    hasDefault: false,
  },
  '@wordpress/api-fetch': {
    global: 'wp.apiFetch',
    named: [],
    // `apiFetch` is a callable default export and has no named surface.
    hasDefault: true,
  },
};

/**
 * Resolve the two WordPress packages to a shim that reads WordPress's own copy.
 *
 * Deliberately NOT `rollupOptions.external`: an external id reaches the output
 * as a bare specifier (see above), and this has to reach it as something a
 * browser can execute. The effect on what ships is identical — no `@wordpress`
 * source is bundled, and both packages stay dependencies of the enqueued handle
 * so WordPress loads them first.
 *
 * Destructured once at module scope rather than proxied per call: both packages
 * hand out closures over their own state (`createI18n` returns bound methods),
 * so a detached `__` is the same `__`, and `wp-i18n` is a declared dependency of
 * this script so it has always run by the time this evaluates.
 */
function wordpressGlobals() {
  const PREFIX = '\0wconvert:wordpress/';

  return {
    name: 'wconvert:wordpress-globals',
    // **Before Vite's own resolver, or this never runs.** `vite:resolve` is a
    // core plugin and core plugins are ordered ahead of user plugins with no
    // `enforce`, so without this both specifiers resolve to `node_modules`
    // and both packages are bundled — a silent 42 kB and a second `__()`
    // reading an empty catalogue.
    enforce: 'pre',
    resolveId(id) {
      return Object.hasOwn(WORDPRESS_MODULES, id) ? PREFIX + id : null;
    },
    load(id) {
      if (!id.startsWith(PREFIX)) {
        return null;
      }

      const { global, named, hasDefault } = WORDPRESS_MODULES[id.slice(PREFIX.length)];
      const lines = [`const provided = window.${global};`];

      if (named.length > 0) {
        lines.push(`const { ${named.join(', ')} } = provided;`);
        lines.push(`export { ${named.join(', ')} };`);
      }

      if (hasDefault) {
        lines.push('export default provided;');
      }

      return lines.join('\n');
    },
  };
}

/**
 * Print what each half of the admin costs, every build (ADR 0038).
 *
 * **It reports and does not gate**, which is the whole decision. The loader's
 * 8,192 bytes are paid by every visitor on every page view of every install,
 * so a hard gate there is proportionate to an unbounded cost. This bundle is
 * paid by one authenticated person on one screen, after WordPress has already
 * loaded its own admin payload — and a gate on that has a predictable life:
 * it blocks a feature somebody needs, the number is raised to unblock it, and
 * after the second raise it is a formality nobody reads. A gate that will be
 * raised on demand launders the decision it pretends to make.
 *
 * What survives is measurement without enforcement: the number lands in the
 * build log and therefore in the pull request that moved it, and a person
 * decides. Gzip at level 9 rather than Vite's own reporter so the figure is
 * one total across script AND stylesheet — a byte moved from the bundle into
 * the stylesheet is not a byte saved.
 *
 * **Two totals since #73, because one no longer answers the question.** The
 * entry and the stylesheet are what a merchant checking yesterday's leads
 * downloads; the builder chunk is fetched only by someone who opens the
 * builder. A single figure across both would report the pessimistic number as
 * though everyone paid it, which is exactly the claim the split exists to stop
 * being true. The classification is the build's own — an entry chunk and its
 * assets load with the page, a dynamically imported chunk does not — so a
 * second boundary added later reports itself without this being edited.
 */
function reportBundleSize() {
  return {
    name: 'wconvert:report-bundle-size',
    apply: 'build',
    writeBundle(_options, bundle) {
      const rows = Object.values(bundle)
        .map((chunk) => ({
          name: chunk.fileName,
          // An entry chunk and every emitted asset are enqueued by PHP and
          // arrive with the screen; anything else is here because something
          // `import()`ed it.
          eager: chunk.type === 'asset' || chunk.isEntry === true,
          gzipped: gzipSync(chunk.type === 'chunk' ? chunk.code : chunk.source, { level: 9 }).length,
        }))
        .sort((a, b) => b.gzipped - a.gzipped);

      const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
      const sum = (of) => of.reduce((total, row) => total + row.gzipped, 0);

      this.info('admin bundle, gzipped:');

      const half = (label, note, of) => {
        if (of.length === 0) {
          return;
        }

        for (const row of of) {
          this.info(`  ${row.name.padEnd(22)} ${kb(row.gzipped).padStart(9)}`);
        }

        this.info(`  ${label.padEnd(22)} ${kb(sum(of)).padStart(9)}  (${sum(of)} bytes — ${note})`);
      };

      half(
        'EVERY SCREEN',
        'reported, not gated',
        rows.filter((row) => row.eager),
      );
      half(
        'ON DEMAND',
        'only if the builder is opened',
        rows.filter((row) => !row.eager),
      );
    },
  };
}

/**
 * Shared shape for the two admin builds.
 *
 * ============================================================================
 * THERE ARE TWO, ONE PER PLUGIN, AND THEY WRITE TO SEPARATE DIRECTORIES.
 * ============================================================================
 * [[Pro]] ships a COMPLETE replacement admin bundle — free's screens plus its
 * own, composed in Pro's entry where the bundler can see them — and dequeues
 * free's in PHP (ADR 0014, extended to the admin). That is the arrangement
 * `vite.loader-config.mjs` already describes one bundle over, for the same
 * reason: augmenting would mean a second script injecting React into free's
 * running app, which needs the two to agree about load order, and a load-order
 * contract is a promise the page is not ours to keep (ADR 0004).
 *
 * **What differs between them is the entry and the output directory. Nothing
 * else does**, and in particular there is no mode flag — the difference is
 * which screens their entries import, decided in source (ADR 0028).
 *
 * WSMS's `main.js` trap — two configs sharing one output path with
 * `emptyOutDir: true`, last build silently wins — is impossible here rather
 * than merely avoided: the two outputs sit inside two different plugin
 * directories, because free and Pro are two plugins.
 *
 * The COST is a second copy of the admin app in Pro's ZIP, and it is booked
 * rather than solved: WP Statistics ships 3.3 MB per tier. What it buys is
 * that a Pro install runs ONE React app, which is the only shape that cannot
 * fail on load order.
 *
 * @param {{ entry: string, outDir: string }} options
 */
export function adminConfig({ entry, outDir }) {
  return defineConfig({
    plugins: [react(), tailwindcss(), wordpressGlobals(), reportBundleSize()],
    resolve: {
      alias: {
        // The same renderer the loader imports. Gallery cards and previews
        // render the real template, so there are no static thumbnails to go
        // stale (ADR 0010).
        '@renderer': resolve(import.meta.dirname, 'resources/renderer/src'),
        // What shadcn's CLI writes its imports against (ADR 0036). The alias is
        // the admin's own source root and nothing wider, so a vendored component
        // cannot reach the loader or the renderer through it.
        '@': resolve(import.meta.dirname, 'resources/admin/src'),
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    root: 'resources/admin',
    publicDir: false,
    // Relative, so a dynamically imported chunk is fetched against the URL of the
    // module that imported it — the entry in `public/admin/` — rather than against a
    // site root this build cannot know. WordPress installs live in
    // subdirectories, behind multisite path rewrites and on domains that are not
    // the one this was built on.
    base: './',
    build: {
        outDir: resolve(import.meta.dirname, outDir),
      emptyOutDir: true,
      // One stylesheet, loaded with the page. Splitting it would put the
      // builder's rules behind the chunk and repaint the screen on open, and
      // Tailwind emits one sheet for the whole tree anyway.
      cssCodeSplit: false,
      // **No `<link rel="modulepreload">`, because nothing here writes the HTML.**
      // The preload helper exists to warm a chunk's dependencies from a document
      // Vite generated; this bundle is enqueued by WordPress into a page Vite
      // never sees, so the helper would ship a polyfill for a tag that is never
      // emitted. The one chunk is fetched by a native `import()` when it is
      // wanted, which is the whole point of the boundary.
      modulePreload: false,
      rollupOptions: {
        // **An application entry, NOT `build.lib`.** Lib mode is for a package
        // somebody else bundles, and it carries a rule that is wrong here: Vite
        // deliberately skips whitespace minification for an ES lib build, since
        // stripping it would remove the `/*#__PURE__*/` annotations a consumer's
        // tree-shaker reads. Nothing consumes this — it is enqueued and run —
        // and the exemption cost 34 kB gzipped when the format first moved off
        // `iife`. An input plus an output format is the same build without it.
          input: resolve(import.meta.dirname, entry),
        output: {
          format: 'es',
          // ====================================================================
          // BOTH FILES ARE HASHED, AND THE ENTRY CARRIES NO `?ver` QUERY.
          // ====================================================================
          // A chunk is fetched by the browser from a URL no PHP writes, so a
          // file name is the only place a rebuild can tell a cache the bytes
          // changed. That part is ordinary. What is not ordinary is that the
          // ENTRY has to be hashed for the same reason, and it is a correctness
          // problem rather than a caching one:
          //
          // `builder-*.js` imports React and the shared components from the
          // entry, as `./main.js`, relative to its own URL. WordPress enqueued
          // the entry as `main.js?ver=<mtime>` ({@see BuiltAsset}), and to a
          // browser **those are two different modules**. React was evaluated
          // twice, and the builder's first `useState` threw *"Invalid hook
          // call"* against a second copy of React it had never rendered with.
          // The screen went blank; every test still passed.
          //
          // So there is exactly one URL for the entry, it has no query on it,
          // and its own cache is busted by its name. `ViteHelper` globs for both
          // patterns and enqueues the entry with no version at all — the two
          // halves of that are commented against each other.
          entryFileNames: 'main-[hash].js',
          chunkFileNames: 'builder-[hash].js',
          assetFileNames: 'main[extname]',
        },
        // **A name the shim does not export is a build failure, not a warning.**
        // `wordpressGlobals()` spells @wordpress/i18n's surface by hand, so the
        // way it goes wrong is an import of something it forgot — which Rollup
        // reports as a warning and then emits as `undefined`, giving a screen
        // that renders and a function that is not there.
        onwarn(warning, warn) {
          if (warning.code === 'MISSING_EXPORT') {
            throw new Error(warning.message);
          }

          warn(warning);
        },
      },
    },
  });
}

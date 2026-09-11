import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;

/**
 * Shared shape for the two loader builds.
 *
 * There are two, one per plugin, and they write to SEPARATE output directories
 * — free's into the free plugin, Pro's into Pro's. That separation is by
 * construction rather than by discipline: the two artifacts are two plugins,
 * so the `emptyOutDir` trap where the last build silently wins cannot arise
 * (ADR 0014).
 *
 * What differs between them is the entry and the output directory. Nothing
 * else does, and in particular there is no mode flag — the difference between
 * the free loader and Pro's is which modules their entries import, decided in
 * source, not by a build-time branch (ADR 0028).
 *
 * ============================================================================
 * THE ELIGIBILITY INSPECTOR IS A THIRD AND FOURTH BUILD THROUGH THIS SAME
 * FACTORY, AND IT WRITES TO A DIRECTORY OF ITS OWN.
 * ============================================================================
 * It composes the same modules and calls the same `decide()`, so it is the
 * same kind of artifact — but `emptyOutDir` is true here, which means two
 * builds sharing an output directory would leave whichever ran last as the
 * only survivor. `public/inspector/` rather than a second file beside the
 * loader is what makes that impossible rather than order-dependent, exactly as
 * the two plugins' separate directories already do (ADR 0014).
 *
 * It carries NO byte budget, and that is not an oversight: the 8KB limit is
 * about what every visitor of every matching page downloads, and this is
 * enqueued only for an administrator who asked for it by name.
 *
 * @param {{ entry: string, outDir: string, name: string, fileName?: string }} options
 */
export function loaderConfig({ entry, outDir, name, fileName = 'loader.js' }) {
  return defineConfig({
    // There is no static asset directory to copy; without this Vite treats the
    // plugin's public/ build root as one and warns that it overlaps outDir.
    publicDir: false,
    resolve: {
      alias: {
        // Free's loader tree, so Pro's entry can name it readably. There is
        // deliberately NO alias pointing into pro/: free's tree has no reason
        // to reach that way, and an alias would be a second spelling of a path
        // the source contract scans for.
        '@loader': resolve(root, 'resources/loader/src'),
        // The template renderer, which BOTH the loader and the admin import.
        // It is dependency-free precisely so that two bundles can share it
        // without React reaching the loader's byte budget (ADR 0010).
        '@renderer': resolve(root, 'resources/renderer/src'),
      },
    },
    build: {
      outDir: resolve(root, outDir),
      emptyOutDir: true,
      target: 'es2020',
      lib: {
        entry: resolve(root, entry),
        formats: ['iife'],
        name,
        fileName: () => fileName,
      },
      minify: 'terser',
      // Keep shared helpers compact in the gzipped visitor payload.
      terserOptions: { compress: { passes: 3, hoist_funs: true, inline: 1 } },
      // The loader is subject to a hard 8KB gzipped budget, per build
      // (ADR 0014, ADR 0029). Nothing asserts that here: the assertion is
      // `npm run check:loader`, and it lands with the rule manifest whose
      // premium identifiers it also scans for. Nothing is written before its
      // subject (ADR 0029).
    },
  });
}

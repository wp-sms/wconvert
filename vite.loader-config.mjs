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
 * @param {{ entry: string, outDir: string, name: string }} options
 */
export function loaderConfig({ entry, outDir, name }) {
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
        fileName: () => 'loader.js',
      },
      minify: 'terser',
      // The loader is subject to a hard 8KB gzipped budget, per build
      // (ADR 0014, ADR 0029). Nothing asserts that here: the assertion is
      // `npm run check:loader`, and it lands with the rule manifest whose
      // premium identifiers it also scans for. Nothing is written before its
      // subject (ADR 0029).
    },
  });
}

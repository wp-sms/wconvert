import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

/**
 * Print the admin bundle's gzipped size, every build (ADR 0038).
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
 */
function reportBundleSize() {
  return {
    name: 'wconvert:report-bundle-size',
    apply: 'build',
    writeBundle(_options, bundle) {
      const rows = Object.values(bundle)
        .map((chunk) => ({
          name: chunk.fileName,
          gzipped: gzipSync(chunk.type === 'chunk' ? chunk.code : chunk.source, { level: 9 }).length,
        }))
        .sort((a, b) => b.gzipped - a.gzipped);

      const total = rows.reduce((sum, row) => sum + row.gzipped, 0);
      const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

      this.info('admin bundle, gzipped:');

      for (const row of rows) {
        this.info(`  ${row.name.padEnd(10)} ${kb(row.gzipped).padStart(9)}`);
      }

      this.info(`  ${'TOTAL'.padEnd(10)} ${kb(total).padStart(9)}  (${total} bytes — reported, not gated)`);
    },
  };
}

/**
 * The free admin bundle.
 *
 * Pro has no admin bundle of its own yet; when it gains one it gets its own
 * config writing to its own plugin directory, never this output path.
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), reportBundleSize()],
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
  base: './',
  build: {
    outDir: resolve(import.meta.dirname, 'public/admin'),
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, 'resources/admin/src/main.tsx'),
      formats: ['iife'],
      name: 'wconvertAdmin',
      fileName: () => 'main.js',
    },
    cssCodeSplit: false,
    rollupOptions: {
      // WordPress already ships these, and wp_set_script_translations() only
      // works against the wp.i18n it provides.
      external: ['@wordpress/i18n', '@wordpress/api-fetch'],
      output: {
        assetFileNames: 'main[extname]',
        globals: {
          '@wordpress/i18n': 'wp.i18n',
          '@wordpress/api-fetch': 'wp.apiFetch',
        },
      },
    },
  },
});

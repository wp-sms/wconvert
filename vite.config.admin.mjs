import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * The free admin bundle.
 *
 * Pro has no admin bundle of its own yet; when it gains one it gets its own
 * config writing to its own plugin directory, never this output path.
 */
export default defineConfig({
  plugins: [react()],
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

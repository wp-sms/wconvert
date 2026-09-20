import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@loader': resolve(import.meta.dirname, 'resources/loader/src'),
      '@renderer': resolve(import.meta.dirname, 'resources/renderer/src'),
      '@': resolve(import.meta.dirname, 'resources/admin/src'),
      '@block': resolve(import.meta.dirname, 'resources/blocks/inline-optin/src'),
      /*
       * The two editor packages the block imports and this repo does not
       * install (`resources/blocks/inline-optin/src/wordpress.d.ts` says why).
       * Aliased rather than `vi.mock()`ed: Vite resolves a specifier during
       * import-analysis, before any mock is applied, so mocking a module that
       * is not on disk fails at transform time.
       *
       * `@wordpress/i18n` is deliberately absent from this list — it IS
       * installed, the admin bundle imports it for real, and an alias would
       * replace it for the whole suite.
       */
      '@wordpress/element': 'react',
      '@wordpress/block-editor': resolve(import.meta.dirname, 'tests/js/support/wp-block-editor.tsx'),
      '@wordpress/components': resolve(import.meta.dirname, 'tests/js/support/wp-components.tsx'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/js/setup.ts'],
    // Pro's tests live under pro/, never under resources/ — so a test that
    // imports a Pro module cannot itself become the free-tree import that
    // bin/verify-source-contract.sh exists to catch.
    include: ['tests/js/**/*.test.{ts,tsx}', 'pro/tests/js/**/*.test.{ts,tsx}'],
    css: false,
  },
});

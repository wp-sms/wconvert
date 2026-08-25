import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@loader': resolve(import.meta.dirname, 'resources/loader/src'),
      '@renderer': resolve(import.meta.dirname, 'resources/renderer/src'),
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

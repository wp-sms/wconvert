import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  publicDir: false,
  resolve: { alias: { '@loader': resolve('resources/loader/src'), '@renderer': resolve('resources/renderer/src') } },
  build: { target: 'es2020', lib: { entry: 'pro/modules/cart-recovery/loader/context.ts', formats: ['es'], fileName: () => 'commerce.js' },
    outDir: 'pro/modules/cart-recovery/public', emptyOutDir: true, minify: 'terser', terserOptions: { compress: { passes: 3 } } },
});

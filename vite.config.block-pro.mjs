import config from './vite.config.block.mjs';
import { resolve } from 'node:path';

export default {
  ...config,
  build: {
    ...config.build,
    outDir: resolve(import.meta.dirname, 'pro/public/blocks'),
    lib: {
      entry: resolve(import.meta.dirname, 'pro/modules/content-lock/block/index.tsx'),
      formats: ['iife'], name: 'wconvertContentLockBlock', fileName: () => 'content-lock.js',
    },
  },
};

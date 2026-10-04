import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', testMatch: 'commerce.spec.mjs', workers: 1, timeout: 60000, expect: { timeout: 15000 }, outputDir: './out/commerce', use: { baseURL: 'http://127.0.0.1:9431', browserName: 'chromium' } });

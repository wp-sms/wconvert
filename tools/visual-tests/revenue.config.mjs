import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', testMatch: 'revenue.spec.mjs', workers: 1, timeout: 60000, expect: { timeout: 15000 }, outputDir: './out/revenue', use: { baseURL: 'http://127.0.0.1:9442', browserName: 'chromium' } });

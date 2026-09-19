import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.mjs',
  fullyParallel: false,
  workers: 1, // One SQLite writer; every scenario gets a fresh browser context.
  retries: 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  outputDir: './out/results',
  reporter: [['list'], ['html', { outputFolder: 'tools/visual-tests/out/report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:9413', browserName: 'chromium' },
  webServer: {
    command: 'npm run visual:serve',
    url: 'http://127.0.0.1:9413/wp-login.php',
    timeout: 180000,
    reuseExistingServer: false, // A populated developer site is never a test fixture.
  },
});

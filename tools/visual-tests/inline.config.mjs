import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'inline.spec.mjs',
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  outputDir: './out/inline',
  reporter: [['list'], ['html', { outputFolder: './out/inline-report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:9415', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command: 'WCONVERT_VISUAL_PRO=1 WCONVERT_VISUAL_INLINE=1 node tools/visual-tests/server.mjs',
    url: 'http://127.0.0.1:9415/wp-login.php',
    timeout: 180000,
    reuseExistingServer: false,
  },
});

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'events.spec.mjs', workers: 1,
  timeout: 60000, expect: { timeout: 10000 },
  outputDir: './out/events',
  use: { baseURL: 'http://127.0.0.1:9414', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    cwd: new URL('../..', import.meta.url).pathname,
    command: 'WCONVERT_VISUAL_PRO=1 node tools/visual-tests/server.mjs',
    url: 'http://127.0.0.1:9414/wp-login.php', timeout: 180000,
    reuseExistingServer: false,
  },
});

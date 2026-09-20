import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'popup.spec.mjs', workers: 1,
  timeout: 60000, expect: { timeout: 10000 },
  outputDir: './out/popup',
  use: { baseURL: 'http://127.0.0.1:9416', browserName: 'chromium' },
  webServer: {
    cwd: new URL('../..', import.meta.url).pathname,
    command: 'WCONVERT_VISUAL_POPUP=1 node tools/visual-tests/server.mjs',
    url: 'http://127.0.0.1:9416/wp-login.php', timeout: 180000,
    reuseExistingServer: false,
  },
});

import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'analytics.spec.mjs', workers: 1,
  timeout: 60000, expect: { timeout: 10000 },
  outputDir: './out/analytics',
  use: { baseURL: 'http://127.0.0.1:9424', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command: 'WCONVERT_VISUAL_PRO=1 WCONVERT_VISUAL_WORKERS=1 WCONVERT_VISUAL_PORT=9424 node tools/visual-tests/server.mjs',
    url: 'http://127.0.0.1:9424/wp-login.php', timeout: 180000,
    reuseExistingServer: false,
  },
});

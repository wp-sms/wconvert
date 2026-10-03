import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.request.get('/?wconvert_events_reset=1');
  await page.addInitScript(() => {
    window.gaCalls = []; window.gtag = (...args) => window.gaCalls.push(args); window.dataLayer = [];
    window.testShadows = [];
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) { const root = attach.call(this, options); window.testShadows.push(root); return root; };
  });
});
async function submit(page, name, value) {
  await page.evaluate(({ name, value }) => {
    const root = window.testShadows.find(root => root.querySelector(`[name="${name}"]`));
    const input = root.querySelector(`[name="${name}"]`); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
    const consent = root.querySelector('[name="consent"]'); if (consent) consent.checked = true;
    root.querySelector('[data-action="submit"]').click();
  }, { name, value });
}
const events = page => page.evaluate(() => window.gaCalls.map(call => call[1]));
test('real WordPress loads the adapter first and sends one accepted lead across email and SMS', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?wconvert_events=email&wconvert_analytics_fixture=gtag');
  await expect.poll(() => events(page)).toEqual(['wconvert_impression']);
  await submit(page, 'email', 'analytics@example.test');
  await expect.poll(() => events(page)).toEqual(['wconvert_impression', 'generate_lead']);
  await expect.poll(() => page.evaluate(() => window.testShadows.some(root => root.querySelector('[name="phone"]')))).toBe(true);
  const capture = await page.locator('#wconvert-payload').getAttribute('data-capture');
  const received = page.waitForResponse(r => r.url() === capture && r.request().postDataJSON()?.submission === 'sms-signup');
  await submit(page, 'phone', '+12025551234'); expect((await received).status()).toBeLessThan(300);
  expect(await events(page)).toEqual(['wconvert_impression', 'generate_lead']);
  const calls = await page.evaluate(() => window.gaCalls);
  expect(JSON.stringify(calls)).not.toContain('analytics@example.test');
  expect(JSON.stringify(calls)).not.toContain('+12025551234');
  expect(calls[1][2].send_to).toBe('G-TEST123');
  expect(errors).toEqual([]);
});
test('unknown consent drops impressions, then a permitted capture is handed to the tag', async ({ page }) => {
  await page.goto('/?wconvert_events=email&wconvert_analytics_fixture=wp');
  await expect(page.locator('dialog[open]')).toBeVisible(); expect(await events(page)).toEqual([]);
  await page.evaluate(() => { window.wp_consent_type = 'optin'; window.wp_has_consent = () => true; });
  await submit(page, 'email', 'consent@example.test');
  await expect.poll(() => events(page)).toEqual(['generate_lead']);
});
test('GTM uses only the existing data layer and disabled integration adds no asset', async ({ page }) => {
  await page.goto('/?wconvert_events=email&wconvert_analytics_fixture=gtm');
  await expect.poll(() => page.evaluate(() => window.dataLayer.map(row => row.event))).toEqual(['wconvert.impression']);
  await submit(page, 'email', 'gtm@example.test');
  await expect.poll(() => page.evaluate(() => window.dataLayer.map(row => row.event))).toEqual(['wconvert.impression', 'wconvert.lead_accepted']);
  expect(await events(page)).toEqual([]);
  await page.goto('/?wconvert_events=email&wconvert_analytics_fixture=off');
  await expect(page.locator('dialog[open]')).toBeVisible();
  expect(await page.locator('script[src*="/analytics/analytics.js"]').count()).toBe(0);
});
test('quiz completion and contact acceptance stay separate', async ({ page }) => {
  await page.goto('/?wconvert_events=quiz&wconvert_analytics_fixture=gtag');
  await expect.poll(() => events(page)).toEqual(['wconvert_impression']);
  await page.evaluate(() => {
    const root = window.testShadows.find(root => root.querySelector('input[value="grow"]'));
    root.querySelector('input[value="grow"]').click(); root.querySelector('[data-action="next"]').click();
  });
  await expect.poll(() => events(page)).toEqual(['wconvert_impression', 'wconvert_conversion']);
  await page.evaluate(() => window.testShadows.find(root => root.querySelector('[data-action="next"]')).querySelector('[data-action="next"]').click());
  await submit(page, 'email', 'quiz-analytics@example.test');
  await expect.poll(() => events(page)).toEqual(['wconvert_impression', 'wconvert_conversion', 'generate_lead']);
  expect(await page.evaluate(() => window.gaCalls[2][2].wcv_capture_role)).toBe('secondary');
});
test('content unlock exports acceptance once and remembered access exports no new lead', async ({ page }) => {
  await page.goto('/?wconvert_lock=basic&theme=classic&wconvert_analytics_fixture=gtag');
  const content = page.locator('[data-wconvert-locked-content]').first();
  await expect(content).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.testShadows.some(root => root.querySelector('[name="email"]')))).toBe(true);
  await submit(page, 'email', 'unlock@example.test');
  await expect(content).toBeVisible();
  await expect.poll(() => events(page)).toContain('generate_lead');
  expect((await events(page)).filter(event => event === 'generate_lead')).toHaveLength(1);
  await page.reload(); await expect(content).toBeVisible();
  expect(await events(page)).not.toContain('generate_lead');
});
test('admin saves settings through real REST and diagnostics stay local until an explicit synthetic test', async ({ page }) => {
  await page.request.get('/?wconvert_analytics_fixture=gtag');
  const refused = await page.request.get('/?rest_route=/wconvert/v1/analytics-integration');
  expect([401, 403]).toContain(refused.status());
  await page.goto('/wp-login.php');
  await expect(page.getByLabel('Username or Email Address')).toBeFocused();
  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
  await page.goto('/wp-admin/admin.php?page=wconvert#settings?group=integrations');
  await expect(page.getByLabel('Enable GA4 integration')).toBeVisible();
  await page.getByLabel('GA4 Measurement ID', { exact: false }).fill('G-TEST999');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect(page.getByText(/Settings saved. Known page caches/)).toBeVisible();
  await page.screenshot({ path: 'tools/visual-tests/out/analytics/settings.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([{ name: 'wconvert_ds_dir', value: 'rtl', url: page.url() }]);
  await page.reload();
  await expect(page.getByLabel('Enable GA4 integration')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.screenshot({ path: 'tools/visual-tests/out/analytics/settings-mobile-rtl.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const response = await page.goto('/?wconvert-analytics=1');
  expect(response.headers()['cache-control']).toContain('no-cache');
  await expect(page.getByRole('complementary', { name: 'Analytics check' })).toBeVisible();
  expect(await events(page)).toEqual([]);
  await page.evaluate(() => {
    const root = window.testShadows.find(root => root.querySelector('input[placeholder]'));
    root.querySelector('input').value = 'G-TEST123';
    [...root.querySelectorAll('button')].find(button => button.textContent === 'Send synthetic test event').click();
  });
  await expect.poll(() => events(page)).toEqual(['wconvert_test']);
});

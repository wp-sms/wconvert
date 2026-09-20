import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.testShadows = [];
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      const root = attach.call(this, options); window.testShadows.push(root); return root;
    };
  });
});
async function clickShadow(page, selector) {
  await page.evaluate(selector => window.testShadows.flatMap(root => [...root.querySelectorAll(selector)]).find(node => node.isConnected)?.click(), selector);
}
async function open(page, kind = 'popup', query = '') {
  await page.goto(`/?wconvert_reopen=${kind}${query}`);
  await expect(page.locator('#wconvert-payload')).toBeAttached();
}


test('real WordPress delivers assets and restores only a reminder across pages and reloads', async ({ page }) => {
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  await open(page);
  await expect(page.locator('dialog')).toBeVisible();
  await page.evaluate(() => { const input = window.testShadows.flatMap(root => [...root.querySelectorAll('input[type=email]')])[0]; input.value = 'reader@example.com'; });
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-wconvert-reopen]')).toBeVisible();
  await page.evaluate(() => window.testShadows.find(root => root.host.hasAttribute('data-wconvert-reopen')).querySelector('button').click());
  await expect(page.locator('dialog')).toBeVisible();
  expect(await page.evaluate(() => window.testShadows.flatMap(root => [...root.querySelectorAll('input[type=email]')])[0].value)).toBe('reader@example.com');
  await page.keyboard.press('Escape');
  await page.locator('#next').click();
  await expect(page.locator('[data-wconvert-reopen]')).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-wconvert-reopen]')).toBeVisible();
  await clickShadow(page, '[aria-label="Dismiss reminder"]');
  await page.reload();
  await expect(page.locator('[data-wconvert-reopen],dialog[open]')).toHaveCount(0);
  expect(failures).toEqual([]);
});

test('keyboard reopening returns focus and preserves native popup modality', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-wconvert-reopen]')).toBeVisible();
  await page.evaluate(() => window.testShadows.find(root => root.host.hasAttribute('data-wconvert-reopen')).querySelector('button').focus());
  await page.keyboard.press('Enter');
  await expect(page.locator('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('dialog').matches(':modal'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.testShadows.find(root => root.host.hasAttribute('data-wconvert-reopen')).activeElement?.textContent)).toBe('Get my discount');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-wconvert-reopen]')).toHaveCount(0);
});

for (const rtl of [false, true]) test(`320px reminder fits and clears sticky checkout, ${rtl ? 'RTL' : 'LTR'}`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page, 'long', rtl ? '&rtl=1' : '');
  await page.keyboard.press('Escape');
  const box = page.locator('[data-wconvert-reopen]');
  await expect(box).toBeVisible();
  const rect = await box.boundingBox();
  expect(rect.x).toBeGreaterThanOrEqual(23);
  expect(rect.x + rect.width).toBeLessThanOrEqual(297);
  expect(rect.y).toBe(24);
  expect(rect.y + rect.height).toBeLessThan(570);
  const controls = await page.evaluate(() => [...window.testShadows.find(root => root.host.hasAttribute('data-wconvert-reopen')).querySelectorAll('button')].map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height, font: getComputedStyle(button).fontFamily })));
  expect(controls.every(control => control.width >= 44 && control.height >= 44 && !control.font.includes('Comic'))).toBe(true);
  await page.screenshot({ path: `tools/visual-tests/out/reopen/${rtl ? 'rtl' : 'ltr'}-mobile.png` });
  await page.locator('#origin').click();
});

test('mobile-hidden reminder leaves the initial campaign visible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page, 'hidden');
  await expect(page.locator('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-wconvert-reopen]')).toHaveCount(0);
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(page.locator('[data-wconvert-reopen]')).toBeVisible();
});

test('slide-in remains usable after rapid reopen', async ({ page }) => {
  await open(page, 'slide');
  await clickShadow(page, '.wc-close');
  await expect(page.locator('[data-wconvert-reopen]')).toBeVisible();
  await page.evaluate(() => window.testShadows.find(root => root.host.hasAttribute('data-wconvert-reopen')).querySelector('button').click());
  await page.waitForTimeout(1100);
  const state = await page.evaluate(() => { const input = window.testShadows.flatMap(root => [...root.querySelectorAll('input[type=email]')])[0]; return { connected: input.isConnected, pointers: getComputedStyle(input).pointerEvents, width: input.getBoundingClientRect().width }; });
  expect(state.connected).toBe(true); expect(state.pointers).not.toBe('none'); expect(state.width).toBeGreaterThan(0);
});

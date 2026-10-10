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

test('real editor loads Pro controls, simulates reopening, and saves draft settings', async ({ page }, info) => {
  await open(page);
  const id = await page.locator('#wconvert-payload').evaluate(node => JSON.parse(node.textContent)[0].id);
  await page.goto('/wp-login.php');
  await expect(page.getByLabel('Username or Email Address')).toBeFocused();
  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
  await page.goto(`/wp-admin/admin.php?page=wconvert#optins?edit=${id}`);
  // The reopen button's settings live in the Look; the tree's Reopen button
  // row puts it on the canvas (ADR 0134).
  const tree = page.getByRole('navigation', { name: 'Campaign', exact: true });
  await tree.getByRole('button', { name: /^Look/ }).click();
  const design = page.getByRole('region', { name: 'Look', exact: true });
  const text = design.getByLabel('Button text', { exact: true });
  await expect(text).toHaveValue('Get my discount');
  const reopenTab = tree.getByRole('button', { name: 'Reopen button', exact: true });
  await page.getByRole('button', { name: 'About reopen buttons', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'About reopen buttons' })).toBeVisible();
  await page.keyboard.press('Escape');
  await reopenTab.click();
  await expect(reopenTab).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('region', { name: 'Design canvas' }).locator('[data-wconvert-reopen]')).toBeVisible();
  await page.evaluate(() => window.testShadows.find(root => root.host.hasAttribute('data-wconvert-reopen') && root.host.isConnected).querySelector('button').click());
  await expect(reopenTab).not.toHaveAttribute('aria-current', 'true');
  await expect(tree.locator('.wconvert-campaign-screens__row > button[aria-current="true"]').first()).toBeVisible();
  await reopenTab.click();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.getByRole('menuitem', { name: 'As a visitor', exact: true }).click();
  await page.getByRole('dialog', { name: 'Preview', exact: true }).getByRole('button', { name: 'Back to editor', exact: true }).click();
  await expect(reopenTab).toHaveAttribute('aria-current', 'true');
  await page.locator('label').filter({ has: page.getByRole('radio', { name: 'Mobile', exact: true }) }).click();
  // The disclosure's summary says its value beside the title (ADR 0136).
  await design.locator('summary', { hasText: 'Colors and mobile' }).click();
  await design.getByRole('checkbox', { name: 'Show on mobile', exact: true }).uncheck();
  await expect(page.getByRole('region', { name: 'Design canvas' }).getByText('Hidden on mobile', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Undo:/ }).click();
  await expect(page.getByRole('region', { name: 'Design canvas' }).getByText('Hidden on mobile', { exact: true })).toHaveCount(0);
  await page.locator('label').filter({ has: page.getByRole('radio', { name: 'Desktop', exact: true }) }).click();
  await design.getByRole('checkbox', { name: 'Show a reopen button', exact: true }).uncheck();
  await expect(reopenTab).toHaveCount(0);
  await page.getByRole('button', { name: /^Undo:/ }).click();
  await expect(reopenTab).toBeVisible();
  await text.fill('Save my offer');
  await page.getByRole('button', { name: /^Undo:/ }).click();
  await expect(text).toHaveValue('Get my discount');
  await text.fill('Save my offer');
  const saved = page.waitForResponse(response => decodeURIComponent(response.url()).includes(`/optins/${id}`) && response.request().method() !== 'GET');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await tree.getByRole('button', { name: /^Look/ }).click();
  await expect(text).toHaveValue('Save my offer');
  await reopenTab.click();
  await text.scrollIntoViewIfNeeded();
  await expect(page.getByRole('region', { name: 'Design canvas' }).locator('[data-wconvert-reopen]')).toBeVisible();
  await page.screenshot({ path: info.outputPath('reopen-editor.png'), fullPage: true });
});

test('a real capture completes while minimized without expanding or submitting twice', async ({ page }) => {
  await open(page, 'capture');
  await expect(page.locator('dialog')).toBeVisible();
  const endpoint = await page.locator('#wconvert-payload').getAttribute('data-capture');
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const requests = [];
  await page.route(endpoint, async route => { requests.push(route.request().postDataJSON()); await held; await route.continue(); });
  const sent = page.waitForRequest(endpoint);
  await page.evaluate(() => {
    const form = window.testShadows.flatMap(root => [...root.querySelectorAll('form')])[0];
    form.querySelector('input[type=email]').value = 'recovery@example.com';
    form.requestSubmit();
  });
  await sent;
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-wconvert-reopen]')).toBeVisible();
  await page.evaluate(() => window.testShadows.find(root => root.host.hasAttribute('data-wconvert-reopen')).querySelector('button').click());
  await page.evaluate(() => window.testShadows.flatMap(root => [...root.querySelectorAll('form')])[0].requestSubmit());
  await page.keyboard.press('Escape');
  const captured = page.waitForResponse(response => response.url() === endpoint && response.request().postDataJSON()?.submission === 'primary');
  release();
  expect((await captured).status()).toBe(201);
  await expect.poll(() => page.evaluate(() => window.testShadows.find(root => root.host.hasAttribute('data-wconvert-reopen')).querySelector('button').textContent)).toBe('Submission received — View details');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.evaluate(() => window.testShadows.find(root => root.host.hasAttribute('data-wconvert-reopen')).querySelector('button').click());
  await expect(page.locator('dialog')).toBeVisible();
  expect(await page.evaluate(() => window.testShadows.some(root => root.textContent.includes('Submission received')))).toBe(true);
  expect(requests.filter(request => request.phase === 'start')).toHaveLength(1);
  expect(requests.filter(request => request.submission === 'primary')).toHaveLength(1);
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('[data-wconvert-reopen],dialog[open]')).toHaveCount(0);
});

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.request.get('/?wconvert_events_reset=1');
  await page.addInitScript(() => {
    window.campaignEvents = []; window.testShadows = [];
    for (const name of ['open', 'close', 'capture']) document.addEventListener(`wconvert:${name}`, event => {
      window.campaignEvents.push({ type: name, detail: event.detail });
    });
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      const root = attach.call(this, options); window.testShadows.push(root); return root;
    };
  });
});
const kinds = page => page.evaluate(() => window.campaignEvents.map(event => event.type));
async function act(page, action) {
  await page.evaluate(action => window.testShadows.flatMap(root => [...root.querySelectorAll(`[data-action="${action}"]`)]).find(node => node.isConnected)?.click(), action);
}
async function fill(page, name, value) {
  await page.evaluate(({ name, value }) => {
    const root = window.testShadows.find(root => root.querySelector(`[name="${name}"]`));
    const input = root.querySelector(`[name="${name}"]`); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
    const consent = root.querySelector('[name="consent"]'); if (consent) consent.checked = true;
  }, { name, value });
}

test('Free WordPress captures email then SMS once and stays open across screens', async ({ page }) => {
  await page.goto('/?wconvert_events=email&wconvert_visual_free_only=1');
  await expect(page.locator('dialog[open]')).toBeVisible();
  expect(await kinds(page)).toEqual(['open']);
  await fill(page, 'email', 'events@example.com'); await act(page, 'submit');
  await expect.poll(() => kinds(page)).toEqual(['open', 'capture']);
  await fill(page, 'phone', '+12025551234');
  const endpoint = await page.locator('#wconvert-payload').getAttribute('data-capture');
  const accepted = page.waitForResponse(r => r.url() === endpoint && r.request().postDataJSON()?.submission === 'sms-signup');
  await act(page, 'submit'); expect((await accepted).status()).toBeLessThan(300);
  expect(await kinds(page)).toEqual(['open', 'capture']);
  await page.keyboard.press('Escape');
  await expect.poll(() => kinds(page)).toEqual(['open', 'capture', 'close']);
});

test('paid WordPress emits no capture for quiz results, then captures contact once', async ({ page }) => {
  await page.goto('/?wconvert_events=quiz');
  await expect(page.locator('dialog[open]')).toBeVisible();
  await page.evaluate(() => window.testShadows.find(root => root.querySelector('input[value="grow"]')).querySelector('input[value="grow"]').click());
  await act(page, 'next'); expect(await kinds(page)).toEqual(['open']);
  await act(page, 'next'); await fill(page, 'email', 'quiz-events@example.com'); await act(page, 'submit');
  await expect.poll(() => kinds(page)).toEqual(['open', 'capture']);
  const details = await page.evaluate(() => window.campaignEvents[1].detail);
  expect(Object.keys(details).sort()).toEqual(['campaignId', 'displayType', 'optinId']);
  expect(details.campaignId).toBe(details.optinId);
});

test('native popup reopening reports separate cycles and restored reminder stays silent', async ({ page }) => {
  await page.goto('/?wconvert_reopen=events');
  await expect(page.locator('dialog[open]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(() => kinds(page)).toEqual(['open', 'close']);
  await page.evaluate(() => window.testShadows.find(root => root.host.hasAttribute('data-wconvert-reopen')).querySelector('button').click());
  await expect.poll(() => kinds(page)).toEqual(['open', 'close', 'open']);
  await page.keyboard.press('Escape');
  await expect.poll(() => kinds(page)).toEqual(['open', 'close', 'open', 'close']);
  await page.reload();
  await expect(page.locator('[data-wconvert-reopen]')).toBeVisible();
  expect(await kinds(page)).toEqual([]);
});

test('slide-in interrupted closing animation never publishes a stale close', async ({ page }) => {
  await page.goto('/?wconvert_reopen=slide');
  await expect(page.locator('.wcv-p')).toBeVisible();
  await page.evaluate(() => {
    window.testShadows.find(root => root.querySelector('.wc-close')).querySelector('.wc-close').click();
    window.testShadows.find(root => root.host.hasAttribute('data-wconvert-reopen')).querySelector('button').click();
  });
  await page.waitForTimeout(1100); // Outlive the existing transition fallback.
  expect(await kinds(page)).toEqual(['open']);
  await page.evaluate(() => window.testShadows.find(root => root.querySelector('.wc-close')).querySelector('.wc-close').click());
  await expect.poll(() => kinds(page)).toEqual(['open', 'close']);
});

test('fullscreen uses the public modal lifecycle and restores page scrolling on close', async ({ page }) => {
  await page.goto('/?wconvert_fullscreen=fullscreen-guide');
  await expect(page.locator('dialog[open]')).toBeVisible();
  expect(await kinds(page)).toEqual(['open']);
  expect(await page.evaluate(() => window.campaignEvents[0].detail.displayType)).toBe('fullscreen');
  await page.keyboard.press('Escape');
  await expect.poll(() => kinds(page)).toEqual(['open', 'close']);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).not.toBe('hidden');
});

test('campaign details copy the ID by keyboard and admin previews remain silent', async ({ page, context }, info) => {
  await page.goto('/?wconvert_events=email');
  await expect(page.locator('dialog[open]')).toBeVisible();
  const id = await page.locator('#wconvert-payload').evaluate(node => JSON.parse(node.textContent)[0].id);
  await page.goto('/wp-login.php');
  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
  await page.goto('/wp-admin/admin.php?page=wconvert#optins');
  await page.getByRole('button', { name: 'Events email then SMS', exact: true }).first().click();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Copy campaign ID' }).focus(); await page.keyboard.press('Enter');
  await expect(dialog.getByText('ID copied.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(id);
  expect(await kinds(page)).toEqual([]);
  await page.screenshot({ path: info.outputPath('copy-campaign-id.png') });
  await page.setViewportSize({ width: 320, height: 740 });
  const input = dialog.getByRole('textbox', { name: 'Campaign ID' });
  await input.scrollIntoViewIfNeeded();
  const field = await input.boundingBox();
  expect(field.width).toBeGreaterThan(200);
  expect(field.x).toBeGreaterThanOrEqual(0); expect(field.x + field.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: info.outputPath('copy-campaign-id-mobile.png') });
});

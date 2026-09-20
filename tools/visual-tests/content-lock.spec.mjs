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
const region = page => page.locator('[data-wconvert-locked-content]').first();
async function open(page, kind = 'basic', query = '') {
  await page.goto(`/?wconvert_lock=${kind}${query}`);
  // Playground can return an empty document on the request that switches themes.
  if (await page.locator("body").textContent() === "") await page.reload();
  await expect(region(page)).toBeAttached();
}
async function submit(page) {
  await page.evaluate(() => {
    const form = window.testShadows.flatMap(root => [...root.querySelectorAll('form')]).find(form => form.isConnected);
    form.querySelector('input[type=email]').value = 'reader@example.com';
    form.querySelector('button[type=submit]').click();
  });
}
for (const theme of ['classic', 'block']) test(`WordPress ${theme} block capture, reveal and remembered access`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await open(page, 'basic', `&theme=${theme}`);
  await expect(region(page)).toBeHidden();
  await expect(page.getByText('Read this public introduction.')).toBeVisible();
  const response = page.waitForResponse(response => response.url().includes('/capture') && response.request().method() === 'POST');
  await submit(page); expect((await response).ok()).toBe(true);
  await expect(region(page)).toBeVisible();
  expect(await page.evaluate(() => window.testShadows.some(root => root.textContent.includes('Content unlocked.')))).toBe(true);
  await page.reload(); await expect(region(page)).toBeVisible();
  await expect(page.locator('[data-wconvert-optin] > *')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('shortcode hides only its region at 320px in RTL and preserves public content', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await open(page, 'shortcode', '&theme=classic&rtl=1');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(region(page)).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // A descendant of the hidden region cannot receive focus.
  await page.locator('#bonus-link').evaluate(node => node.focus());
  expect(await page.locator('#bonus-link').evaluate(node => node === document.activeElement)).toBe(false);
  await submit(page); await expect(region(page)).toBeVisible();
  await page.evaluate(() => window.testShadows.flatMap(root => [...root.querySelectorAll('button')]).find(button => button.textContent === 'Continue to content').click());
  expect(await region(page).evaluate(node => document.activeElement === node)).toBe(true);
  await page.screenshot({ path: 'tools/visual-tests/out/content-lock/mobile-unlocked.png', fullPage: true });
});
test('technical failure opens content with no unlock receipt', async ({ page }) => {
  await page.route('**/capture', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) }));
  await open(page); await expect(region(page)).toBeHidden(); await submit(page);
  await expect(region(page)).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('wcv_unlock1:')))).toBe(false);
});
test('a missing campaign, disabled lock and absent JavaScript leave content readable', async ({ browser, page }) => {
  await open(page, 'missing'); await expect(region(page)).toBeVisible();
  await open(page, 'off'); await expect(region(page)).toBeVisible();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const noScript = await context.newPage(); await noScript.goto('http://127.0.0.1:9414/?wconvert_lock=basic');
  await expect(region(noScript)).toBeVisible(); await context.close();
});
test('a duplicate wrapper cannot hide another region', async ({ page }) => {
  await open(page, 'duplicate');
  await expect(region(page)).toBeHidden();
  await expect(page.locator('[data-wconvert-locked-content]').nth(1)).toBeVisible();
});

test('the paid WordPress block registers, accepts nested content and saves a readable fallback', async ({ page }) => {
  await open(page, 'basic', '&theme=block');
  const campaignId = await page.locator('[data-wconvert-content-lock]').getAttribute('data-wconvert-content-lock');
  await page.goto('/wp-login.php');
  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/wp-admin/');
  await page.goto('/wp-admin/post-new.php');
  await expect.poll(() => page.evaluate(() => window.wp?.blocks?.getBlockType('wconvert/content-lock')?.name ?? null)).toBe('wconvert/content-lock');
  const saved = await page.evaluate(id => {
    const { createBlock, serialize, parse, getBlockType } = window.wp.blocks;
    const block = createBlock('wconvert/content-lock', { optinId: id }, [createBlock('core/paragraph', { content: 'Readable saved bonus' })]);
    window.wp.data.dispatch('core/block-editor').insertBlocks(block);
    const markup = serialize([block]);
    return { markup, valid: parse(markup)[0].isValid, inserter: getBlockType('wconvert/content-lock').supports.inserter };
  }, campaignId);
  expect(saved.inserter).toBe(true); expect(saved.valid).toBe(true);
  expect(saved.markup).toContain('<p>Readable saved bonus</p>');
  expect(saved.markup).not.toContain('hidden');
  await expect.poll(() => page.evaluate(() => window.wp.data.select('core/block-editor').getBlocks().some(block => block.name === 'wconvert/content-lock'))).toBe(true);
});

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.testShadows = [];
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) { const root = attach.call(this, options); window.testShadows.push(root); return root; };
  });
});
const cards = page => page.evaluate(() => window.testShadows.flatMap(root => [...root.querySelectorAll('article strong')]).filter(node => node.isConnected).map(node => node.textContent));
for (const loggedIn of [false, true]) test(`${loggedIn ? 'logged-in' : 'guest'} session shows only live accessories and updates after classic add to cart`, async ({ page }) => {
  const errors = []; const reads = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('wc-ajax=wconvert_cart_context')) reads.push(response.status()); });
  await page.goto(`/?wconvert_commerce_fixture=1&basket=0${loggedIn ? '&login=1' : ''}`);
  await expect.poll(() => cards(page)).toEqual(['Reusable coffee filters', 'Coffee cleaning brush', 'Coffee storage jar']);
  const fixture = await (await page.request.get('/?wconvert_commerce_fixture=1&json=1')).json();
  await page.evaluate(async id => {
    window.jQuery?.(document.body).trigger('adding_to_cart');
    await fetch('/?wc-ajax=add_to_cart', { method: 'POST', body: new URLSearchParams({ product_id: String(id), quantity: '1' }) });
    window.jQuery?.(document.body).trigger('added_to_cart');
    document.dispatchEvent(new Event('wc-blocks_added_to_cart'));
  }, fixture.products[1]);
  await expect.poll(() => cards(page)).toEqual(['Coffee cleaning brush', 'Coffee storage jar']);
  expect(reads.every(status => status === 200)).toBe(true);
  expect(reads.length).toBeLessThanOrEqual(3);
  expect(errors).toEqual([]);
});
test('empty and independent guest carts cannot inherit another shopper context', async ({ page, browser }) => {
  await page.goto('/?wconvert_commerce_fixture=1&basket=0');
  await expect.poll(() => cards(page)).toHaveLength(3);
  const other = await browser.newContext(); const visitor = await other.newPage();
  await visitor.goto('http://127.0.0.1:9431/?wconvert_commerce_fixture=1&basket=');
  const response = await visitor.waitForResponse(r => r.url().includes('wc-ajax=wconvert_cart_context'));
  const result = await response.json();
  expect(Object.values(result).every(value => value.known && Object.values(value.rules).every(holds => holds === false))).toBe(true);
  await other.close();
});
for (const rtl of [false, true]) test(`recommendation cards fit 320px ${rtl ? 'RTL' : 'LTR'} and remain keyboard reachable`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`/?wconvert_commerce_fixture=1&basket=0${rtl ? '&rtl=1' : ''}`);
  await expect.poll(() => cards(page)).toHaveLength(3);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await page.keyboard.press('Tab');
  await page.screenshot({ path: `tools/visual-tests/out/commerce/cards-${rtl ? 'rtl' : 'ltr'}-320.png`, fullPage: true });
});
test('real WooCommerce Blocks store refreshes the cart projection on quantity changes', async ({ page }) => {
  const responses = [];
  page.on('response', response => { if (response.url().includes('wc-ajax=wconvert_cart_context')) responses.push(response); });
  await page.goto('/?wconvert_commerce_fixture=1&basket=0&blocks=1');
  await expect.poll(() => cards(page)).toHaveLength(3);
  await expect.poll(() => page.evaluate(() => !!window.wp?.data?.select('wc/store/cart')?.getCartData?.()?.items?.length)).toBe(true);
  const before = responses.length;
  await page.evaluate(async () => {
    const item = window.wp.data.select('wc/store/cart').getCartData().items[0];
    await window.wp.data.dispatch('wc/store/cart').changeCartItemQuantity(item.key, 2);
  });
  await expect.poll(() => responses.length).toBeGreaterThan(before);
  await expect.poll(() => cards(page)).toHaveLength(3);
  expect(await page.evaluate(() => window.wp.data.select('wc/store/cart').getCartData().items[0].quantity)).toBe(2);
  await page.screenshot({ path: 'tools/visual-tests/out/commerce/cards-desktop.png', fullPage: true });
});
test('the real editor can select and search recommendation products', async ({ page }) => {
  await page.goto('/?wconvert_commerce_fixture=1&login=1&json=1');
  const fixture = JSON.parse(await page.locator('body').innerText());
  await page.goto(`/wp-admin/admin.php?page=wconvert#optins?edit=${fixture.id}`);
  await expect(page.getByRole('button', { name: 'Review & publish', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.testShadows.some(root => root.querySelector('[data-path="0.children.3"]')))).toBe(true);
  await page.evaluate(() => window.testShadows.flatMap(root => [...root.querySelectorAll('[data-path="0.children.3"]')]).find(node => node.isConnected)?.click());
  const search = page.getByRole('textbox', { name: 'Find products', exact: true });
  await expect(search).toBeVisible(); await search.fill('machine');
  await expect(page.getByText('Coffee machine', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Coffee machine', exact: true })).toBeVisible();
  await page.screenshot({ path: 'tools/visual-tests/out/commerce/editor-products.png', fullPage: true });
});

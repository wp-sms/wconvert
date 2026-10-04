import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.testShadows = [];
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) { const root = attach.call(this, options); window.testShadows.push(root); return root; };
  });
});
const cards = page => page.evaluate(() => window.testShadows.flatMap(root => [...root.querySelectorAll('article strong')]).filter(node => node.isConnected).map(node => node.textContent));
test('publication rejects recommendation variations while allowing cart variations, and the accessory start excludes checkout', async ({ request }) => {
  const response = await request.get('/?wconvert_commerce_fixture=1&checks=1');
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(result.unsupported).toContain('Choose up to six available catalog products for the recommendations.');
  expect(result.supported).toEqual([]);
  expect(result.cart_rule).toEqual([]);
  expect(result.checkout).toBeGreaterThan(0);
  expect(result.targeting.exclude).toContainEqual({ type: 'post', value: String(result.checkout) });
});
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

test('configured cross-sells keep merchant order, filter unavailable items, and update with the real cart', async ({ page }) => {
  await page.goto('/?wconvert_commerce_fixture=1&cross=1&basket=0');
  await expect.poll(() => cards(page)).toEqual(['Coffee cleaning brush', 'Reusable coffee filters', 'Coffee storage jar']);
  await page.goto('/?wconvert_commerce_fixture=1&cross=1&basket=0,2');
  await expect.poll(() => cards(page)).toEqual(['Reusable coffee filters', 'Coffee storage jar']);
  await page.goto('/?wconvert_commerce_fixture=1&cross=1&basket=3');
  await expect.poll(() => cards(page)).toEqual([]);
});

test('sample basket evaluates draft rules and cross-sells without changing the real cart', async ({ page, request }) => {
  await page.goto('/?wconvert_commerce_fixture=1&login=1&basket=0&json=1');
  const f = await (await page.request.get('/?wconvert_commerce_fixture=1&json=1')).json();
  const preview = async data => {
    const response = await page.request.post('/?rest_route=/wconvert/v1/commerce/preview', { headers: { 'X-WP-Nonce': f.nonce }, data });
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');
    return response.json();
  };
  const data = { state: 'known', items: [{ id: f.products[0], quantity: 2 }], amount: 200, total: 220,
    products: { source: 'cross_sells', product_ids: [], exclude_cart: true }, rules: [
      { id: 'products', type: 'cart_products', ids: [f.products[0]], operator: 'any' },
      { id: 'category', type: 'cart_categories', ids: [f.category], operator: 'all', descendants: true },
      { id: 'quantity', type: 'cart_quantity', range: { operator: 'between', min: 2, max: 2 } },
      { id: 'amount', type: 'cart_amount', range: { operator: 'between', min: 200, max: 200, currency: 'USD', decimals: 2 } },
      { id: 'negative', type: 'cart_products', ids: [f.products[1]], operator: 'none' },
    ] };
  const result = await preview(data);
  expect(Object.values(result.rules)).toEqual([true, true, true, true, true]);
  expect(result.cards.map(card => card.id)).toEqual([f.products[2], f.products[1], f.products[3]]);
  const afterAdd = await preview({ ...data, items: [...data.items, { id: f.products[1], quantity: 1 }] });
  expect(afterAdd.cards.map(card => card.id)).toEqual([f.products[2], f.products[3]]);
  expect(afterAdd.rules.negative).toBe(false);
  for (const state of ['unknown', 'blocked']) {
    const unknown = await preview({ ...data, state });
    expect(Object.values(unknown.rules).every(match => match === false)).toBe(true);
    expect(unknown.eligible).toBe(false);
    expect(unknown.cards).toEqual([]);
  }
  const empty = await preview({ ...data, items: [] });
  expect(empty.rules.negative).toBe(true);
  expect(empty.eligible).toBe(false);
  expect(empty.reason).toBe('empty');
  const noLinks = await preview({ ...data, items: [{ id: f.products[3], quantity: 1 }] });
  expect(noLinks.reason).toBe('no_relationships');
  const variant = await preview({ ...data, items: [{ id: f.variation, quantity: 1 }], rules: [{ id: 'both', type: 'cart_products', ids: [f.variable, f.variation], operator: 'all' }] });
  expect(variant.rules.both).toBe(true);
  expect(variant.cards.map(card => card.id)).toEqual([f.products[1]]);
  const wrongCurrency = await preview({ ...data, rules: [{ ...data.rules[3], range: { ...data.rules[3].range, currency: 'EUR' } }] });
  expect(wrongCurrency.rules.amount).toBe(false);
  const current = await (await page.request.get('/?wconvert_commerce_fixture=1&json=1')).json();
  expect(current.cart_count).toBe(1);
  const refused = await request.post('/?rest_route=/wconvert/v1/commerce/preview', { data });
  expect([401, 403]).toContain(refused.status());
  const malformed = await page.request.post('/?rest_route=/wconvert/v1/commerce/preview', { headers: { 'X-WP-Nonce': f.nonce }, data: { ...data, items: [{ id: f.products[0], quantity: -1 }] } });
  expect(malformed.status()).toBe(400);
});

test('the editor tests the unsaved cross-sell draft with a sample basket', async ({ page }) => {
  await page.goto('/?wconvert_commerce_fixture=1&login=1&json=1');
  const fixture = JSON.parse(await page.locator('body').innerText());
  await page.goto(`/wp-admin/admin.php?page=wconvert#optins?edit=${fixture.id}`);
  await expect.poll(() => page.evaluate(() => window.testShadows.some(root => root.querySelector('[data-path="0.children.3"]')))).toBe(true);
  await page.evaluate(() => window.testShadows.flatMap(root => [...root.querySelectorAll('[data-path="0.children.3"]')]).find(node => node.isConnected)?.click());
  await page.getByRole('combobox', { name: 'Recommendation source', exact: true }).selectOption('cross_sells');
  await page.getByRole('tab', { name: 'Display rules', exact: true }).click();
  await page.getByRole('button', { name: 'Test a sample visit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Sample basket', exact: true })).toBeVisible();
  await dialog.getByLabel('Find products or variations', { exact: true }).fill('Coffee machine');
  await dialog.getByRole('button', { name: 'Add Coffee machine', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Would show');
  await expect(dialog.getByText('Coffee cleaning brush', { exact: true })).toBeVisible();
  await dialog.getByLabel('Find products or variations', { exact: true }).fill('Reusable coffee filters');
  await dialog.getByRole('button', { name: 'Add Reusable coffee filters', exact: true }).click();
  await expect(dialog.locator('li strong', { hasText: 'Reusable coffee filters' })).toHaveCount(0);
  await expect(dialog.getByText('Coffee storage jar', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'tools/visual-tests/out/commerce/sample-basket.png', fullPage: true });
  await dialog.getByText('Coffee storage jar', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'tools/visual-tests/out/commerce/sample-basket-cards.png', fullPage: true });
  for (const direction of ['ltr', 'rtl']) {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.evaluate(dir => { document.documentElement.dir = dir; }, direction);
    expect(await dialog.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(false);
    await page.screenshot({ path: `tools/visual-tests/out/commerce/sample-basket-${direction}-320.png`, fullPage: true });
  }
  await dialog.getByRole('combobox', { name: 'Basket status', exact: true }).selectOption('unknown');
  await expect(dialog.getByRole('status')).toContainText('Would not show');
  await dialog.getByRole('button', { name: 'Reset sample', exact: true }).click();
  await expect(dialog.getByText('Add a product to the sample basket to see suggestions.', { exact: true })).toBeVisible();
});

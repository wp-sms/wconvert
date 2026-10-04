import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
const fixture = (request, action, params = {}) => request.get('/?' + new URLSearchParams({ wconvert_revenue_fixture: action, ...params })).then(async r => { expect(r.ok(), `${action}: ${r.status()} ${(await r.text()).slice(-600)}`).toBe(true); return r.json(); });
async function interact(request, id) {
  const response = await request.post('/?wc-ajax=wconvert_interaction', { headers: { Origin: 'http://127.0.0.1:9442' }, form: { id, event: randomUUID(), at: String(Math.floor(Date.now() / 1000)) } });
  expect(response.status()).toBe(200);
  expect((await response.json()).success).toBe(true);
}
test.beforeEach(async ({ context }) => { await context.addCookies([{ name: 'wcv_test_consent', value: 'allow', url: 'http://127.0.0.1:9442' }]); });
for (const hpos of ['0', '1']) test(`paid attribution, refunds, replays and privacy erasure (HPOS ${hpos})`, async ({ page }) => {
  expect((await fixture(page.request, 'storage', { hpos })).hpos).toBe(hpos === '1' ? 'yes' : 'no');
  const seed = await fixture(page.request, 'seed'); expect(seed.published).toBe(true);
  const before = await fixture(page.request, 'state'); expect(before.pending).toBeNull();
  await interact(page.request, seed.id);
  expect((await fixture(page.request, 'state')).pending.arm).toBe(seed.id);
  const order = await fixture(page.request, 'checkout', { blocks: hpos });
  expect(order.credit.arm).toBe(seed.id); expect(order.again).toEqual(order.credit);
  expect((await fixture(page.request, 'checkout')).credit).toBe('');
  let report = await fixture(page.request, 'report', { campaign: seed.id });
  expect(report.complete).toBe(true); expect(report.linked_orders).toBe(1); expect(report.currencies[0].amount).toBe(100);
  expect(report.orders).toEqual([]); // Anonymous fixture caller has no order permission.
  await fixture(page.request, 'refund', { order: order.id, item: order.item, allocated: '1' });
  report = await fixture(page.request, 'report', { campaign: seed.id }); expect(report.currencies[0].amount).toBe(75);
  await fixture(page.request, 'refund', { order: order.id });
  report = await fixture(page.request, 'report', { campaign: seed.id }); expect(report.currencies[0].amount).toBeNull();
  expect((await fixture(page.request, 'erase', { order: order.id })).credit).toBe('');
  expect((await fixture(page.request, 'report', { campaign: seed.id })).linked_orders).toBe(0);
});
test('consent, expired interactions, unpaid orders and forged campaign IDs do not produce credit', async ({ page, context }) => {
  const seed = await fixture(page.request, 'seed');
  await interact(page.request, seed.id);
  await fixture(page.request, 'expired'); expect((await fixture(page.request, 'checkout')).credit).toBe('');
  await interact(page.request, seed.id);
  expect((await fixture(page.request, 'checkout', { old: '1' })).credit).toBe('');
  await interact(page.request, seed.id);
  const unpaid = await fixture(page.request, 'checkout', { paid: '0' }); expect(unpaid.credit.arm).toBe(seed.id);
  expect((await fixture(page.request, 'report', { campaign: seed.id })).linked_orders).toBe(0);
  await context.addCookies([{ name: 'wcv_test_consent', value: 'deny', url: 'http://127.0.0.1:9442' }]);
  const denied = await page.request.post('/?wc-ajax=wconvert_interaction', { headers: { Origin: 'http://127.0.0.1:9442' }, form: { id: seed.id } }); expect(denied.status()).toBe(403);
  await context.addCookies([{ name: 'wcv_test_consent', value: 'allow', url: 'http://127.0.0.1:9442' }]);
  const forged = await page.request.post('/?wc-ajax=wconvert_interaction', { headers: { Origin: 'http://127.0.0.1:9442' }, form: { id: '01AAAAAAAAAAAAAAAAAAAAAAAA', event: randomUUID(), at: String(Math.floor(Date.now() / 1000)) } }); expect(forged.status()).toBe(422);
});
test('a real accepted form capture creates attribution only after submission', async ({ page }) => {
  await fixture(page.request, 'seed');
  await page.request.get('/?wconvert_events_reset=1');
  await page.addInitScript(() => {
    window.wp_consent_type = 'optin'; window.wp_has_consent = () => true;
    window.testShadows = [];
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) { const root = attach.call(this, options); window.testShadows.push(root); return root; };
  });
  await page.goto('/?wconvert_events=email');
  await expect(page.locator('dialog[open]')).toBeVisible();
  expect((await fixture(page.request, 'state')).pending).toBeNull();
  await page.evaluate(() => {
    const root = window.testShadows.find(root => root.querySelector('[name="email"]'));
    const input = root.querySelector('[name="email"]'); input.value = 'revenue@example.test'; input.dispatchEvent(new Event('input', { bubbles: true }));
    const consent = root.querySelector('[name="consent"]'); if (consent) consent.checked = true;
    root.querySelector('[data-action="submit"]').click();
  });
  await expect.poll(async () => (await fixture(page.request, 'state')).pending?.arm).toMatch(/^[A-Z0-9]{26}$/);
  expect((await fixture(page.request, 'checkout')).credit.version).toBe(1);
});
for (const blocks of [false, true]) test(`real ${blocks ? 'Store API' : 'classic'} checkout binds attribution`, async ({ page }) => {
  const seed = await fixture(page.request, 'seed');
  const cart = await fixture(page.request, 'cart');
  await interact(page.request, seed.id);
  const address = { first_name: 'Test', last_name: 'Shopper', address_1: '123 Test Street', city: 'Beverly Hills', state: 'CA', postcode: '90210', country: 'US', email: 'checkout@example.test', phone: '2025551234' };
  if (blocks) {
    const response = await page.request.post('/wp-json/wc/store/v1/checkout', { headers: { Nonce: cart.store_nonce }, data: { billing_address: address, shipping_address: address, payment_method: 'cod', payment_data: [] } });
    const data = await response.json(); expect(response.ok(), JSON.stringify(data)).toBe(true);
    expect((await fixture(page.request, 'credit', { order: data.order_id })).credit.arm).toBe(seed.id);
  } else {
    const response = await page.request.post('/?wc-ajax=checkout', { form: { ...Object.fromEntries(Object.entries(address).map(([k,v]) => [`billing_${k}`,v])), 'woocommerce-process-checkout-nonce': cart.nonce, payment_method: 'cod', terms: '1' } });
    const data = await response.json(); expect(data.result, JSON.stringify(data)).toBe('success');
    const id = new URL(data.redirect).pathname.match(/order-received\/(\d+)/)?.[1] ?? new URL(data.redirect).searchParams.get('order-received');
    expect((await fixture(page.request, 'credit', { order: id })).credit.arm).toBe(seed.id);
  }
});

test('the same click request cannot renew attribution or credit a second order', async ({ page }) => {
  const seed = await fixture(page.request, 'seed');
  const form = { id: seed.id, event: randomUUID(), at: String(Math.floor(Date.now() / 1000)) };
  const send = data => page.request.post('/?wc-ajax=wconvert_interaction', { headers: { Origin: 'http://127.0.0.1:9442' }, form: data });
  expect((await send(form)).status()).toBe(200);
  expect((await fixture(page.request, 'checkout')).credit.arm).toBe(seed.id);
  expect((await send(form)).status()).toBe(422);
  expect((await send({ ...form, event: randomUUID(), at: String(Number(form.at) - 121) })).status()).toBe(422);
  expect((await fixture(page.request, 'checkout')).credit).toBe('');
});

// HTTP integration spike, not a production client. No browser or merchant site is controlled.
import assert from 'node:assert/strict';
import { request } from '@playwright/test';
const baseURL = 'http://127.0.0.1:9445';
const reports = [];
const mark = name => { reports.push(name); console.log(`PASS ${name}`); };
for (const loggedIn of [false, true]) {
  const client = await request.newContext({ baseURL });
  const mode = loggedIn ? 'authenticated' : 'guest';
  try {
    const init = await client.get(`/?wconvert_commerce_fixture=1&basket=0&json=1${loggedIn ? '&login=1' : ''}`);
    assert.equal(init.status(), 200);
    const fixture = await init.json();
    const tokenResponse = await client.post('/?wc-ajax=wconvert_spike_tokens');
    const tokens = await tokenResponse.json();
    assert.equal(tokens.logged_in, loggedIn);
    assert.match(tokenResponse.headers()['cache-control'], /no-cache|no-store/);
    const headers = { 'X-WP-Nonce': tokens.rest, Nonce: tokens.nonce };
    const cart = async () => (await client.get('/?rest_route=/wc/store/v1/cart', { headers })).json();
    const quantity = (data, id) => data.items.filter(item => item.id === id).reduce((n, item) => n + item.quantity, 0);
    const write = (id, h = headers) => client.post('/?rest_route=/wc/store/v1/cart/add-item', { headers: h, data: { id, quantity: 1 } });
    const before = await cart();
    assert.equal(quantity(before, fixture.products[1]), 0);
    const missing = await write(fixture.products[1], { 'X-WP-Nonce': tokens.rest });
    assert.equal(missing.status(), 401);
    assert.equal((await missing.json()).code, 'woocommerce_rest_missing_nonce');
    assert.equal(quantity(await cart(), fixture.products[1]), 0);
    mark(`${mode}: missing Store API nonce rejects without mutation`);
    const stale = await write(fixture.products[1], { ...headers, Nonce: 'intentionally-invalid-spike-nonce' });
    assert.equal(stale.status(), 403);
    assert.equal((await stale.json()).code, 'woocommerce_rest_invalid_nonce');
    assert.equal(quantity(await cart(), fixture.products[1]), 0);
    mark(`${mode}: invalid cached nonce rejects without mutation`);
    const accepted = await write(fixture.products[1]);
    assert.equal(accepted.status(), 201);
    assert.equal(quantity(await accepted.json(), fixture.products[1]), 1);
    assert.equal(quantity(await cart(), fixture.products[1]), 1);
    mark(`${mode}: protected Store API addition persists in the same session`);
    const soldOut = await write(fixture.sold_out);
    assert.equal(soldOut.status(), 400);
    assert.equal(quantity(await cart(), fixture.sold_out), 0);
    mark(`${mode}: stock validation refuses unavailable product`);
    const replay = await write(fixture.products[1]);
    assert.equal(replay.status(), 201);
    assert.equal(quantity(await replay.json(), fixture.products[1]), 2);
    mark(`${mode}: identical POST adds again (native endpoint is NOT idempotent)`);
    const other = await request.newContext({ baseURL });
    try {
      await other.get('/?wconvert_commerce_fixture=1&basket=&json=1');
      const t = await (await other.post('/?wc-ajax=wconvert_spike_tokens')).json();
      const independent = await (await other.get('/?rest_route=/wc/store/v1/cart', { headers: { 'X-WP-Nonce': t.rest, Nonce: t.nonce } })).json();
      assert.equal(independent.items.length, 0);
      mark(`${mode}: independent guest cannot inherit the basket`);
    } finally { await other.dispose(); }
  } finally { await client.dispose(); }
}
console.log(JSON.stringify({ checksPassed: reports.length, wordpress: '7.1.2', woocommerce: '11.1.2', php: '8.3', scope: 'disposable HTTP integration; no production adapter' }));

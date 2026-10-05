// Disposable real WooCommerce only. No browser automation.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request } from '@playwright/test';
const baseURL = 'http://127.0.0.1:9445';
let checks = 0;
const pass = name => { checks++; console.log(`PASS ${name}`); };
for (const loggedIn of [false, true]) {
  const client = await request.newContext({ baseURL });
  const stranger = await request.newContext({ baseURL });
  const mode = loggedIn ? 'authenticated' : 'guest';
  try {
    await client.get(`/?wconvert_commerce_fixture=1&basket=&json=1${loggedIn ? '&login=1' : ''}`);
    const fixture = async extra => (await client.get(`/?wconvert_recommendations_fixture=1${extra ?? ''}`)).json();
    const f = await fixture('&options_required=0');
    console.log(`${mode} runtime: ${JSON.stringify(f.runtime)}`);
    for (const [key, expected] of Object.entries({ wordpress: process.env.WCONVERT_EXPECT_WP, php: process.env.WCONVERT_EXPECT_PHP, woocommerce: process.env.WCONVERT_EXPECT_WOO })) {
      if (expected) assert.ok(f.runtime[key] === expected || f.runtime[key].startsWith(expected + '.'), `Unexpected ${key}: ${f.runtime[key]}`);
    }
    const id = f.campaigns.add; const revision = f.revisions[id]; const product = f.products[1];
    const base = { id, revision, mount: randomUUID() };
    const post = (action, form, who = client, origin = baseURL) => who.post(`/?wc-ajax=wconvert_cart_${action}`, { headers: { Origin: origin }, form });
    const read = async () => (await (await client.post('/?wc-ajax=wconvert_cart_context', { form: { campaigns: JSON.stringify({ [id]: revision }), page_product: f.main_token } })).json())[id];
    const cards = (await read()).cards;
    const priceKey = id => cards.find(c => c.id === id)?.price_key ?? '';
    const before = f.counts;
    const tokenResponse = await post('begin', base); assert.equal(tokenResponse.status(), 200);
    const { token } = await tokenResponse.json(); assert.ok(token);
    const command = { id, revision, token, operation: randomUUID(), product: String(product), price_key: priceKey(product), page_product: f.main_token };
    assert.equal((await post('add', command, stranger)).status(), 403);
    assert.equal((await post('add', command, client, 'https://unrelated.example')).status(), 403);
    assert.equal((await post('add', { ...command, token: 'forged' })).status(), 403);
    pass(`${mode}: fresh session token rejects another session, foreign origin and forgery`);
    const call = async body => (await post('add', body)).json();
    for (const bad of [f.products[0], f.private, f.draft, f.sold_out, f.variable, 999999]) {
      assert.equal((await call({ ...command, operation: randomUUID(), product: String(bad) })).state, 'rejected');
    }
    assert.deepEqual((await fixture()).cart_items, []);
    pass(`${mode}: self, private, draft and unknown products cannot mutate the basket`);
    assert.equal((await call({ ...command, operation: randomUUID(), price_key: 'stale-price' })).state, 'rejected');
    assert.equal((await call(command)).state, 'added');
    assert.equal((await call(command)).state, 'added');
    let next = await fixture();
    assert.deepEqual(next.cart_items, [{ id: product, quantity: 1 }]);
    assert.equal(Number(next.counts.conversion), Number(before.conversion ?? 0) + 1);
    assert.equal(Number(next.counts.cart_addition), Number(before.cart_addition ?? 0) + 1);
    pass(`${mode}: accepted addition persists once and replay does not add or count again`);
    const second = { ...command, operation: randomUUID(), product: String(f.products[2]), price_key: priceKey(f.products[2]) };
    assert.equal((await call(second)).state, 'added');
    next = await fixture();
    assert.equal(Number(next.counts.conversion), Number(before.conversion ?? 0) + 1);
    assert.equal(Number(next.counts.cart_addition), Number(before.cart_addition ?? 0) + 2);
    await client.post('/?rest_route=/wconvert/v1/beacon', { data: { events: [{ optin_id: id, kind: 'conversion' }, { optin_id: id, kind: 'cart_addition' }] } });
    const afterBeacon = await fixture(); assert.deepEqual(afterBeacon.counts, next.counts);
    pass(`${mode}: public beacons cannot forge addition results`);
    pass(`${mode}: a second extra counts as activity but does not count the appearance twice`);
    await fixture('&options_required=1');
    const unsupported = await call({ ...command, operation: randomUUID(), product: String(f.products[3]), price_key: priceKey(f.products[3]) });
    assert.equal(unsupported.state, 'rejected');
    assert.deepEqual((await read()).cards, []);
    await fixture('&options_required=0');
    pass(`${mode}: extension-driven validation uses the product-page fallback`);
    assert.equal((await post('add', { ...command, revision: 'stale' })).status(), 403);
    await fixture('&add_published=0');
    assert.equal((await post('add', { ...command, operation: randomUUID() })).status(), 409);
    await fixture('&add_published=1');
    pass(`${mode}: stale revisions and unpublished campaigns cannot add products`);
  } finally { await client.dispose(); await stranger.dispose(); }
}
console.log(`${checks} real WooCommerce addition checks passed.`);

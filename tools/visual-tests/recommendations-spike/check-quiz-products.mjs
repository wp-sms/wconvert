// Real, disposable WordPress/WooCommerce HTTP checks; no saved merchant site or browser automation.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request } from '@playwright/test';
const baseURL = 'http://127.0.0.1:9445';
let checks = 0; const pass = name => { checks++; console.log(`PASS ${name}`); };
for (const loggedIn of [false, true]) {
  const client = await request.newContext({ baseURL }); const stranger = await request.newContext({ baseURL });
  const mode = loggedIn ? 'authenticated' : 'guest';
  try {
    await client.get(`/?wconvert_commerce_fixture=1&basket=&json=1${loggedIn ? '&login=1' : ''}`);
    const base = await (await client.get('/?wconvert_recommendations_fixture=1&options_required=0')).json();
    await client.get('/?wconvert_result_filter_fixture=1');
    const fixture = async extra => (await client.get('/?wconvert_quiz_fixture=1' + (extra ?? ''))).json();
    const f = await fixture('&stock=in'); const selection = { id: f.id, revision: f.revision, ...f.results[0] };
    console.log(`${mode}: ${JSON.stringify(base.runtime)}`);
    const post = (action, form, who = client, origin = baseURL) => who.post(`/?wc-ajax=wconvert_${action}`, { headers: { Origin: origin }, form });
    const read = async body => (await post('quiz_products', body ?? selection)).json();
    const cards = await read(); assert.equal(cards.length, 3); assert.ok(cards[0].can_add); assert.ok(cards.every(c => c.activity_token));
    assert.equal(cards.find(c => c.id === base.variable).can_add, false);
    assert.equal(cards.find(c => c.id === base.variable).label, 'Choose options');
    assert.deepEqual((await fixture()).cart_items, []); assert.ok(f.report_available);
    pass(`${mode}: public cards work with an empty basket; variable products keep their option links`);
    assert.equal((await post('quiz_products', { ...selection, result: 'forged' })).status(), 409);
    assert.equal((await post('quiz_products', { ...selection, screen: 'forged' })).status(), 409);
    assert.equal((await post('quiz_products', { ...selection, revision: 'stale' })).status(), 409);
    assert.equal((await post('quiz_products', selection, client, 'https://unrelated.example')).status(), 403);
    pass(`${mode}: only the current published result can serve cards`);
    const filtered = await read({ ...selection, ...f.results[1] });
    assert.ok(filtered.length > 0); assert.ok(!filtered.some(c => cards.some(original => original.id === c.id)));
    pass(`${mode}: category results use their own bounded catalog matches`);
    await client.get('/?wconvert_recommendations_fixture=1&options_required=1');
    const optionsOnly = await read(); assert.equal(optionsOnly.length, 3); assert.ok(optionsOnly.every(card => !card.can_add));
    await client.get('/?wconvert_recommendations_fixture=1&options_required=0');
    pass(`${mode}: extension-driven products keep their product-page links instead of hiding the result`);
    const token = (await (await post('cart_begin', { ...selection, mount: randomUUID() })).json()).token; assert.ok(token);
    const command = { ...selection, token, operation: randomUUID(), product: String(cards[0].id), price_key: cards[0].price_key };
    assert.equal((await post('cart_add', command, stranger)).status(), 403);
    assert.equal((await post('cart_add', { ...command, ...f.results[1] })).status(), 403);
    for (const bad of [base.private, base.draft, base.sold_out, base.variable, filtered[0].id, 999999]) {
      assert.equal((await (await post('cart_add', { ...command, operation: randomUUID(), product: String(bad) })).json()).state, 'rejected');
    }
    assert.equal((await (await post('cart_add', { ...command, operation: randomUUID(), price_key: 'stale' })).json()).state, 'rejected');
    pass(`${mode}: cart tokens bind the session and result; forged, unavailable, option and stale-price additions are refused`);
    await fixture('&stock=out');
    assert.equal((await (await post('cart_add', { ...command, operation: randomUUID() })).json()).state, 'rejected');
    await fixture('&stock=in');
    pass(`${mode}: inventory is rechecked after a card was served`);
    const count = (f, kind, scope = '') => Number(f.counts.find(r => r.kind === kind && r.scope === scope)?.total ?? 0);
    const before = await fixture();
    await client.post('/?rest_route=/wconvert/v1/beacon', { data: { events: [{ optin_id: f.id, kind: 'conversion' }] } });
    const completed = await fixture(); assert.equal(count(completed, 'conversion'), count(before, 'conversion') + 1);
    for (let replay = 0; replay < 2; replay++) assert.equal((await (await post('cart_add', command)).json()).state, 'added');
    const after = await fixture(); assert.deepEqual(after.cart_items, [{ id: cards[0].id, quantity: 1 }]);
    assert.equal(count(after, 'cart_addition'), count(before, 'cart_addition') + 1);
    assert.equal(count(after, 'cart_addition', `product:${cards[0].id}`), count(before, 'cart_addition', `product:${cards[0].id}`) + 1);
    assert.equal(count(after, 'conversion'), count(completed, 'conversion'));
    pass(`${mode}: replay adds once and records activity without a second quiz conversion`);
    for (const kind of ['product_shown', 'product_click']) await post('product_activity', { id: f.id, product: String(cards[0].id), kind, token: cards[0].activity_token });
    const observed = await fixture();
    assert.equal(count(observed, 'product_shown', `product:${cards[0].id}`), count(after, 'product_shown', `product:${cards[0].id}`) + 1);
    assert.equal(count(observed, 'product_click', `product:${cards[0].id}`), count(after, 'product_click', `product:${cards[0].id}`) + 1);
    pass(`${mode}: quiz product impressions, clicks and additions share Product activity`);
    await fixture('&published=0'); assert.equal((await post('quiz_products', selection)).status(), 409);
    assert.equal((await post('cart_add', { ...command, operation: randomUUID() })).status(), 409);
    await fixture('&published=1'); pass(`${mode}: unpublished quizzes stop reads and additions`);
  } finally { await client.dispose(); await stranger.dispose(); }
}
console.log(`${checks} real quiz product checks passed.`);

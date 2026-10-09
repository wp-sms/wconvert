// Real WooCommerce curation checks. HTTP only; disposable fixture, no merchant changes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request } from '@playwright/test';
const client = await request.newContext({ baseURL: 'http://127.0.0.1:9445' });
let checks = 0; const pass = text => { checks++; console.log(`PASS ${text}`); };
try {
  await client.get('/?wconvert_commerce_fixture=1&basket=&json=1&login=1');
  const rec = await (await client.get('/?wconvert_recommendations_fixture=1')).json();
  const filters = await (await client.get('/?wconvert_result_filter_fixture=1')).json();
  const f = await (await client.get('/?wconvert_curation_fixture=1&stock=in')).json();
  const p = f.products, source = { category_id: f.category, attributes: [] };
  const read = async filter => {
    const res = await client.get('/?rest_route=/wconvert/v1/product-matches', { params: { filter: JSON.stringify(filter) } });
    assert.equal(res.status(), 200, await res.text()); return (await res.json()).map(row => row.id);
  };
  assert.deepEqual(await read(source), p.slice(0, 3));
  for (const order of ['newest', 'price_low']) assert.deepEqual(await read({ ...source, order }), p.slice(-3).reverse());
  assert.deepEqual(await read({ ...source, order: 'price_high' }), p.slice(0, 3));
  pass('old defaults survive; date and price sorting apply before the twelve-candidate limit');
  assert.deepEqual(await read({ ...source, pinned_ids: [p[17], p[15]] }), [p[17], p[15], p[0]]);
  assert.deepEqual(await read({ ...source, excluded_ids: p.slice(0, 12) }), p.slice(12, 15));
  assert.deepEqual(await read({ ...source, pinned_ids: [p[17], p[15]], excluded_ids: [p[17], p[0]] }), [p[15], p[1], p[2]]);
  pass('pins outside the candidate window lead in chosen order; exclusions apply before the window and beat pins');
  for (const id of [filters.products['blue-small'], filters.products.private, 999999]) assert.deepEqual(await read({ ...source, pinned_ids: [id] }), p.slice(0, 3));
  const blue = { category_id: filters.category, attributes: [{ taxonomy: 'pa_wcf_finish', term_id: filters.terms.blue }], pinned_ids: [filters.products['red-small']] };
  assert.deepEqual(await read(blue), [filters.products['blue-small'], filters.products['blue-large']]);
  await client.get('/?wconvert_curation_fixture=1&stock=out');
  assert.deepEqual(await read({ ...source, pinned_ids: [p[17]] }), p.slice(0, 3));
  await client.get('/?wconvert_curation_fixture=1&stock=in');
  pass('pins cannot bypass category, attributes, publication or live stock; replacements remain matching products');
  const allExcluded = { category_id: filters.category, attributes: [], excluded_ids: Object.values(filters.products) };
  assert.deepEqual(await read(allExcluded), []);
  for (const bad of [{ order: 'random' }, { pinned_ids: [p[0], p[0]] }, { excluded_ids: p.slice(0, 13) }]) assert.equal((await client.get('/?rest_route=/wconvert/v1/product-matches', { params: { filter: JSON.stringify({ ...source, ...bad }) } })).status(), 400);
  pass('empty matches remain empty; malformed curation fails closed');

  const quiz = await (await client.get('/?wconvert_quiz_fixture=1')).json();
  const route = `/?rest_route=/wconvert/v1/optins/${quiz.id}`, headers = { 'X-WP-Nonce': rec.nonce };
  const original = (await (await client.get(route, { headers })).json()).config;
  const originalResult = original.template.tree.steps.find(s => s.kind === 'result').results[1];
  if (originalResult.product_filter.category_id === f.category) originalResult.product_filter = { category_id: filters.category, attributes: [{ taxonomy: 'pa_wcf_finish', term_id: filters.terms.blue }] };
  const config = structuredClone(original); config.frequency.maxPerSession = 100;
  const result = config.template.tree.steps.find(s => s.kind === 'result').results[1];
  result.product_filter = { ...source, order: 'price_low', pinned_ids: [p[15], p[17]], excluded_ids: [p[16]] };
  const save = await client.patch(route, { headers, data: { config } }); assert.equal(save.status(), 200, await save.text());
  const stored = (await (await client.get(route, { headers })).json()).config;
  assert.deepEqual(stored.template.tree.steps.find(s => s.kind === 'result').results[1].product_filter, result.product_filter);
  const live = await (await client.get('/?wconvert_quiz_fixture=1&published=1')).json();
  const selection = { id: live.id, revision: live.revision, ...live.results[1] };
  const post = (action, form) => client.post(`/?wc-ajax=wconvert_${action}`, { headers: { Origin: 'http://127.0.0.1:9445' }, form });
  const cards = await (await post('quiz_products', selection)).json();
  assert.deepEqual(cards.map(c => c.id), [p[15], p[17], p[14]]);
  const token = (await (await post('cart_begin', { ...selection, mount: randomUUID() })).json()).token; assert.ok(token);
  const command = { ...selection, token, operation: randomUUID(), product: String(p[16]), price_key: cards[0].price_key };
  assert.equal((await (await post('cart_add', command)).json()).state, 'rejected');
  assert.equal((await (await post('cart_add', { ...command, operation: randomUUID(), product: String(cards[0].id) })).json()).state, 'added');
  pass('draft save and publication preserve curation; live cards and protected cart additions enforce it');
  await client.get('/?wconvert_curation_fixture=1&stock=out');
  for (const mode of ['']) {
    const health = await (await client.get(`/?rest_route=/wconvert/v1/optins/product-health&ids[]=${quiz.id}${mode}`, { headers })).json();
    assert.match(health[0].checks[1].message, /pinned product is unavailable/);
  }
  assert.equal((await (await post('cart_add', { ...command, operation: randomUUID(), product: String(p[17]), price_key: cards[1].price_key })).json()).state, 'rejected');
  await client.get('/?wconvert_curation_fixture=1&stock=in');
  const recovered = await (await client.get(`/?rest_route=/wconvert/v1/optins/product-health&ids[]=${quiz.id}`, { headers })).json();
  assert.equal(recovered[0].checks[1].state, 'ok');
  for (const screen of config.template.tree.steps) for (const choice of screen.results ?? []) choice.product_action = 'link';
  assert.equal((await client.patch(route, { headers, data: { config } })).status(), 200);
  await client.get('/?wconvert_quiz_fixture=1&published=1');
  await client.get('/?wconvert_curation_fixture=1&stock=out');
  const links = await (await client.get(`/?rest_route=/wconvert/v1/optins/product-health&ids[]=${quiz.id}&wconvert_health_mode=links`, { headers })).json();
  assert.match(links[0].checks[1].message, /pinned product is unavailable/);
  await client.get('/?wconvert_curation_fixture=1&stock=in');
  pass('both warning adapters flag unavailable pins, recover after restocking, and stale cart additions fail');
  original.frequency.maxPerSession = 100;
  assert.equal((await client.patch(route, { headers, data: { config: original } })).status(), 200);
  await client.get('/?wconvert_quiz_fixture=1&published=1');
  console.log(`${checks} grouped curation checks passed: ${JSON.stringify(rec.runtime)}`);
} finally { await client.dispose(); }

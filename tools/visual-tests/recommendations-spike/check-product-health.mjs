// Real WooCommerce reads in the disposable fixture only. No merchant site is modified.
import assert from 'node:assert/strict';
import { request } from '@playwright/test';
const client = await request.newContext({ baseURL: 'http://127.0.0.1:9445' });
const guest = await request.newContext({ baseURL: 'http://127.0.0.1:9445' });
let checks = 0;
const pass = text => { checks++; console.log(`PASS ${text}`); };
try {
  const base = await (await client.get('/?wconvert_commerce_fixture=1&basket=&json=1&login=1')).json();
  const rec = await (await client.get('/?wconvert_recommendations_fixture=1')).json();
  const filters = await (await client.get('/?wconvert_result_filter_fixture=1')).json();
  const quiz = await (await client.get('/?wconvert_quiz_fixture=1&stock=in')).json();
  const route = '/?rest_route=/wconvert/v1/optins';
  const headers = { 'X-WP-Nonce': rec.nonce };
  const health = async (ids, mode = '') => {
    const query = ids.map(id => `&ids[]=${id}`).join('');
    const res = await client.get(`${route}/product-health${query}${mode ? `&wconvert_health_mode=${mode}` : ''}`, { headers });
    assert.equal(res.status(), 200, await res.text()); return res.json();
  };
  const saved = async id => (await client.get(`${route}/${id}`, { headers })).json();
  const draft = async (id, config) => {
    if (config.frequency?.maxPerSession > 100) config.frequency.maxPerSession = 100;
    const res = await client.patch(`${route}/${id}`, { headers, data: { config } });
    assert.equal(res.status(), 200, await res.text());
  };
  const results = config => config.template.tree.steps.find(screen => screen.kind === 'result').results;
  assert.ok([401, 403].includes((await guest.get(`${route}/product-health&ids[]=${quiz.id}`)).status()));
  assert.equal((await client.get(`${route}/product-health&ids[]=invalid`, { headers })).status(), 400);
  assert.equal((await client.get(`${route}/product-health${Array(13).fill(`&ids[]=${quiz.id}`).join('')}`, { headers })).status(), 400);
  pass('admin-only route rejects guest, malformed and oversized requests');

  const healthy = await health([quiz.id, rec.campaigns.add, base.cross_id]);
  assert.ok(healthy[0].checks.every(check => check.state === 'ok'));
  assert.equal(healthy[1].checks[0].state, 'ok');
  assert.equal(healthy[2].checks[0].state, 'context');
  pass('healthy quiz/addition sources are checked; basket-dependent cross-sells are not guessed');

  await client.get('/?wconvert_quiz_fixture=1&stock=out');
  let checked = (await health([quiz.id]))[0];
  assert.equal(checked.basis, 'published'); assert.equal(checked.checks[0].state, 'warning');
  assert.match(checked.checks[0].message, /Reusable coffee filters/);
  const original = (await saved(quiz.id)).config;
  const repaired = structuredClone(original); results(repaired)[0].product_ids = [base.products[2]];
  await draft(quiz.id, repaired);
  assert.equal((await health([quiz.id]))[0].checks[0].state, 'warning');
  await client.get('/?wconvert_quiz_fixture=1&published=0');
  checked = (await health([quiz.id]))[0];
  assert.equal(checked.basis, 'draft'); assert.equal(checked.checks[0].state, 'ok');
  pass('stock warnings identify the product; unpublished repairs cannot conceal the published problem');

  const reserve = structuredClone(repaired); results(reserve)[0].product_ids = [base.products[2], base.products[3], base.variable, base.sold_out];
  await draft(quiz.id, reserve);
  assert.match((await health([quiz.id]))[0].checks[0].message, /Unavailable accessory/);
  pass('unavailable reserve products are checked beyond the first three visible cards');

  const empty = structuredClone(repaired); results(empty)[1].product_filter.attributes = [{ taxonomy: 'pa_wcf_finish', term_id: filters.terms.red }, { taxonomy: 'pa_wcf_size', term_id: filters.terms.large }];
  await draft(quiz.id, empty);
  assert.match((await health([quiz.id]))[0].checks[1].message, /No available products match/);
  assert.equal((await health([quiz.id], 'read_error'))[0].checks[1].state, 'unknown');
  results(empty)[1].product_filter.category_id = 999999;
  await draft(quiz.id, empty);
  assert.match((await health([quiz.id]))[0].checks[1].message, /category or attribute is missing/);
  pass('empty filters, deleted references and failed catalog reads have distinct states');

  const links = structuredClone(repaired); for (const result of results(links)) result.product_action = 'link';
  results(links)[0].product_ids = [base.products[2], base.sold_out];
  await draft(quiz.id, links);
  checked = (await health([quiz.id], 'links'))[0];
  assert.equal(checked.checks[0].state, 'warning'); assert.equal(checked.checks[1].state, 'ok');
  pass('ordinary quiz links use their Store API eligibility without the commerce adapter');

  await client.get('/?wconvert_quiz_fixture=1&stock=in');
  await client.get('/?wconvert_recommendations_fixture=1&options_required=1');
  assert.match((await health([rec.campaigns.add]))[0].checks[0].message, /None of these products supports Add to cart/);
  await client.get('/?wconvert_recommendations_fixture=1&options_required=0');
  const cross = (await saved(rec.campaigns.page_cross)).config;
  const crossNode = cross.template.tree.steps[0].content.children.find(node => node.type === 'products');
  crossNode.main_product_id = base.products[3];
  const created = await client.post(route, { headers, data: { name: 'Product warning example', goal: 'promote_offer', config: cross } });
  assert.equal(created.status(), 201, await created.text()); const extra = await created.json();
  assert.match((await health([extra.id]))[0].checks[0].message, /No cross-sells are set/);
  crossNode.main_product_id = base.private_accessory;
  await draft(extra.id, cross);
  assert.match((await health([extra.id]))[0].checks[0].message, /main product is unavailable/);
  pass('missing cross-sells, unavailable main products and unsupported direct additions are actionable');

  await draft(quiz.id, original); await client.get('/?wconvert_quiz_fixture=1&stock=in&published=1');
  checked = (await health([quiz.id]))[0]; assert.ok(checked.checks.every(check => check.state === 'ok'));
  const after = await (await client.get('/?wconvert_quiz_fixture=1')).json();
  assert.deepEqual(after.cart_items, quiz.cart_items); assert.deepEqual(after.counts, quiz.counts);
  pass('rechecking clears repaired warnings without cart changes or recorded product activity');
  console.log(`${checks} grouped product-health checks passed: ${JSON.stringify(rec.runtime)}`);
} finally { await client.dispose(); await guest.dispose(); }

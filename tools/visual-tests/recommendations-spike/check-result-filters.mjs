// HTTP-only integration checks against real WooCommerce in the disposable site.
import assert from 'node:assert/strict';
import { request } from '@playwright/test';
const client = await request.newContext({ baseURL: 'http://127.0.0.1:9445' });
let checks = 0;
const pass = text => { checks++; console.log(`PASS ${text}`); };
try {
  const f = await (await client.get('/?wconvert_result_filter_fixture=1')).json();
  const read = filter => client.get('/?rest_route=/wconvert/v1/product-matches', { params: { filter: JSON.stringify(filter) } });
  const source = { category_id: f.category, attributes: [] };
  const ids = response => response.json().then(rows => rows.map(row => row.id));
  const category = await read(source);
  assert.equal(category.status(), 200);
  assert.match(category.headers()['cache-control'], /no-store/);
  assert.deepEqual(await ids(category), ['blue-small', 'red-small', 'blue-large'].map(name => f.products[name]));
  pass('category includes descendants in stable order; hidden, unavailable, private, draft and password products stay out');
  const blue = { ...source, attributes: [{ taxonomy: 'pa_wcf_finish', term_id: f.terms.blue }] };
  assert.deepEqual(await ids(await read(blue)), [f.products['blue-small'], f.products['blue-large']]);
  pass('global attribute term narrows the category');
  const both = { ...blue, attributes: [...blue.attributes, { taxonomy: 'pa_wcf_size', term_id: f.terms.small }] };
  assert.deepEqual(await ids(await read(both)), [f.products['blue-small']]);
  pass('multiple attributes use AND, not OR');
  assert.deepEqual(await ids(await read({ ...both, attributes: [{ taxonomy: 'pa_wcf_finish', term_id: f.terms.red }, { taxonomy: 'pa_wcf_size', term_id: f.terms.large }] })), []);
  pass('empty intersection returns no unrelated products');
  for (const invalid of [{ category_id: 0, attributes: [] }, { category_id: 999999, attributes: [] }, { ...source, attributes: [{ taxonomy: 'pa_missing', term_id: 1 }] }, { ...source, attributes: [{ taxonomy: 'pa_wcf_finish', term_id: f.terms.small }] }, { ...source, attributes: [...blue.attributes, ...blue.attributes] }, { ...source, attributes: Array(4).fill(blue.attributes[0]) }]) assert.equal((await read(invalid)).status(), 400);
  pass('incomplete, stale, mismatched, duplicate and excessive filters fail closed');
  const optionsGuest = await client.get('/?rest_route=/wconvert/v1/product-filters');
  assert.equal(optionsGuest.status(), 401);
  pass('admin catalog picker requires authentication');
  await client.get('/?wconvert_commerce_fixture=1&basket=&json=1&login=1');
  const setup = await (await client.get('/?wconvert_recommendations_fixture=1')).json();
  for (const taxonomy of ['product_cat', 'attributes', 'pa_wcf_finish']) {
    const options = await client.get('/?rest_route=/wconvert/v1/product-filters', { params: { taxonomy, _wpnonce: setup.nonce } });
    assert.equal(options.status(), 200);
    const data = await options.json();
    assert.ok(data.items.length > 0 && data.items.length <= 41);
  }
  pass('authenticated category, attribute and value pickers return bounded choices');
  await client.get('/?wconvert_result_filter_fixture=1&delete_red=1');
  assert.equal((await read({ ...source, attributes: [{ taxonomy: 'pa_wcf_finish', term_id: f.terms.red }] })).status(), 400);
  pass('deleting a saved term never widens recommendations');
  console.log(`${checks} grouped result-filter checks passed.`);
} finally { await client.dispose(); }

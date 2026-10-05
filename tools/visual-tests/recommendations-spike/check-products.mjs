// HTTP-only checks against the disposable site. Browser verification uses Codex's browser tools.
import assert from 'node:assert/strict';
import { request } from '@playwright/test';
const baseURL = 'http://127.0.0.1:9445';
let checks = 0;
const pass = message => { checks++; console.log(`PASS ${message}`); };
for (const loggedIn of [false, true]) {
  const client = await request.newContext({ baseURL });
  const mode = loggedIn ? 'authenticated' : 'guest';
  try {
    const base = await (await client.get(`/?wconvert_commerce_fixture=1&basket=&json=1${loggedIn ? '&login=1' : ''}`)).json();
    const setup = await client.get('/?wconvert_recommendations_fixture=1&theme=classic');
    const f = await setup.json();
    const campaigns = Object.fromEntries([base.id, ...Object.values(f.campaigns)].map(id => [id, f.revisions[id]]));
    const productHtml = await (await client.get(f.product_url)).text();
    const token = productHtml.match(/data-commerce-product="([^"]+)"/)?.[1];
    assert.equal(token, f.main_token);
    assert.ok(productHtml.includes(`data-wconvert-auto="${f.campaigns.page}"`));
    pass(`${mode}: real classic product template emits signed page context and automatic candidate`);
    const read = async pageProduct => {
      const result = await client.post('/?wc-ajax=wconvert_cart_context', { form: { campaigns: JSON.stringify(campaigns), ...(pageProduct ? { page_product: pageProduct } : {}) } });
      assert.equal(result.status(), 200);
      assert.match(result.headers()['cache-control'], /no-cache|no-store/);
      return result.json();
    };
    const answer = await read(token);
    assert.deepEqual(answer[f.campaigns.page].cards.map(p => p.id), f.products.slice(1));
    assert.deepEqual(answer[f.campaigns.page_cross].cards.map(p => p.id), [f.products[2], f.products[1], f.products[3]]);
    assert.equal(answer[f.campaigns.page].rules[`${f.campaigns.page}:products`], true);
    assert.deepEqual(answer[f.campaigns.cart_main].cards, []);
    assert.deepEqual(answer[base.id].cards, []);
    pass(`${mode}: empty basket allows product context while old and new basket campaigns stay hidden`);
    for (const invalid of [undefined, `${f.products[0]}:forged`, f.private_token]) {
      const result = await read(invalid);
      assert.deepEqual(result[f.campaigns.page].cards, []);
      assert.deepEqual(result[f.campaigns.page_cross].cards, []);
    }
    pass(`${mode}: absent, forged and signed private-product contexts cannot show recommendations`);
    const otherHtml = await (await client.get(f.other_url)).text();
    const otherToken = otherHtml.match(/data-commerce-product="([^"]+)"/)?.[1];
    assert.ok(otherToken);
    assert.deepEqual((await read(otherToken))[f.campaigns.page].cards, []);
    pass(`${mode}: another public product does not match the chosen main product`);
    await client.get('/?wconvert_commerce_fixture=1&basket=0,2&json=1');
    const inBasket = await read(token);
    assert.deepEqual(inBasket[f.campaigns.page].cards.map(p => p.id), [f.products[1], f.products[3]]);
    assert.deepEqual(inBasket[f.campaigns.cart_main].cards.map(p => p.id), [f.products[1], f.products[3]]);
    pass(`${mode}: main product narrows cross-sell seeds and excludes an extra already in the basket`);
    await client.get('/?wconvert_commerce_fixture=1&basket=1,2,3&json=1');
    const exhausted = await read(token);
    assert.deepEqual(exhausted[f.campaigns.page].cards, []);
    assert.equal(exhausted[f.campaigns.page].rules[`${f.campaigns.page}:products`], false);
    assert.deepEqual(exhausted[f.campaigns.cart_main].cards, []);
    pass(`${mode}: all extras already in the basket suppress the offer; unrelated basket does not satisfy main-product mode`);
    await client.get('/?wconvert_commerce_fixture=1&basket=0,1,2,3&json=1');
    assert.deepEqual((await read(token))[f.campaigns.cart_main].cards, []);
    pass(`${mode}: main product with every extra already present has no remaining recommendations`);
    await client.get('/?wconvert_commerce_fixture=1&basket=0,2&json=1');
    if (loggedIn) {
      const preview = async viewed => client.post('/?rest_route=/wconvert/v1/commerce/preview', { headers: { 'X-WP-Nonce': f.nonce }, data: {
        items: [], amount: 0, total: 0, state: 'known', rules: [], viewed_product_id: viewed,
        products: { context: 'product', main_product_id: f.products[0], source: 'cross_sells', product_ids: [], exclude_cart: true },
      } });
      const p = await preview(f.products[0]); assert.equal(p.status(), 200);
      assert.deepEqual((await p.json()).cards.map(p => p.id), [f.products[2], f.products[1], f.products[3]]);
      assert.equal((await (await preview(f.products[1])).json()).eligible, false);
      assert.equal((await preview(f.private)).status(), 400);
      pass('admin: sample viewed product is separate from basket and refuses private products');
      const sample = async (products, extra = {}) => {
        const response = await client.post('/?rest_route=/wconvert/v1/commerce/preview', { headers: { 'X-WP-Nonce': f.nonce }, data: {
          items: [], amount: 0, total: 0, state: 'known', rules: [], viewed_product_id: f.products[0],
          products: { context: 'product', main_product_id: f.products[0], source: 'selected', product_ids: [], exclude_cart: true, ...products }, ...extra,
        } });
        assert.equal(response.status(), 200);
        assert.match(response.headers()['cache-control'], /no-store/);
        return response.json();
      };
      const filtered = await sample({ product_ids: [base.sold_out, f.draft, f.private, f.products[0], f.products[1]] });
      assert.deepEqual(filtered.cards.map(p => p.id), [f.products[1]]);
      assert.equal(filtered.cards[0].label, 'View product');
      assert.match(filtered.cards[0].url, /^http:\/\/127\.0\.0\.1:9445\//);
      pass('admin: selected source skips sold-out, draft, private and main products before choosing available extras');
      const unavailable = await sample({ product_ids: [base.sold_out] });
      assert.equal(unavailable.eligible, false); assert.equal(unavailable.reason, 'unavailable');
      const noPairing = await sample({ source: 'cross_sells', main_product_id: f.products[3] }, { viewed_product_id: f.products[3] });
      assert.equal(noPairing.eligible, false); assert.equal(noPairing.reason, 'no_relationships');
      pass('admin: unavailable shortlist and missing cross-sells give distinct explanations without substitutes');
      for (const state of ['unknown', 'blocked']) {
        const result = await sample({ product_ids: [f.products[1]] }, { state });
        assert.equal(result.eligible, false); assert.deepEqual(result.cards, []);
      }
      pass('admin: unknown basket and missing consent cannot show recommendations');
      const repeated = await sample({ product_ids: [f.products[1]], exclude_cart: false }, { items: [{ id: f.products[1], quantity: 1 }] });
      assert.deepEqual(repeated.cards.map(p => p.id), [f.products[1]]);
      const excluded = await sample({ product_ids: [f.products[1]] }, { items: [{ id: f.products[1], quantity: 1 }] });
      assert.equal(excluded.eligible, false);
      pass('admin: basket exclusion follows the merchant setting');
      const unchanged = await (await client.get('/?wconvert_commerce_fixture=1&json=1')).json();
      assert.equal(unchanged.cart_count, 2);
      pass('admin: sample visits leave the real two-item basket unchanged');
    }
  } finally { await client.dispose(); }
}
const block = await request.newContext({ baseURL });
try {
  const f = await (await block.get('/?wconvert_recommendations_fixture=1&theme=block')).json();
  const html = await (await block.get(f.product_url)).text();
  assert.ok(html.includes('Manual campaign block in a real product template.'));
  assert.ok(html.includes(`data-wconvert-optin="${f.campaigns.page}"`));
  assert.ok(!html.includes(`data-wconvert-auto="${f.campaigns.page}"`));
  assert.ok(html.includes('data-commerce-product='));
  pass('block theme: saved product template renders manual campaign anchor and page context without automatic duplicate');
} finally { await block.dispose(); }
console.log(`${checks} product recommendation integration checks passed`);

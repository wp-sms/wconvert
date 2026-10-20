import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const options = {
  modules: true, script: readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8'),
  compatibilityDate: '2026-10-01', r2Buckets: ['PUBLIC_TEMPLATES', 'PRIVATE_TEMPLATES'],
  bindings: { ...config.vars, NEXUS_SERVICE_KEY: 'fixture-service-key' },
  outboundService: () => { throw Error('The rate-limit fixture must never call Nexus'); },
};
test('actual edge bindings count grants separately from private GET/HEAD/retries and isolate IPs', async t => {
  const mf = new Miniflare(convertV4MiniflareOptions({
    ...options, ratelimits: {
      GRANT_RATE_LIMITER: { namespace_id: '1', simple: { limit: 2, period: 60 } },
      DOWNLOAD_RATE_LIMITER: { namespace_id: '2', simple: { limit: 3, period: 60 } },
    },
  }));
  t.after(() => mf.dispose());
  await (await mf.getR2Bucket('PUBLIC_TEMPLATES')).put('manifest.json', JSON.stringify({schema: 2, release: 'a'.repeat(64), pages: []}));
  const send = (path, method = 'GET', ip = '192.0.2.1') => mf.dispatchFetch('https://templates.wconvert.io' + path, {
    method, headers: { 'CF-Connecting-IP': ip, 'Content-Type': 'application/json', 'If-None-Match': '*' },
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
  assert.equal((await send('/grants', 'POST')).status, 400);
  assert.equal((await send('/grants', 'POST')).status, 400);
  const limited = await send('/grants', 'POST');
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '60');
  assert.equal(limited.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await limited.json(), { error_code: 'rate_limited' });
  const path = `/downloads/${'a'.repeat(64)}.json`, asset = `/assets/premium/${'b'.repeat(64)}.png`;
  assert.equal((await send(path)).status, 401);
  assert.equal((await send(path, 'HEAD')).status, 401);
  assert.equal((await send(asset)).status, 401);
  const head = await send(asset, 'HEAD'); assert.equal(head.status, 429); assert.equal(await head.text(), '');
  assert.equal((await send(path)).status, 429);
  assert.equal((await send(path, 'GET', '192.0.2.2')).status, 401);
  assert.equal((await send('/grants', 'POST', '192.0.2.2')).status, 400);
  assert.equal((await send('/manifest.json')).status, 304);
});
test('missing rate bindings fail closed for premium while public remains available', async t => {
  const mf = new Miniflare(convertV4MiniflareOptions(options)); t.after(() => mf.dispose());
  await (await mf.getR2Bucket('PUBLIC_TEMPLATES')).put('manifest.json', JSON.stringify({schema: 2, release: 'a'.repeat(64), pages: []}));
  for (const [path, method] of [['/grants', 'POST'], [`/downloads/${'a'.repeat(64)}.json`, 'GET']]) {
    const response = await mf.dispatchFetch('https://templates.wconvert.io' + path, { method });
    assert.equal(response.status, 503); assert.equal(response.headers.get('Retry-After'), '60');
    assert.deepEqual(await response.json(), { error_code: 'rate_limit_unavailable' });
  }
  assert.equal((await mf.dispatchFetch('https://templates.wconvert.io/manifest.json')).status, 200);
});

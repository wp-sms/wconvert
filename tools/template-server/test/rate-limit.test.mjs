import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import worker from '../dist/index.js';
const hash = value => createHash('sha256').update(value).digest('hex');
const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const options = {
  modules: true, script: readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8'),
  compatibilityDate: '2026-10-01', r2Buckets: ['PUBLIC_TEMPLATES', 'PRIVATE_TEMPLATES'],
  bindings: { ...config.vars, NEXUS_SERVICE_KEY: 'fixture-service-key' },
  outboundService: () => { throw Error('The rate-limit fixture must never call Nexus'); },
};
const limits = (grant, grantIp, download, downloadIp) => ({ ratelimits: {
  GRANT_RATE_LIMITER: { namespace_id: '1', simple: { limit: grant, period: 60 } },
  GRANT_IP_RATE_LIMITER: { namespace_id: '2', simple: { limit: grantIp, period: 60 } },
  DOWNLOAD_RATE_LIMITER: { namespace_id: '3', simple: { limit: download, period: 60 } },
  DOWNLOAD_IP_RATE_LIMITER: { namespace_id: '4', simple: { limit: downloadIp, period: 60 } },
} });
const pointer = JSON.stringify({ schema: 3, minor: 0, release: 'a'.repeat(64), withdrawn: [] });
const batch = domain => JSON.stringify({ domain, designs: ['a'.repeat(64)], setups: [] });
const file = `/v3/premium/designs/${'a'.repeat(64)}.json`, image = `/v3/premium/assets/${'b'.repeat(64)}.png`;

test('wrangler declares all four counters, with distinct namespaces', () => {
  const ids = [];
  for (const section of [config]) {
    const named = Object.fromEntries(section.ratelimits.map(item => [item.name, item.simple]));
    assert.deepEqual(named, {
      GRANT_RATE_LIMITER: { limit: 30, period: 60 }, GRANT_IP_RATE_LIMITER: { limit: 600, period: 60 },
      DOWNLOAD_RATE_LIMITER: { limit: 1000, period: 60 }, DOWNLOAD_IP_RATE_LIMITER: { limit: 6000, period: 60 },
    });
    ids.push(...section.ratelimits.map(item => item.namespace_id));
  }
  assert.equal(new Set(ids).size, 4);
});

test('grants count per site behind one shared IP, under a looser per-IP ceiling', async t => {
  const mf = new Miniflare(convertV4MiniflareOptions({ ...options, ...limits(2, 5, 100, 100) }));
  t.after(() => mf.dispose());
  const grant = (domain, ip = '192.0.2.1', body = batch(domain)) => mf.dispatchFetch('https://templates.wconvert.io/v3/grants', {
    method: 'POST', headers: { 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' }, body,
  });
  // No licence: a counted, well-formed batch is refused 401 before storage or Nexus.
  assert.equal((await grant('a.example')).status, 401);
  assert.equal((await grant('a.example')).status, 401);
  const limited = await grant('a.example');
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '60');
  assert.equal(limited.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await limited.json(), { error_code: 'rate_limited' });
  assert.equal((await grant('A.EXAMPLE')).status, 429, 'the domain counter ignores case');
  assert.equal((await grant('b.example')).status, 401, 'another site on the same IP keeps its own allowance');
  assert.equal((await grant('a.example', '192.0.2.2')).status, 401, 'the same domain from another IP is another key');
  // Five requests from 192.0.2.1 so far: the per-IP ceiling now refuses everything from it.
  const ceiling = await grant('c.example');
  assert.equal(ceiling.status, 429); assert.deepEqual(await ceiling.json(), { error_code: 'rate_limited' });
  assert.equal((await grant('d.example', '192.0.2.1', '{')).status, 429, 'malformed bodies count against the IP ceiling');
});

test('downloads count per pass, under a looser per-IP ceiling', async t => {
  const mf = new Miniflare(convertV4MiniflareOptions({ ...options, ...limits(100, 100, 3, 6) }));
  t.after(() => mf.dispose());
  await (await mf.getR2Bucket('PUBLIC_TEMPLATES')).put('v3/manifest.json', pointer);
  const send = (path, { method = 'GET', ip = '192.0.2.1', pass } = {}) => mf.dispatchFetch('https://templates.wconvert.io' + path, {
    method, headers: { 'CF-Connecting-IP': ip, 'If-None-Match': '*', ...(pass ? { Authorization: `Bearer ${pass}` } : {}) },
  });
  assert.equal((await send(file, { pass: 'one.pass.a' })).status, 401);
  assert.equal((await send(file, { method: 'HEAD', pass: 'one.pass.a' })).status, 401);
  assert.equal((await send(image, { pass: 'one.pass.a' })).status, 401);
  const head = await send(image, { method: 'HEAD', pass: 'one.pass.a' });
  assert.equal(head.status, 429, 'every file under one pass shares its counter'); assert.equal(await head.text(), '');
  assert.equal((await send(file, { pass: 'two.pass.b' })).status, 401, 'another pass from the same IP keeps its own allowance');
  assert.equal((await send(file)).status, 401, 'no pass: refused without a pass counter');
  // Six requests from 192.0.2.1: its ceiling now refuses a fresh pass too.
  assert.equal((await send(file, { pass: 'three.pass.c' })).status, 429);
  assert.equal((await send(file, { ip: '192.0.2.2', pass: 'four.pass.d' })).status, 401);
  assert.equal((await send('/v3/manifest.json')).status, 304, 'public reads use no counter');
});

test('counter keys: IP + SHA-256(domain), SHA-256(pass), never a raw domain or pass', async () => {
  const keys = [];
  const limiter = name => ({ limit: async ({ key }) => { keys.push([name, key]); return { success: true }; } });
  const env = { ...config.vars, NEXUS_SERVICE_KEY: 'k', GRANT_RATE_LIMITER: limiter('grant'), GRANT_IP_RATE_LIMITER: limiter('grant-ip'),
    DOWNLOAD_RATE_LIMITER: limiter('download'), DOWNLOAD_IP_RATE_LIMITER: limiter('download-ip'),
    PRIVATE_TEMPLATES: { get: async () => null }, PUBLIC_TEMPLATES: { get: async () => null } };
  const ip = { 'CF-Connecting-IP': '203.0.113.9' };
  await worker.fetch(new Request('https://templates.wconvert.io/v3/grants', { method: 'POST', headers: { ...ip, 'Content-Type': 'application/json' }, body: batch('Shop.Example') }), env);
  await worker.fetch(new Request('https://templates.wconvert.io' + file, { headers: { ...ip, Authorization: 'Bearer a.b.c' } }), env);
  assert.deepEqual(keys, [
    ['grant-ip', 'wconvert:grants-ip:203.0.113.9'],
    ['grant', `wconvert:grants:203.0.113.9:${hash('shop.example')}`],
    ['download-ip', 'wconvert:downloads-ip:203.0.113.9'],
    ['download', `wconvert:downloads:${hash('a.b.c')}`],
  ]);
});

test('missing rate bindings fail closed for premium while public remains available', async t => {
  const mf = new Miniflare(convertV4MiniflareOptions(options)); t.after(() => mf.dispose());
  await (await mf.getR2Bucket('PUBLIC_TEMPLATES')).put('v3/manifest.json', pointer);
  for (const [path, method, body] of [['/v3/grants', 'POST', batch('a.example')], [file, 'GET'], [image, 'HEAD']]) {
    const response = await mf.dispatchFetch('https://templates.wconvert.io' + path, { method, body, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer a.b.c' } });
    assert.equal(response.status, 503); assert.equal(response.headers.get('Retry-After'), '60');
    if (method !== 'HEAD') assert.deepEqual(await response.json(), { error_code: 'rate_limit_unavailable' });
  }
  // Only the per-site grant counter missing: still closed, after the body is read.
  const partial = new Miniflare(convertV4MiniflareOptions({ ...options, ratelimits: { GRANT_IP_RATE_LIMITER: { namespace_id: '2', simple: { limit: 100, period: 60 } } } }));
  t.after(() => partial.dispose());
  const response = await partial.dispatchFetch('https://templates.wconvert.io/v3/grants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: batch('a.example') });
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error_code: 'rate_limit_unavailable' });
  assert.equal((await mf.dispatchFetch('https://templates.wconvert.io/v3/manifest.json')).status, 200);
});

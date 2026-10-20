import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promote, readPublicRelease, readPrivateRelease, stagePrivate, hash } from '../scripts/storage.mjs';
import { catalogue, release, writeDirectory, json } from './fixtures.mjs';
const script = readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8');
const runtime = (options = {}) => new Miniflare(convertV4MiniflareOptions({ modules: true, script, compatibilityDate: '2026-10-01', r2Buckets: ['PUBLIC_TEMPLATES', 'PRIVATE_TEMPLATES'], ...options }));
const H = 'a'.repeat(64);
const one = catalogue({ designs: [{ id: 'reading-slip', images: ['free'] }, { id: 'night-owl', tier: 'pro', images: ['premium', 'free'] }], setups: [{ id: 'welcome-discount', design: 'reading-slip' }] });
const two = catalogue({ designs: [{ id: 'reading-slip', images: ['free'] }, { id: 'night-owl', tier: 'pro', images: ['premium', 'free'] }, { id: 'third-design' }], label: 'two' });
const three = catalogue({ designs: [{ id: 'reading-slip', images: ['free'] }, { id: 'night-owl', tier: 'pro', images: ['premium', 'free'] }, { id: 'fourth-design' }], label: 'three' });

test('actual Worker/R2 runtime: v3 routes, headers, pointer revalidation and atomic promotion', async t => {
  const mf = runtime(); t.after(() => mf.dispose());
  const bucket = await mf.getR2Bucket('PUBLIC_TEMPLATES');
  const fetch = (path, options) => mf.dispatchFetch('https://templates.example' + path, options);
  await t.test('no catalogue before seeding', async () => assert.equal((await fetch('/v3/manifest.json')).status, 404));
  await t.test('promotion, retry and reuse', async () => {
    assert.equal((await promote(bucket, release(one), null)).created, one.public.size);
    assert.equal((await promote(bucket, release(one), one.id)).created, 0);
    await assert.rejects(promote(bucket, release(two), null), /Current release changed/);
  });
  await t.test('the pointer must revalidate and answers 304 to its ETag', async () => {
    const response = await fetch('/v3/manifest.json');
    assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), one.pointer);
    assert.equal(response.headers.get('cache-control'), 'no-cache, must-revalidate');
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(response.headers.get('link'), null, 'no discovery header in v3');
    const tag = response.headers.get('etag'); assert(tag);
    for (const value of [tag, 'W/' + tag, `"other", ${tag}`, '*']) {
      const cached = await fetch('/v3/manifest.json', { headers: { 'If-None-Match': value } });
      assert.equal(cached.status, 304, value); assert.equal(await cached.text(), ''); assert.equal(cached.headers.get('etag'), tag);
    }
    assert.equal((await fetch('/v3/manifest.json', { headers: { 'If-None-Match': '"stale"' } })).status, 200);
  });
  await t.test('immutable objects: GET, HEAD, ETag and types', async () => {
    const keys = [...one.public.keys()];
    const types = { json: 'application/json; charset=utf-8', html: 'text/html; charset=utf-8', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
    for (const prefix of ['v3/releases/', 'v3/index/', 'v3/designs/', 'v3/setups/', 'v3/assets/', 'v3/thumbs/', 'v3/og/', 'v3/previews/']) {
      const key = keys.find(key => key.startsWith(prefix)); assert(key, prefix);
      const response = await fetch('/' + key);
      assert.equal(response.status, 200, key); assert.deepEqual(Buffer.from(await response.arrayBuffer()), one.public.get(key));
      assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
      assert.equal(response.headers.get('content-type'), types[key.split('.').pop()]);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      const head = await fetch('/' + key, { method: 'HEAD' }); assert.equal(await head.text(), ''); assert.equal(head.headers.get('content-length'), String(one.public.get(key).length));
      assert.equal((await fetch('/' + key, { headers: { 'If-None-Match': 'W/' + response.headers.get('etag') } })).status, 304);
    }
    const double = keys.find(key => key.endsWith('@2x.webp'));
    assert.equal((await fetch('/' + double)).headers.get('content-type'), 'image/webp');
    const preview = await fetch('/' + keys.find(key => key.startsWith('v3/previews/')));
    assert.match(preview.headers.get('content-security-policy'), /^sandbox allow-scripts;.*frame-ancestors 'none'$/);
    assert.equal((await fetch('/' + keys.find(key => key.startsWith('v3/designs/')))).headers.get('content-security-policy'), "default-src 'none'; frame-ancestors 'none'");
  });
  await t.test('strict routing, methods and query strings', async () => {
    for (const path of ['/v3/', '/v3/designs/latest.json', `/v3/thumbs/${H}@3x.webp`, `/v3/og/${H}.png`, `/v3/assets/${H}.gif`, `/v3/premium/designs/${H}.html`,
      `/v3/grants/${H}.json`, `/grants/${H}.json`, `/v3/releases/${H}/manifest.json`, `/v4/manifest.json`, '/.publish.lock', `/v3/designs/%2fv3%2fdesigns%2f${H}.json`]) {
      const response = await fetch(path); assert.equal(response.status, 404, path); assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.equal((await fetch('/v3/manifest.json', { method: 'POST' })).status, 405);
    assert.equal((await fetch('/v3/grants')).status, 405);
    assert.equal((await fetch('/v3/manifest.json?license=anything')).status, 400);
  });
  await t.test('removed v2 premium routes are gone', async () => {
    for (const path of ['/grants', `/downloads/${H}.json`, `/assets/premium/${H}.png`]) {
      assert.equal((await fetch(path)).status, 404, path);
      assert.equal((await fetch(path, { method: 'POST', body: '{}' })).status, 405, path);
    }
  });
  await t.test('bounded stored content', async () => {
    await bucket.put(`v3/designs/${H}.json`, new Uint8Array(262145));
    assert.equal((await fetch(`/v3/designs/${H}.json`)).status, 503);
    await bucket.put(`v3/assets/${H}.png`, new Uint8Array(5242881));
    assert.equal((await fetch(`/v3/assets/${H}.png`)).status, 503);
    await bucket.put(`v3/thumbs/${H}.webp`, new Uint8Array(5242880));
    assert.equal((await fetch(`/v3/thumbs/${H}.webp`)).status, 200);
    await bucket.put(`v3/previews/${H}.html`, new Uint8Array(2097153));
    assert.equal((await fetch(`/v3/previews/${H}.html`)).status, 503);
  });
  await t.test('failed write never changes the pointer', async () => {
    const failing = { get: key => bucket.get(key), put: (key, value, options) => { if (key === `v3/releases/${two.id}.json`) throw Error('simulated storage failure'); return bucket.put(key, value, options); } };
    await assert.rejects(promote(failing, release(two), one.id), /simulated storage failure/);
    assert.equal(JSON.parse(await (await bucket.get('v3/manifest.json')).text()).release, one.id);
  });
  await t.test('concurrent publishers cannot both win; rollback reuses immutable bytes', async () => {
    const outcomes = await Promise.allSettled([promote(bucket, release(two), one.id), promote(bucket, release(three), one.id)]);
    assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
    const current = JSON.parse(await (await bucket.get('v3/manifest.json')).text()).release;
    assert.equal((await promote(bucket, release(one), current)).created, 0);
    assert.equal(JSON.parse(await (await fetch('/v3/manifest.json')).text()).release, one.id);
  });
  await t.test('a pointer over 64 KiB is refused', async () => {
    await bucket.put('v3/manifest.json', new Uint8Array(65537));
    assert.equal((await fetch('/v3/manifest.json')).status, 503);
  });
});

test('the v2 routes are gone: v2 objects left in the bucket are never served', async t => {
  const mf = runtime(); t.after(() => mf.dispose());
  const bucket = await mf.getR2Bucket('PUBLIC_TEMPLATES');
  const keys = ['manifest.json', `packs/${H}.json`, `releases/${H}/manifest.json`, `releases/${H}/designs.json`, `releases/${H}/page-1.json`,
    `previews/${H}.html`, `thumbnails/${H}.jpg`, `assets/free/${H}.png`];
  for (const key of keys) await bucket.put(key, 'legacy');
  for (const key of keys) assert.equal((await mf.dispatchFetch('https://templates.example/' + key)).status, 404, key);
});

test('premium routes stay closed without Nexus, even with a tier claim', async t => {
  const limiter = { simple: { limit: 10000, period: 60 } };
  const mf = runtime({ ratelimits: Object.fromEntries(['GRANT_RATE_LIMITER', 'GRANT_IP_RATE_LIMITER', 'DOWNLOAD_RATE_LIMITER', 'DOWNLOAD_IP_RATE_LIMITER'].map((name, n) => [name, { namespace_id: String(n + 1), ...limiter }])) });
  t.after(() => mf.dispose());
  const design = one.entries.find(entry => entry.tier === 'pro');
  for (const path of [`/v3/premium/designs/${design.sha256}.json`, `/v3/premium/setups/${H}.json`, `/v3/premium/assets/${H}.png`]) {
    const response = await mf.dispatchFetch('https://templates.example' + path, { headers: { Authorization: 'Bearer pretend', 'X-Plan': 'pro' } });
    assert.equal(response.status, 503, path); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), { error_code: 'service_not_configured' });
  }
  // Premium objects are never at their public address.
  assert.equal((await mf.dispatchFetch(`https://templates.example/v3/designs/${design.sha256}.json`)).status, 404);
});

test('embedding origins are exact and fail closed', async () => {
  const preview = [...one.public.keys()].find(key => key.startsWith('v3/previews/'));
  for (const [configured, allowed] of [
    ['https://wconvert.io https://www.wconvert.io https://dev.wconvert-website.pages.dev', true],
    ['https://dev.wconvert-website.pages.dev', true],
    ['https://evil.example;frame-src', false], ['https://*', false], ['*', false], ['https://*.pages.dev', false], ['http://localhost:3000', false],
    ['https://wconvert.io/path', false], ['https://wconvert.io https://user:pass@example.com', false],
  ]) {
    const mf = runtime({ bindings: { PREVIEW_EMBED_ORIGINS: configured } });
    try {
      await (await mf.getR2Bucket('PUBLIC_TEMPLATES')).put(preview, one.public.get(preview));
      const csp = (await mf.dispatchFetch('https://templates.example/' + preview)).headers.get('content-security-policy');
      assert(csp.endsWith('frame-ancestors ' + (allowed ? configured : "'none'")), configured);
      assert(!csp.includes('allow-same-origin'));
    } finally { await mf.dispose(); }
  }
});

test('local input: changed bytes, premium source in public, stray files and the 2x thumbnail', async t => {
  const root = mkdtempSync(join(tmpdir(), 'template-server-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  writeDirectory(root, one);
  const staged = await readPublicRelease(root);
  assert.equal(staged.id, one.id); assert.deepEqual(staged.pointer, one.pointer); assert.equal(staged.objects.size, one.public.size);
  const design = [...one.public.keys()].find(key => key.startsWith('v3/designs/'));
  writeFileSync(join(root, 'public', design), 'corrupt');
  await assert.rejects(readPublicRelease(root), /Digest mismatch/);
  writeFileSync(join(root, 'public', design), one.public.get(design));
  // The 2x name carries the 1x digest, so its bytes are not checked by name.
  const double = [...one.public.keys()].find(key => key.endsWith('@2x.webp'));
  writeFileSync(join(root, 'public', double), 'a different 2x rendering');
  assert.equal((await readPublicRelease(root)).id, one.id);
  rmSync(join(root, 'public', double));
  await assert.rejects(readPublicRelease(root), /Missing or changed dependency: public\/v3\/thumbs/);
  writeFileSync(join(root, 'public', double), one.public.get(double));
  const premium = json({ schema: 3, id: 'leak', revision: 1, tier: 'pro', assets: [] });
  writeFileSync(join(root, 'public/v3/designs', hash(premium) + '.json'), premium);
  await assert.rejects(readPublicRelease(root), /Premium source cannot enter public storage/);
  rmSync(join(root, 'public/v3/designs', hash(premium) + '.json'));
  const night = one.objects['night-owl'];
  writeFileSync(join(root, 'public/v3/assets', night.assets[0].sha256 + '.png'), one.private.get(`v3/assets/${night.assets[0].sha256}.png`));
  // Only the private walk knows which images a premium design binds.
  await assert.rejects(readPrivateRelease(root, await readPublicRelease(root)), /Premium object in public storage/);
  rmSync(join(root, 'public/v3/assets', night.assets[0].sha256 + '.png'));
  mkdirSync(join(root, 'public/packs')); writeFileSync(join(root, 'public/packs', H + '.json'), '{}');
  await assert.rejects(readPublicRelease(root), /Unexpected public file: packs/);
  rmSync(join(root, 'public/packs'), { recursive: true });
  writeFileSync(join(root, 'public/v3/manifest.json'), json({ schema: 2, release: one.id, pages: [] }));
  await assert.rejects(readPublicRelease(root), /Invalid catalogue pointer/);
});

test('staging validates every retained closure and points rollback at a retained release', async t => {
  const root = mkdtempSync(join(tmpdir(), 'template-server-retained-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  writeDirectory(root, one, two);
  const staged = await readPublicRelease(root);
  assert.equal(staged.id, two.id); assert.deepEqual(staged.releases, [one.id, two.id].sort());
  const rollback = await readPublicRelease(root, one.id);
  assert.equal(rollback.id, one.id); assert.equal(JSON.parse(rollback.pointer).release, one.id);
  await assert.rejects(readPublicRelease(root, 'c'.repeat(64)), /not in this directory/);
  for (const key of [one.page, ...[...one.public.keys()].filter(key => /^v3\/(designs|assets|thumbs|og|previews)\//.test(key) && !two.public.has(key))]) {
    const path = key === one.page ? `v3/index/${key}.json` : key;
    rmSync(join(root, 'public', path));
    await assert.rejects(readPublicRelease(root), /Missing or changed dependency/, `must reject missing retained ${path}`);
    writeFileSync(join(root, 'public', path), one.public.get(path));
  }
});

test('private staging validates the premium closure and never mixes storage', async t => {
  const root = mkdtempSync(join(tmpdir(), 'template-private-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  writeDirectory(root, one);
  const staged = await readPublicRelease(root);
  const objects = await readPrivateRelease(root, staged);
  assert.deepEqual([...objects.keys()].sort(), [...one.private.keys()].sort());
  const image = [...one.private.keys()].find(key => key.startsWith('v3/assets/'));
  rmSync(join(root, 'private', image));
  await assert.rejects(readPrivateRelease(root, staged), /Missing or changed dependency: private/);
  writeFileSync(join(root, 'private', image), 'damaged');
  await assert.rejects(readPrivateRelease(root, staged), /Private digest\/size mismatch/);
  writeFileSync(join(root, 'private', image), one.private.get(image));
  const mf = runtime(); t.after(() => mf.dispose());
  const bucket = await mf.getR2Bucket('PRIVATE_TEMPLATES');
  await stagePrivate(bucket, objects); await stagePrivate(bucket, objects);
  for (const key of objects.keys()) assert.equal(await (await mf.getR2Bucket('PUBLIC_TEMPLATES')).get(key), null);
  const design = [...objects.keys()].find(key => key.startsWith('v3/designs/'));
  await bucket.put(design, 'changed'); await assert.rejects(stagePrivate(bucket, objects), /Immutable private object changed/);
});

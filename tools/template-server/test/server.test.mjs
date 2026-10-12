import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promote, readPublicRelease, hash } from '../scripts/storage.mjs';
const bytes = Buffer.from('{"templates":[]}\n'), digest = hash(bytes);
const manifest = id => Buffer.from(JSON.stringify({ schema: 2, release: id, pages: [] }));
const release = id => ({ id, manifest: manifest(id), objects: new Map([[`packs/${digest}.json`, bytes], [`releases/${id}/manifest.json`, manifest(id)]]) });
const first = 'a'.repeat(64), second = 'b'.repeat(64);

test('actual Worker/R2 runtime: public routing, private refusal, caches and atomic promotion', async t => {
 const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8'), compatibilityDate: '2026-10-12', r2Buckets: ['PUBLIC_TEMPLATES'] }));
 t.after(() => mf.dispose());
 const bucket = await mf.getR2Bucket('PUBLIC_TEMPLATES');
 const fetch = (path, options) => mf.dispatchFetch('http://localhost' + path, options);
 await t.test('no catalogue before seeding', async () => assert.equal((await fetch('/manifest.json')).status, 404));
 await t.test('promotion, retry and reuse', async () => {
  assert.equal((await promote(bucket, release(first), null)).created, 2);
  assert.equal((await promote(bucket, release(first), first)).created, 0);
  await assert.rejects(promote(bucket, release(second), null), /Current release changed/);
 });
 await t.test('GET, HEAD, ETag, cache and strict routing', async () => {
  const path = `/packs/${digest}.json`, response = await fetch(path);
  assert.equal(await response.text(), bytes.toString()); assert.match(response.headers.get('cache-control'), /immutable/);
  const head = await fetch(path, { method: 'HEAD' }); assert.equal(await head.text(), ''); assert.equal(head.headers.get('content-length'), String(bytes.length));
  const cached = await fetch(path, { headers: { 'If-None-Match': 'W/' + response.headers.get('etag') } }); assert.equal(cached.status, 304);
  assert.match((await fetch('/manifest.json')).headers.get('cache-control'), /must-revalidate/);
  assert.equal((await fetch(path, { method: 'POST' })).status, 405);
  for (const path of ['/private/packs/x.json', '/.publish.lock', '/assets/premium/x.png', '/releases/latest/page-1.json', '/packs/%2fprivate%2fpacks%2ffile.json']) assert.equal((await fetch(path)).status, 404);
  assert.equal((await fetch('/manifest.json?license=anything')).status, 400);
 });
 await t.test('premium remains unavailable even with a tier claim', async () => {
  for (const path of [`/downloads/${digest}.json`, `/assets/premium/${digest}.png`]) {
   const response = await fetch(path, { headers: { Authorization: 'Bearer pretend', 'X-Plan': 'elite' } });
   assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
  }
 });
 await t.test('public previews and images, bounded stored content', async () => {
  await bucket.put(`previews/${digest}.html`, '<h1>Preview</h1>');
  const preview = await fetch(`/previews/${digest}.html`); assert.match(preview.headers.get('content-security-policy'), /sandbox allow-scripts/); assert.equal(await preview.text(), '<h1>Preview</h1>');
  await bucket.put(`assets/free/${digest}.png`, new Uint8Array([1, 2]));
  assert.equal((await fetch(`/assets/free/${digest}.png`)).headers.get('content-type'), 'image/png');
  await bucket.put(`packs/${first}.json`, new Uint8Array(262145));
  assert.equal((await fetch(`/packs/${first}.json`)).status, 503);
 });
 await t.test('failed write never changes the entry point', async () => {
  const failing = { get: key => bucket.get(key), put: (key, value, options) => { if (key === `releases/${second}/manifest.json`) throw Error('simulated storage failure'); return bucket.put(key, value, options); } };
  await assert.rejects(promote(failing, release(second), first), /simulated storage failure/);
  assert.equal(JSON.parse(await (await bucket.get('manifest.json')).text()).release, first);
 });
 await t.test('concurrent publishers cannot both win; rollback reuses immutable bytes', async () => {
  const third = 'c'.repeat(64);
  const outcomes = await Promise.allSettled([promote(bucket, release(second), first), promote(bucket, release(third), first)]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  const current = JSON.parse(await (await bucket.get('manifest.json')).text()).release;
  assert.equal((await promote(bucket, release(first), current)).created, 0);
  assert.equal(JSON.parse(await (await fetch('/manifest.json')).text()).release, first);
 });
});

test('local input rejects changed bytes and premium source in public storage', () => {
 const root = mkdtempSync(join(tmpdir(), 'template-server-'));
 try {
  mkdirSync(join(root, 'public/packs'), { recursive: true });
  writeFileSync(join(root, 'public/packs', digest + '.json'), 'corrupt');
  assert.throws(() => readPublicRelease(root), /Digest mismatch/);
  rmSync(join(root, 'public/packs', digest + '.json'));
  const premium = Buffer.from(JSON.stringify({ templates: [{ tier: 'elite' }] }));
  writeFileSync(join(root, 'public/packs', hash(premium) + '.json'), premium);
  assert.throws(() => readPublicRelease(root), /Premium source/);
 } finally { rmSync(root, { recursive: true }); }
});

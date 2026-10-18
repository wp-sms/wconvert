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
   const response = await fetch(path, { headers: { Authorization: 'Bearer pretend', 'X-Plan': 'pro' } });
   assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'private, no-store');
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
  const premium = Buffer.from(JSON.stringify({ templates: [{ tier: 'pro' }] }));
  writeFileSync(join(root, 'public/packs', hash(premium) + '.json'), premium);
  assert.throws(() => readPublicRelease(root), /Premium source/);
 } finally { rmSync(root, { recursive: true }); }
});

test('staging validates retained dependencies and preserves complete rollback releases', () => {
 const root = mkdtempSync(join(tmpdir(), 'template-server-retained-'));
 const write = (key, value) => { const path = join(root, 'public', key); mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, value); };
 const fixture = id => {
  const image = Buffer.from(`image-${id}`), preview = Buffer.from(`<h1>${id}</h1>`);
  const pack = Buffer.from(JSON.stringify({ templates: [{ tier: 'free' }], assets: [{ access: 'free', mime: 'image/png', sha256: hash(image) }] }));
  const packKey = `packs/${hash(pack)}.json`, previewKey = `previews/${hash(preview)}.html`, imageKey = `assets/free/${hash(image)}.png`;
  const pageKey = `releases/${id}/page-1.json`;
  const page = Buffer.from(JSON.stringify({ release: id, packs: [{ access: 'free', sha256: hash(pack), url: `https://templates.example/${packKey}`, preview_url: `https://templates.example/${previewKey}` }] }));
  const manifestKey = `releases/${id}/manifest.json`;
  const manifest = Buffer.from(JSON.stringify({ schema: 2, release: id, pages: [{ url: `https://templates.example/${pageKey}`, sha256: hash(page) }] }));
  return { manifest, objects: new Map([[packKey, pack], [previewKey, preview], [imageKey, image], [pageKey, page], [manifestKey, manifest]]) };
 };
 try {
  const old = fixture(first), current = fixture(second);
  for (const entry of [...old.objects, ...current.objects]) write(...entry);
  write('manifest.json', current.manifest);
  const staged = readPublicRelease(root);
  assert.equal(staged.id, second);
  assert.equal(staged.origin, 'https://templates.example');
  assert.equal(staged.objects.size, old.objects.size + current.objects.size);
  for (const [key, bytes] of old.objects) assert.deepEqual(staged.objects.get(key), bytes);
  const rollback = readPublicRelease(root, first);
  assert.equal(rollback.id, first);
  assert.deepEqual(rollback.manifest, old.manifest);
  assert.equal(rollback.objects.size, staged.objects.size);
  for (const [key, bytes] of old.objects) {
   if (key.endsWith('/manifest.json')) continue;
   rmSync(join(root, 'public', key));
   assert.throws(() => readPublicRelease(root), /Missing or changed dependency/, `must reject missing retained ${key}`);
   write(key, bytes);
  }
  const oldPage = `releases/${first}/page-1.json`;
  write(oldPage, '{"packs":[]}');
  assert.throws(() => readPublicRelease(root), /Missing or changed dependency/);
  write(oldPage, old.objects.get(oldPage));
  write(`releases/${first}/manifest.json`, current.manifest);
  assert.throws(() => readPublicRelease(root), /Invalid release identity/);
 } finally { rmSync(root, { recursive: true }); }
});

test('private staging validates pack/image closure before promotion and never mixes storage', async t => {
 const { readPrivateRelease, stagePrivate } = await import('../scripts/storage.mjs');
 const root=mkdtempSync(join(tmpdir(),'template-private-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const image=Buffer.from('fixture'), assetHash=hash(image);
 const pack=Buffer.from(JSON.stringify({assets:[{access:'premium',mime:'image/png',sha256:assetHash,bytes:image.length}]}));
 const packHash=hash(pack);
 const page=Buffer.from(JSON.stringify({packs:[{access:'premium',url:`https://templates.example/downloads/${packHash}.json`,sha256:packHash}]}));
 const release={objects:new Map([[`releases/${first}/page-1.json`,page]])};
 mkdirSync(join(root,'private/packs'),{recursive:true}); mkdirSync(join(root,'private/assets/premium'),{recursive:true});
 writeFileSync(join(root,`private/packs/${packHash}.json`),pack);
 assert.throws(()=>readPrivateRelease(root,release));
 writeFileSync(join(root,`private/assets/premium/${assetHash}.png`),image);
 const objects=readPrivateRelease(root,release); assert.equal(objects.size,2);
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:readFileSync(new URL('../dist/index.js',import.meta.url),'utf8'),compatibilityDate:'2026-10-12',r2Buckets:['PUBLIC_TEMPLATES','PRIVATE_TEMPLATES']}));
 t.after(()=>mf.dispose());
 const bucket=await mf.getR2Bucket('PRIVATE_TEMPLATES');
 await stagePrivate(bucket,objects); await stagePrivate(bucket,objects);
 assert.equal(await (await mf.getR2Bucket('PUBLIC_TEMPLATES')).get(`packs/${packHash}.json`),null);
 await bucket.put(`packs/${packHash}.json`,'changed'); await assert.rejects(stagePrivate(bucket,objects),/Immutable private object changed/);
 writeFileSync(join(root,`private/assets/premium/${assetHash}.png`),'damaged'); assert.throws(()=>readPrivateRelease(root,release),/digest\/size mismatch/);
});

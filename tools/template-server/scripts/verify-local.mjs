import assert from 'node:assert/strict';
import { hash } from './storage.mjs';
const base = new URL(process.argv[2] || 'http://127.0.0.1:9454');
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('This rehearsal is local only');
const response = await fetch(new URL('/manifest.json', base)); assert.equal(response.status, 200);
const manifest = await response.json(); let metadataOrigin;
const mirror = value => { const u = new URL(value); metadataOrigin ??= u.origin; assert.equal(u.origin, metadataOrigin); return new URL(u.pathname, base); };
const report = { release: manifest.release, freePacks: 0, premiumRefusals: 0, publicPreviews: 0, images: 0, downloadedSetups: 0, metadataOrigin: '', localOnly: true };
for (const page of manifest.pages) {
 const response = await fetch(mirror(page.url)); assert.equal(response.status, 200);
 const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(hash(bytes), page.sha256);
 const catalog = JSON.parse(bytes); assert.equal(catalog.release, manifest.release);
 for (const pack of catalog.packs) {
  const preview = await fetch(mirror(pack.preview_url)); assert.equal(preview.status, 200); assert.match(preview.headers.get('content-security-policy'), /sandbox allow-scripts/);
  assert.equal(hash(Buffer.from(await preview.arrayBuffer())), new URL(pack.preview_url).pathname.split('/').pop().split('.')[0]); report.publicPreviews++;
  const download = await fetch(mirror(pack.url));
  if (pack.access === 'premium') { assert.equal(download.status, 503); assert.equal(download.headers.get('cache-control'), 'private, no-store'); report.premiumRefusals++; continue; }
  assert.equal(download.status, 200); const bytes = Buffer.from(await download.arrayBuffer()); assert.equal(hash(bytes), pack.sha256);
  const data = JSON.parse(bytes); report.freePacks++; report.downloadedSetups += data.playbooks.length;
  for (const asset of data.assets ?? []) {
   const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[asset.mime];
   const image = await fetch(new URL(`/assets/free/${asset.sha256}.${extension}`, base)); assert.equal(image.status, 200);
   assert.equal(hash(Buffer.from(await image.arrayBuffer())), asset.sha256); report.images++;
  }
 }
}
report.metadataOrigin = metadataOrigin;
console.log(JSON.stringify(report, null, 2));

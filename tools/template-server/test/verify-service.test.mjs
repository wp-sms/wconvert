import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash } from '../scripts/storage.mjs';
import { legacyReleaseId } from '../scripts/design-catalogue.mjs';
import { verifyService } from '../scripts/verify-service.mjs';

function fixture(change = () => {}) {
  const origin = 'https://templates.example';
  const pack = Buffer.from(JSON.stringify({ templates: [{ tier: 'free' }], playbooks: [{}], assets: [] }));
  const preview = Buffer.from('<!doctype html><title>Preview</title>');
  const entries = [
    { access: 'free', url: `${origin}/packs/${hash(pack)}.json`, sha256: hash(pack), preview_url: `${origin}/previews/${hash(preview)}.html` },
    { access: 'premium', url: `${origin}/downloads/${'b'.repeat(64)}.json`, sha256: 'b'.repeat(64), preview_url: `${origin}/previews/${hash(preview)}.html` },
  ];
  const id = legacyReleaseId(entries, []);
  const page = Buffer.from(JSON.stringify({ release: id, packs: entries }));
  const files = new Map([
    ['/manifest.json', Buffer.from(JSON.stringify({ schema: 2, release: id, pages: [{ url: `${origin}/releases/${id}/page-1.json`, sha256: hash(page) }] }))],
    [`/releases/${id}/page-1.json`, page], [`/packs/${hash(pack)}.json`, pack], [`/previews/${hash(preview)}.html`, preview],
  ]);
  const fetcher = async (url, options) => {
    const bytes = files.get(url.pathname);
    let status = url.search ? 400 : url.pathname.startsWith('/downloads/') ? 503 : bytes ? 200 : 404;
    const headers = new Headers({ 'cache-control': status === 503 ? 'private, no-store' : status !== 200 ? 'no-store' : url.pathname === '/manifest.json' ? 'no-cache, must-revalidate' : 'public, max-age=31536000, immutable', etag: '"abc"', 'content-security-policy': 'sandbox allow-scripts' });
    if (status === 200 && options.headers?.['If-None-Match']) status = 304;
    if (options.method === 'HEAD' && status === 200) {
      // Mirrors the edge: only identity HEAD is guaranteed an uncompressed size.
      assert.equal(options.headers?.['Accept-Encoding'], 'identity');
      headers.set('content-length', String(bytes.length));
    }
    const result = { status, headers, body: options.method === 'HEAD' || status === 304 ? null : bytes ?? 'unavailable' };
    change(url, options, result);
    return new Response(result.body, { status: result.status, headers: result.headers });
  };
  return { origin, options: { expected: id, metadataOrigin: origin, fetcher } };
}

test('hosted verifier checks hashes with negotiated GET and identity HEAD', async () => {
  const {origin, options} = fixture();
  assert.equal((await verifyService(origin, options)).freePacks, 1);
});
test('hosted verifier refuses wrong release, changed bytes, open premium and missing sandbox', async () => {
  const initial = fixture();
  await assert.rejects(verifyService(initial.origin, {...initial.options, expected: 'c'.repeat(64)}));
  for (const corrupt of [
    (url, options, r) => { if (url.pathname.startsWith('/packs/') && !options.method) r.body = 'corrupt'; },
    (url, options, r) => { if (url.pathname.startsWith('/downloads/')) r.status = 200; },
    (url, options, r) => { if (url.pathname.startsWith('/previews/')) r.headers.delete('content-security-policy'); },
    (url, options, r) => { if (url.pathname.startsWith('/packs/') && options.method === 'HEAD') r.headers.set('content-length', '1'); },
  ]) {
    const {origin, options} = fixture(corrupt);
    await assert.rejects(verifyService(origin, options));
  }
});


test('configured verification requires anonymous 401 and still rejects open or unavailable premium', async () => {
 for (const status of [200, 401, 403, 503]) {
  const { origin, options } = fixture((url, _options, result) => {
   if (url.pathname.startsWith('/downloads/')) result.status = status;
  });
  const result = verifyService(origin, { ...options, premiumMode: 'configured' });
  if (status === 401) assert.equal((await result).premiumRefusals, 1);
  else await assert.rejects(result);
 }
 const { origin, options } = fixture();
 await assert.rejects(verifyService(origin, { ...options, premiumMode: 'anything' }));
});

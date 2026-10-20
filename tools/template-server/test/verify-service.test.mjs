import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyService } from '../scripts/verify-service.mjs';
import { catalogue } from './fixtures.mjs';

const TYPES = { json: 'application/json; charset=utf-8', html: 'text/html; charset=utf-8', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
const library = catalogue({ designs: [{ id: 'reading-slip' }, { id: 'night-owl', tier: 'pro', images: ['premium', 'free'] }], setups: [{ id: 'night-start', design: 'night-owl' }] });

/** A fake edge that mirrors the Worker's headers. `change` may alter any response. */
function fixture(change = () => {}) {
  const origin = 'https://templates.example';
  const files = new Map([['/v3/manifest.json', library.pointer], ...[...library.public].map(([key, bytes]) => ['/' + key, bytes])]);
  const fetcher = async (url, options) => {
    const bytes = files.get(url.pathname);
    let status = url.search ? 400 : url.pathname === '/v3/grants' ? 405 : /^\/v3\/premium\/(designs|setups)\/[a-f0-9]{64}\.json$/.test(url.pathname) ? 503 : bytes ? 200 : 404;
    const headers = new Headers({ 'cache-control': status === 503 ? 'private, no-store' : status !== 200 ? 'no-store' : url.pathname === '/v3/manifest.json' ? 'no-cache, must-revalidate' : 'public, max-age=31536000, immutable',
      etag: '"abc"', 'content-type': TYPES[url.pathname.split('.').pop()] ?? 'application/json', 'content-security-policy': 'sandbox allow-scripts' });
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
  return { origin, options: { expected: library.id, fetcher } };
}

test('hosted verifier walks the whole public closure with negotiated GET and identity HEAD', async () => {
  const { origin, options } = fixture();
  const report = await verifyService(origin, options);
  assert.equal(report.release, library.id); assert.equal(report.designs, 2); assert.equal(report.setups, 1); assert.equal(report.freeDesigns, 1);
  assert.equal(report.premiumRefusals, 2); assert.equal(report.previews, 2); assert.equal(report.og, 2); assert.equal(report.thumbnails, 4); assert.equal(report.details, 2);
  // A premium design's free images are only known from its private object: the local private walk checks those.
  assert.equal(report.images, 1);
});

test('hosted verifier refuses wrong release, changed bytes, open premium, leaked premium and missing sandbox', async () => {
  const initial = fixture();
  await assert.rejects(verifyService(initial.origin, { ...initial.options, expected: 'c'.repeat(64) }));
  const premium = library.entries.find(entry => entry.tier === 'pro');
  for (const corrupt of [
    (url, options, r) => { if (url.pathname.startsWith('/v3/designs/') && !options.method) r.body = 'corrupt'; },
    (url, options, r) => { if (url.pathname.startsWith('/v3/index/') && !options.method) r.body = 'corrupt'; },
    (url, options, r) => { if (r.status === 503) r.status = 200; },
    (url, options, r) => { if (url.pathname === `/v3/designs/${premium.sha256}.json`) { r.status = 200; r.body = '{}'; } },
    (url, options, r) => { if (url.pathname.startsWith('/v3/previews/')) r.headers.delete('content-security-policy'); },
    (url, options, r) => { if (url.pathname.startsWith('/v3/thumbs/')) r.headers.set('content-type', 'image/jpeg'); },
    (url, options, r) => { if (url.pathname.endsWith('@2x.webp')) { r.status = 404; r.body = null; } },
    (url, options, r) => { if (url.pathname.startsWith('/v3/og/') && options.method === 'HEAD') r.headers.set('content-length', '1'); },
    (url, options, r) => { if (url.pathname === '/v3/manifest.json') r.headers.set('cache-control', 'public, max-age=60'); },
    (url, options, r) => { if (url.pathname === '/v3/manifest.json' && options.headers?.['If-None-Match']) { r.status = 200; r.body = 'x'; } },
    (url, options, r) => { if (url.pathname.startsWith('/downloads/')) { r.status = 200; r.body = '{}'; } },
  ]) {
    const { origin, options } = fixture(corrupt);
    await assert.rejects(verifyService(origin, options), undefined, String(corrupt));
  }
});

test('configured verification requires anonymous 401 and still rejects open or unavailable premium', async () => {
  for (const status of [200, 401, 403, 503]) {
    const { origin, options } = fixture((url, _options, result) => { if (result.status === 503) result.status = status; });
    const result = verifyService(origin, { ...options, premiumMode: 'configured' });
    if (status === 401) assert.equal((await result).premiumRefusals, 2);
    else await assert.rejects(result);
  }
  const { origin, options } = fixture();
  await assert.rejects(verifyService(origin, { ...options, premiumMode: 'anything' }));
});

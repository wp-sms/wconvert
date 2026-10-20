import assert from 'node:assert/strict';
import { hash, budget, releaseClosure, validatePointer, validatePopularity, POINTER } from './storage.mjs';

const TYPES = { json: 'application/json; charset=utf-8', html: 'text/html; charset=utf-8', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

/**
 * Read-only acceptance against local emulation or the configured HTTPS service.
 * Sends no credentials, and no plugin user agent: these reads are never counted.
 */
export async function verifyService(base, { expected, premiumMode = 'unconfigured', fetcher = fetch } = {}) {
  assert(['unconfigured', 'configured'].includes(premiumMode), 'Unknown premium verification mode');
  base = new URL(base);
  const local = ['localhost', '127.0.0.1'].includes(base.hostname);
  assert(local || base.protocol === 'https:', 'HTTPS required');
  assert(!base.username && !base.password && !base.search && !base.hash && base.pathname === '/', 'Use a plain service origin');
  async function request(path, limit, options = {}) {
    const response = await fetcher(new URL(path, base), { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) });
    const chunks = []; let size = 0;
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.length; assert(size <= limit, 'Response exceeds verification budget'); chunks.push(Buffer.from(value));
        }
      } catch (error) { await reader.cancel(); throw error; }
      finally { reader.releaseLock(); }
    }
    return { response, bytes: Buffer.concat(chunks) };
  }
  const initial = await request('/' + POINTER, 65536);
  assert.equal(initial.response.status, 200);
  assert.match(initial.response.headers.get('cache-control'), /no-cache, must-revalidate/);
  const tag = initial.response.headers.get('etag'); assert(tag, 'The pointer needs an ETag');
  assert.equal((await request('/' + POINTER, 0, { headers: { 'If-None-Match': tag } })).response.status, 304, 'The pointer must revalidate with 304');
  const pointer = validatePointer(initial.bytes);
  if (expected) assert.equal(pointer.release, expected, 'The served release differs from the requested release');
  const served = new Map();
  // Missing is null; anything served must be immutable, typed and byte-exact.
  async function read(scope, key) {
    if (scope === 'private') return null;
    if (served.has(key)) return served.get(key);
    const { response, bytes } = await request('/' + key, budget(key));
    if (response.status === 404) { served.set(key, null); return null; }
    assert.equal(response.status, 200, key);
    assert.match(response.headers.get('cache-control'), /immutable/, key);
    assert.equal(response.headers.get('content-type'), TYPES[key.split('.').pop()], key);
    if (key.endsWith('.html')) assert.match(response.headers.get('content-security-policy') ?? '', /sandbox allow-scripts/, key);
    // Cloudflare may omit Content-Length for compressed responses. Request the
    // identity representation for the byte-count check; GET above still checks
    // the hash of the normally negotiated (decompressed) response.
    const head = await request('/' + key, 0, { method: 'HEAD', headers: { 'Accept-Encoding': 'identity' } });
    assert.equal(head.response.status, 200); assert.equal(Number(head.response.headers.get('content-length')), bytes.length, key);
    assert.equal((await request('/' + key, 0, { headers: { 'If-None-Match': response.headers.get('etag') } })).response.status, 304, key);
    served.set(key, bytes);
    return bytes;
  }
  const closure = await releaseClosure(pointer.release, read, { withPrivate: false });
  if (pointer.popularity) validatePopularity(await read('public', `v3/index/${pointer.popularity}.json`) ?? assert.fail('Missing popularity sidecar'));
  const report = { release: pointer.release, designs: closure.designs.size, setups: closure.setups.size, freeDesigns: 0, premiumRefusals: 0,
    images: 0, thumbnails: 0, previews: 0, og: 0, details: closure.details.length, withdrawn: pointer.withdrawn.length, localOnly: local };
  for (const key of closure.objects.keys()) {
    if (key.startsWith('public/v3/assets/')) report.images++;
    else if (key.startsWith('public/v3/thumbs/')) report.thumbnails++;
    else if (key.startsWith('public/v3/previews/')) report.previews++;
    else if (key.startsWith('public/v3/og/')) report.og++;
  }
  // Premium objects are refused anonymously in the expected configuration.
  for (const [kind, entries] of [['designs', closure.designs], ['setups', closure.setups]]) {
    for (const entry of entries.values()) {
      if (entry.tier === 'free') { if (kind === 'designs') report.freeDesigns++; continue; }
      const { response } = await request(`/v3/premium/${kind}/${entry.sha256}.json`, 16384);
      assert.equal(response.status, premiumMode === 'configured' ? 401 : 503, 'Anonymous premium downloads must be refused in the expected configuration');
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      report.premiumRefusals++;
    }
  }
  for (const path of ['/v3/premium/designs/x.json', '/grants/x.json', `/downloads/${'0'.repeat(64)}.json`, '/v3/grants', '/v3/manifest.json?key=not-a-credential']) {
    const denied = await request(path, 16384);
    assert([400, 404, 405].includes(denied.response.status), path); assert.match(denied.response.headers.get('cache-control'), /no-store/);
  }
  report.pointerSha256 = hash(initial.bytes);
  return report;
}

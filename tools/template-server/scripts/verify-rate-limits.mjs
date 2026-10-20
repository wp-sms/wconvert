import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { connect } from 'node:http2';
import { cloudTarget } from './cloud-config.mjs';

// Explicit, bounded live probe. Sends no credentials and never calls Nexus.
const { values } = parseArgs({ options: { phase: { type: 'string' } } });
assert(['burst', 'recovery'].includes(values.phase), 'Use --phase burst or --phase recovery (after the mitigation duration)');
const { origin } = cloudTarget();
const download = `/downloads/${'0'.repeat(64)}.json`;
const asset = `/assets/premium/${'0'.repeat(64)}.png`;
// Keep one HTTP/2 connection to avoid dispersing a short probe across edge
// machines before the provider's eventually consistent counters synchronize.
const connection = connect(origin);
connection.on('error', () => {}); // Individual streams report connection errors.
connection.setTimeout(30000, () => connection.destroy(new Error('Probe connection timed out')));
function request(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const stream = connection.request({
      ':method': method, ':path': path,
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
    });
    let result;
    stream.setTimeout(15000, () => stream.destroy(new Error('Probe request timed out')));
    stream.on('response', headers => {
      result = {
        status: headers[':status'], ray: headers['cf-ray'] ?? null,
        retryAfter: headers['retry-after'] ?? null,
        contentType: headers['content-type'] ?? null,
        cacheControl: headers['cache-control'] ?? null,
      };
    });
    stream.on('data', () => {}); // Drain the small response to reuse the connection.
    stream.on('error', reject);
    stream.on('end', () => result ? resolve(result) : reject(new Error('Missing probe response')));
    stream.end(method === 'POST' ? '{}' : undefined);
  });
}
try {
const started = new Date().toISOString();
const publicBefore = await request('/manifest.json');
assert.equal(publicBefore.status, 200, 'Public catalogue unavailable before the probe');
if (values.phase === 'recovery') {
  const grants = await request('/grants', 'POST'), file = await request(download), image = await request(asset, 'HEAD');
  assert.equal(grants.status, 400); assert.equal(file.status, 401); assert.equal(image.status, 401);
  console.log(JSON.stringify({ started, origin, phase: 'recovery', publicBefore, grants, file, image }, null, 2));
} else {
  async function burst(path, method, ceiling) {
    const start = Date.now(), statuses = {}, rays = new Set(); let sent = 0, blocked;
    while (sent < ceiling && !blocked && Date.now() - start < 50000) {
      const results = await Promise.all(Array.from({ length: Math.min(10, ceiling - sent) }, () => request(path, method)));
      sent += results.length;
      for (const result of results) {
        statuses[result.status] = (statuses[result.status] ?? 0) + 1;
        if (result.ray) rays.add(result.ray.split('-').pop());
        if (result.status === 429) blocked = result;
        assert([400, 401, 429].includes(result.status), `Unexpected status ${result.status}; stop and inspect`);
      }
    }
    return { sent, statuses, elapsedMs: Date.now() - start, locations: [...rays], blocked: blocked ?? null };
  }
  const grants = await burst('/grants', 'POST', 80);
  const privateDuringGrantBlock = await request(download);
  const files = await burst(download, 'GET', 450);
  const imageDuringFileBlock = await request(asset, 'HEAD');
  const publicAfter = await request('/manifest.json');
  const report = { started, origin, phase: 'burst', grants, privateDuringGrantBlock, files, imageDuringFileBlock, publicAfter };
  console.log(JSON.stringify(report, null, 2));
  assert(grants.blocked && files.blocked, 'No 429 observed within the bounded probe; limits are NOT verified');
  for (const blocked of [grants.blocked, files.blocked, imageDuringFileBlock]) {
    assert.equal(blocked.retryAfter, '60', 'Throttling must provide a bounded retry interval');
    assert.equal(blocked.cacheControl, 'private, no-store', 'Throttle responses must not be cached');
  }
  assert.equal(privateDuringGrantBlock.status, 401, 'Grant limit must not block private file requests');
  assert.equal(imageDuringFileBlock.status, 429, 'Private image route must share the private file rule');
  assert.equal(publicAfter.status, 200, 'Public catalogue must stay available during throttling');
}
} finally { connection.close(); }

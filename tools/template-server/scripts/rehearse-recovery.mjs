import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { hash, readPublicRelease, readPrivateRelease } from './storage.mjs';
import { publishRemote } from './publish-remote.mjs';
import { verifyService } from './verify-service.mjs';

const directory = process.argv[2];
assert(directory && process.argv.length === 3, 'Supply one backup directory');
const started = Date.now();
const snapshot = JSON.parse(readFileSync(resolve(directory, 'backup.json'), 'utf8'));
assert.equal(snapshot.schema, 1);
const release = readPublicRelease(directory), privateObjects = readPrivateRelease(directory, release);
assert.equal(snapshot.release, release.id); assert.equal(snapshot.origin, release.origin);
const files = new Map([
  ['public/manifest.json', release.manifest],
  ...[...release.objects].map(([key, bytes]) => [`public/${key}`, bytes]),
  ...[...privateObjects].map(([key, bytes]) => [`private/${key}`, bytes]),
]);
assert.equal(snapshot.files.length, files.size);
const seen = new Set();
for (const file of snapshot.files) {
  assert(!seen.has(file.path)); seen.add(file.path);
  const bytes = files.get(file.path);
  assert(bytes && bytes.length === file.bytes && hash(bytes) === file.sha256, 'Backup inventory mismatch');
}
// Fresh in-memory R2; no remote bindings or production credentials.
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8'),
  compatibilityDate: '2026-10-01', r2Buckets: ['PUBLIC_TEMPLATES', 'PRIVATE_TEMPLATES'],
  ratelimits: {
    GRANT_RATE_LIMITER: { namespace_id: '202610201', simple: { limit: 30, period: 60 } },
    DOWNLOAD_RATE_LIMITER: { namespace_id: '202610202', simple: { limit: 300, period: 60 } },
  },
}));
try {
  const pub = await mf.getR2Bucket('PUBLIC_TEMPLATES'), priv = await mf.getR2Bucket('PRIVATE_TEMPLATES');
  const restore = await publishRemote(pub, priv, release, privateObjects, null);
  const verify = expected => verifyService(release.origin, {
    expected, metadataOrigin: release.origin, fetcher: (url, options) => mf.dispatchFetch(url.href, options),
  });
  const service = { ...await verify(release.id), localOnly: true };
  // Verify private bytes directly; never introduce an authorization bypass.
  for (const [key, bytes] of privateObjects) {
    assert(Buffer.from(await (await priv.get(key)).arrayBuffer()).equals(bytes));
    assert.equal(await pub.get(key), null, 'Private source must not appear in public storage');
  }
  const retained = [...release.objects.keys()].filter(key => /^releases\/[a-f0-9]{64}\/manifest\.json$/.test(key)).map(key => key.split('/')[1]).sort();
  assert.deepEqual([...snapshot.retained].sort(), retained);
  const packIds = id => {
    const manifest = JSON.parse(release.objects.get(`releases/${id}/manifest.json`));
    return manifest.pages.flatMap(page => JSON.parse(release.objects.get(new URL(page.url).pathname.slice(1))).packs.map(pack => pack.id));
  };
  // Only this isolated rehearsal acknowledges removals automatically. The remote
  // CLI always requires the operator to name each intentional removal.
  const acknowledgements = [];
  const removals = (from, to) => {
    const next = new Set(packIds(to));
    const ids = packIds(from).filter(id => !next.has(id)).sort();
    acknowledgements.push({ from, to, removedPacks: ids });
    return ids;
  };
  let current = release.id; const rollbacks = [];
  for (const id of retained.filter(id => id !== release.id)) {
    const prior = readPublicRelease(directory, id);
    await publishRemote(pub, priv, prior, readPrivateRelease(directory, prior), current, removals(current, id));
    await verify(id); rollbacks.push(id); current = id;
  }
  if (current !== release.id) await publishRemote(pub, priv, release, privateObjects, current, removals(current, release.id));
  await verify(release.id);
  assert.equal((await priv.list({ prefix: 'grants/' })).objects.length, 0);
  console.log(JSON.stringify({
    release: release.id, backupCapturedAt: snapshot.capturedAt, restoredPublicObjects: restore.created + 1,
    restoredPrivateObjects: privateObjects.size, service, rollbacks, acknowledgements,
    restoredCurrentRelease: release.id, elapsedSeconds: (Date.now() - started) / 1000,
    localOnly: true, productionWrites: 0,
    limitations: 'Fresh local Workerd/R2 restore; no live account failover, Nexus restore, secret recovery or licensed HTTP acceptance.',
  }, null, 2));
} finally { await mf.dispose(); }

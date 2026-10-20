import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { hash, readPublicRelease, readPrivateRelease, POINTER } from './storage.mjs';
import { publishRemote } from './publish-remote.mjs';
import { verifyService } from './verify-service.mjs';

const directory = process.argv[2];
assert(directory && process.argv.length === 3, 'Supply one backup directory');
const started = Date.now();
const snapshot = JSON.parse(readFileSync(resolve(directory, 'backup.json'), 'utf8'));
assert.equal(snapshot.schema, 3);
const release = await readPublicRelease(directory), privateObjects = await readPrivateRelease(directory, release);
assert.equal(snapshot.release, release.id);
const files = new Map([
  [`public/${POINTER}`, release.pointer],
  ...[...release.objects].map(([key, bytes]) => [`public/${key}`, bytes]),
  ...[...privateObjects].map(([key, bytes]) => [`private/${key}`, bytes]),
]);
assert.equal(snapshot.files.length, files.size);
const seen = new Set();
// The inventory is the only record of a 2x thumbnail's digest: check every file by it.
for (const file of snapshot.files) {
  assert(!seen.has(file.path)); seen.add(file.path);
  const bytes = files.get(file.path);
  assert(bytes && bytes.length === file.bytes && hash(bytes) === file.sha256, 'Backup inventory mismatch');
}
// Fresh in-memory R2; no remote bindings or production credentials.
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8'),
  compatibilityDate: '2026-10-01', r2Buckets: ['PUBLIC_TEMPLATES', 'PRIVATE_TEMPLATES'],
}));
try {
  const pub = await mf.getR2Bucket('PUBLIC_TEMPLATES'), priv = await mf.getR2Bucket('PRIVATE_TEMPLATES');
  const restore = await publishRemote(pub, priv, release, privateObjects, null);
  const verify = expected => verifyService('http://localhost', { expected, fetcher: (url, options) => mf.dispatchFetch(url.href, options) });
  const service = { ...await verify(release.id), localOnly: true };
  // Verify private bytes directly; never introduce an authorization bypass.
  for (const [key, bytes] of privateObjects) {
    assert(Buffer.from(await (await priv.get(key)).arrayBuffer()).equals(bytes));
    assert.equal(await pub.get(key), null, 'Private source must not appear in public storage');
  }
  assert.deepEqual([...snapshot.retained].sort(), release.releases);
  const designIds = id => new Set([...release.closures.get(id).designs.keys()]);
  // Only this isolated rehearsal withdraws dropped designs automatically, and
  // reinstates them on the way back. The remote CLI makes the operator name each.
  const acknowledgements = [], withdrawn = new Set();
  const changes = (from, to) => {
    const next = designIds(to), dropped = [...designIds(from)].filter(id => !next.has(id)).sort();
    const restored = [...next].filter(id => withdrawn.has(id)).sort();
    acknowledgements.push({ from, to, withdrawn: dropped, reinstated: restored });
    for (const id of restored) withdrawn.delete(id);
    for (const id of dropped) withdrawn.add(id);
    return { withdraw: dropped.map(id => ({ id, reason: 'other' })), reinstate: restored.map(id => ({ id })) };
  };
  let current = release.id; const rollbacks = [];
  for (const id of release.releases.filter(id => id !== release.id)) {
    const prior = await readPublicRelease(directory, id);
    await publishRemote(pub, priv, prior, await readPrivateRelease(directory, prior), current, changes(current, id));
    await verify(id); rollbacks.push(id); current = id;
  }
  if (current !== release.id) await publishRemote(pub, priv, release, privateObjects, current, changes(current, release.id));
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

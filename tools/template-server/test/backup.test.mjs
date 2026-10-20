import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, statSync, readFileSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backupRemote } from '../scripts/backup-remote.mjs';
import { readPublicRelease, readPrivateRelease } from '../scripts/storage.mjs';
import { catalogue, json } from './fixtures.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'wconvert-backup-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = join(root, 'snapshot');
  const older = catalogue({ designs: [{ id: 'reading-slip' }, { id: 'night-owl', tier: 'pro', images: ['premium', 'free'] }], label: 'older' });
  const current = catalogue({ designs: [{ id: 'reading-slip' }, { id: 'night-owl', tier: 'pro', images: ['premium', 'free'] }, { id: 'third-design' }],
    setups: [{ id: 'night-start', design: 'night-owl' }], label: 'current', popularity: { schema: 3, generated: '2026-10-20', downloads: { 'reading-slip': 4 } } });
  const pub = new Map([...older.public, ...current.public, ['v3/manifest.json', current.pointer]]);
  const priv = new Map([...older.private, ...current.private]);
  priv.set(`grants/${'c'.repeat(64)}.json`, Buffer.from('must never be backed up'));
  const ids = [older.id, current.id].sort(), reads = [];
  const bucket = (scope, objects) => ({ get: async key => {
    reads.push(`${scope}/${key}`);
    const bytes = objects.get(key);
    return bytes ? { arrayBuffer: async () => bytes } : null;
  } });
  const image = [...current.private.keys()].find(key => key.startsWith('v3/assets/'));
  return { directory, pub, priv, ids, older, current, image, reads,
    publicBucket: { ...bucket('public', pub), retainedReleases: async () => ids },
    privateBucket: bucket('private', priv) };
}

test('backup includes all retained dependencies, protects local files, excludes grants, and refuses overwrite', async t => {
  const f = fixture(t), report = await backupRemote(f.publicBucket, f.privateBucket, f.directory);
  assert.deepEqual(report.retained, f.ids); assert.equal(report.release, f.current.id);
  assert.equal(report.privateObjects, new Set([...f.older.private.keys(), ...f.current.private.keys()]).size);
  assert.equal(report.publicObjects, new Set([...f.older.public.keys(), ...f.current.public.keys()]).size + 1);
  assert.equal(statSync(f.directory).mode & 0o777, 0o700);
  assert.equal(statSync(join(f.directory, 'backup.json')).mode & 0o777, 0o600);
  assert(!f.reads.some(key => key.includes('grants/')));
  // The inventory carries every file's digest, including the 2x thumbnails whose names do not.
  const doubles = report.files.filter(file => file.path.endsWith('@2x.webp'));
  assert(doubles.length > 0 && doubles.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
  const release = await readPublicRelease(f.directory);
  assert.equal(release.id, f.current.id); assert.equal((await readPrivateRelease(f.directory, release)).size, report.privateObjects);
  assert.equal((await readPublicRelease(f.directory, f.older.id)).id, f.older.id);
  assert.deepEqual(JSON.parse(readFileSync(join(f.directory, 'backup.json'))), report);
  await assert.rejects(backupRemote(f.publicBucket, f.privateBucket, f.directory), /EEXIST/);
});

test('missing or corrupt dependencies fail before creating the destination', async t => {
  const f = fixture(t);
  f.priv.set(f.image, Buffer.from('corrupt'));
  await assert.rejects(backupRemote(f.publicBucket, f.privateBucket, f.directory), /Missing or changed dependency: private/);
  assert(!existsSync(f.directory));
  f.priv.delete(f.image);
  await assert.rejects(backupRemote(f.publicBucket, f.privateBucket, f.directory), /Missing or changed dependency/);
  assert(!existsSync(f.directory));
  f.priv.set(f.image, f.current.private.get(f.image));
  f.pub.delete([...f.pub.keys()].find(key => key.startsWith('v3/index/') && JSON.parse(f.pub.get(key)).downloads));
  await assert.rejects(backupRemote(f.publicBucket, f.privateBucket, f.directory), /Missing popularity sidecar/);
});

test('a publication during backup invalidates the snapshot', async t => {
  const f = fixture(t), original = f.publicBucket.get; let reads = 0;
  f.publicBucket.get = async key => {
    if (key === 'v3/manifest.json' && ++reads === 2) return { arrayBuffer: async () => f.older.pointer };
    return original(key);
  };
  await assert.rejects(backupRemote(f.publicBucket, f.privateBucket, f.directory), /Catalogue changed/);
  assert(!existsSync(f.directory));
});

test('a pointer outside the retained releases, or an invalid one, is refused', async t => {
  const f = fixture(t);
  f.publicBucket.retainedReleases = async () => [f.older.id];
  await assert.rejects(backupRemote(f.publicBucket, f.privateBucket, f.directory), /missing from the retained releases/);
  f.pub.set('v3/manifest.json', json({ schema: 2, release: f.current.id, pages: [] }));
  await assert.rejects(backupRemote(f.publicBucket, f.privateBucket, f.directory), /Invalid catalogue pointer/);
  assert(!existsSync(f.directory));
});

test('backup rejects a WordPress destination even from a managed worktree or symlink', async t => {
  const f = fixture(t), root = join(f.directory, '..', 'site');
  mkdirSync(join(root, 'wp-content'), { recursive: true });
  writeFileSync(join(root, 'wp-load.php'), '<?php');
  const alias = join(f.directory, '..', 'public-alias');
  symlinkSync(join(root, 'wp-content'), alias);
  for (const parent of [root, join(root, 'wp-content'), alias]) {
    const destination = join(parent, 'private-backup');
    await assert.rejects(backupRemote(f.publicBucket, f.privateBucket, destination), /outside the WordPress document root/);
    assert(!existsSync(destination));
  }
  assert.equal(f.reads.length, 0, 'Reject before reading premium objects');
});

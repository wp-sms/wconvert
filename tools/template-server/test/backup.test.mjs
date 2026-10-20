import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, statSync, readFileSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backupRemote } from '../scripts/backup-remote.mjs';
import { legacyReleaseId } from '../scripts/design-catalogue.mjs';
import { hash, readPublicRelease, readPrivateRelease } from '../scripts/storage.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'wconvert-backup-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = join(root, 'snapshot'), origin = 'https://templates.example';
  const pub = new Map(), priv = new Map(), ids = [];
  const image = Buffer.from('private image'), imageKey = `assets/premium/${hash(image)}.png`;
  const pack = Buffer.from(JSON.stringify({ templates: [{ tier: 'pro' }], assets: [{ access: 'premium', sha256: hash(image), mime: 'image/png', bytes: image.length }] }));
  priv.set(imageKey, image); priv.set(`packs/${hash(pack)}.json`, pack);
  priv.set(`grants/${'c'.repeat(64)}.json`, Buffer.from('must never be backed up'));
  for (const label of ['first', 'second']) {
    const preview = Buffer.from(`<h1>${label}</h1>`), previewKey = `previews/${hash(preview)}.html`;
    pub.set(previewKey, preview);
    const entries = [{ access: 'premium', url: `${origin}/downloads/${hash(pack)}.json`, sha256: hash(pack), preview_url: `${origin}/${previewKey}` }];
    const id = legacyReleaseId(entries, []); ids.push(id);
    const pageKey = `releases/${id}/page-1.json`;
    const page = Buffer.from(JSON.stringify({ release: id, packs: entries }));
    pub.set(pageKey, page);
    const manifest = Buffer.from(JSON.stringify({ schema: 2, release: id, pages: [{ url: `${origin}/${pageKey}`, sha256: hash(page) }] }));
    pub.set(`releases/${id}/manifest.json`, manifest); pub.set('manifest.json', manifest);
  }
  const reads = [];
  const bucket = (scope, objects) => ({ get: async key => {
    reads.push(`${scope}/${key}`);
    const bytes = objects.get(key);
    return bytes ? { arrayBuffer: async () => bytes } : null;
  } });
  return { directory, origin, pub, priv, ids, imageKey, reads,
    publicBucket: { ...bucket('public', pub), retainedReleases: async () => ids },
    privateBucket: bucket('private', priv) };
}

test('backup includes all retained dependencies, protects local files, excludes grants, and refuses overwrite', async t => {
  const f = fixture(t), report = await backupRemote(f.publicBucket, f.privateBucket, f.directory, f.origin);
  assert.deepEqual(report.retained, f.ids); assert.equal(report.privateObjects, 2);
  assert.equal(statSync(f.directory).mode & 0o777, 0o700);
  assert.equal(statSync(join(f.directory, 'backup.json')).mode & 0o777, 0o600);
  assert(!f.reads.some(key => key.includes('/grants/')));
  const release = readPublicRelease(f.directory);
  assert.equal(release.id, f.ids[1]); assert.equal(readPrivateRelease(f.directory, release).size, 2);
  assert.equal(readPublicRelease(f.directory, f.ids[0]).id, f.ids[0]);
  assert.deepEqual(JSON.parse(readFileSync(join(f.directory, 'backup.json'))), report);
  await assert.rejects(backupRemote(f.publicBucket, f.privateBucket, f.directory, f.origin), /EEXIST/);
});

test('missing or corrupt private backup dependencies fail before creating the destination', async t => {
  const f = fixture(t);
  f.priv.set(f.imageKey, Buffer.from('corrupt'));
  await assert.rejects(backupRemote(f.publicBucket, f.privateBucket, f.directory, f.origin), /checksum mismatch/);
  assert(!existsSync(f.directory));
  f.priv.delete(f.imageKey);
  await assert.rejects(backupRemote(f.publicBucket, f.privateBucket, f.directory, f.origin), /Missing backup dependency/);
  assert(!existsSync(f.directory));
});

test('a publication during backup invalidates the snapshot', async t => {
  const f = fixture(t), original = f.publicBucket.get; let reads = 0;
  f.publicBucket.get = async key => {
    if (key === 'manifest.json' && ++reads === 2) return { arrayBuffer: async () => f.pub.get(`releases/${f.ids[0]}/manifest.json`) };
    return original(key);
  };
  await assert.rejects(backupRemote(f.publicBucket, f.privateBucket, f.directory, f.origin), /Catalogue changed/);
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
    await assert.rejects(backupRemote(f.publicBucket, f.privateBucket, destination, f.origin), /outside the WordPress document root/);
    assert(!existsSync(destination));
  }
  assert.equal(f.reads.length, 0, 'Reject before reading premium objects');
});

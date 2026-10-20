import assert from 'node:assert/strict';
import { loadEnvFile } from 'node:process';
import { parseArgs } from 'node:util';
import { lstatSync, mkdirSync, writeFileSync, realpathSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudTarget } from './cloud-config.mjs';
import { r2Client, R2Storage } from './r2-storage.mjs';
import { hash, readPublicRelease, readPrivateRelease } from './storage.mjs';
import { legacyReleaseId, validateDesignCatalogue } from './design-catalogue.mjs';

/** Read the current and all retained release closures. Never read grants or secrets. */
export async function backupRemote(publicBucket, privateBucket, directory, origin) {
  assert(isAbsolute(directory), 'Use an absolute backup directory outside the web root');
  const destinationParent = realpathSync(dirname(directory));
  // Inspect the destination itself as well: managed worktrees are outside wp-content.
  for (let parent = destinationParent; ; parent = dirname(parent)) {
    assert(!existsSync(resolve(parent, 'wp-load.php')) && !(existsSync(resolve(parent, 'wp-admin')) && existsSync(resolve(parent, 'wp-content'))), 'Backups must stay outside the WordPress document root');
    if (dirname(parent) === parent) break;
  }
  const scriptPath = fileURLToPath(import.meta.url), contentAt = scriptPath.indexOf('/wp-content/');
  if (contentAt !== -1) {
    const webRoot = scriptPath.slice(0, contentAt);
    assert(destinationParent !== webRoot && !destinationParent.startsWith(`${webRoot}/`), 'Backups must stay outside the WordPress document root');
  }
  const objects = { public: new Map(), private: new Map() };
  let total = 0;
  async function read(scope, key, expected, size) {
    let bytes = objects[scope].get(key);
    if (!bytes) {
      const object = await (scope === 'public' ? publicBucket : privateBucket).get(key);
      assert(object, `Missing backup dependency: ${scope}/${key}`);
      bytes = Buffer.from(await object.arrayBuffer());
      total += bytes.length;
      assert(total <= 268435456 && objects.public.size + objects.private.size < 2000, 'Backup exceeds budget');
      objects[scope].set(key, bytes);
    }
    if (expected) assert.equal(hash(bytes), expected, `Backup checksum mismatch: ${scope}/${key}`);
    if (size !== undefined) assert.equal(bytes.length, size, `Backup size mismatch: ${scope}/${key}`);
    return bytes;
  }
  const keyFor = value => {
    const url = new URL(value);
    assert.equal(url.origin, origin, 'Backup URL must use the configured service');
    assert(!url.username && !url.password && !url.search && !url.hash, 'Invalid backup URL');
    return url.pathname.slice(1);
  };
  const pointer = await read('public', 'manifest.json');
  const current = JSON.parse(pointer).release;
  assert.match(current, /^[a-f0-9]{64}$/);
  const retained = await publicBucket.retainedReleases();
  assert(retained.includes(current), 'Current retained manifest is missing');
  for (const id of retained) {
    const bytes = await read('public', `releases/${id}/manifest.json`);
    if (id === current) assert(bytes.equals(pointer), 'Current and retained manifest differ');
    const manifest = JSON.parse(bytes);
    assert.equal(manifest.schema, 2); assert.equal(manifest.release, id);
    assert(Array.isArray(manifest.pages) && manifest.pages.length > 0 && manifest.pages.length <= 16);
    const packs = [], collections = [];
    for (const page of manifest.pages) {
      const key = keyFor(page.url);
      assert.match(key, new RegExp(`^releases/${id}/page-[1-9][0-9]?\\.json$`));
      const data = JSON.parse(await read('public', key, page.sha256));
      assert.equal(data.release, id); assert(Array.isArray(data.packs) && data.packs.length <= 50);
      packs.push(...data.packs); collections.push(...(data.collections ?? []));
      for (const entry of data.packs) {
        if (entry.preview_url) {
          const key = keyFor(entry.preview_url);
          assert.match(key, /^previews\/[a-f0-9]{64}\.html$/);
          await read('public', key, key.split('/').pop().split('.')[0]);
        }
        assert(['free', 'premium'].includes(entry.access)); assert.match(entry.sha256, /^[a-f0-9]{64}$/);
        const scope = entry.access === 'premium' ? 'private' : 'public';
        assert.equal(keyFor(entry.url), `${scope === 'private' ? 'downloads' : 'packs'}/${entry.sha256}.json`);
        const pack = JSON.parse(await read(scope, `packs/${entry.sha256}.json`, entry.sha256));
        assert(Array.isArray(pack.assets ?? []) && (pack.assets ?? []).length <= 16);
        for (const asset of pack.assets ?? []) {
          const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[asset.mime];
          assert(ext && ['free', 'premium'].includes(asset.access)); assert.match(asset.sha256, /^[a-f0-9]{64}$/);
          assert(scope === 'private' || asset.access === 'free', 'Premium asset in a public pack');
          await read(asset.access === 'free' ? 'public' : 'private', `assets/${asset.access}/${asset.sha256}.${ext}`, asset.sha256, asset.bytes);
        }
      }
    }
    if (legacyReleaseId(packs, collections) !== id) {
      const catalogue = JSON.parse(await read('public', `releases/${id}/designs.json`));
      for (const [key, sha] of validateDesignCatalogue(catalogue, { id, packs, collections, origin })) await read('public', key, sha);
    }
  }
  const final = await publicBucket.get('manifest.json');
  assert(final && Buffer.from(await final.arrayBuffer()).equals(pointer), 'Catalogue changed during backup; start a fresh backup');
  // Exclusive destination: never overwrite a prior backup or write partial downloads.
  mkdirSync(directory, { mode: 0o700 });
  for (const [scope, files] of Object.entries(objects)) {
    mkdirSync(resolve(directory, scope), { mode: 0o700 });
    for (const [key, bytes] of files) {
      const path = resolve(directory, scope, key);
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      writeFileSync(path, bytes, { mode: 0o600, flag: 'wx' });
    }
  }
  const release = readPublicRelease(directory);
  const privateObjects = readPrivateRelease(directory, release);
  const report = {
    schema: 1, capturedAt: new Date().toISOString(), origin, release: current, retained,
    publicObjects: objects.public.size, privateObjects: privateObjects.size, bytes: total,
    excluded: ['temporary grants', 'licence keys and passes', 'Worker secrets', 'account settings', 'Nexus database'],
    files: Object.entries(objects).flatMap(([scope, files]) => [...files].map(([key, bytes]) => ({ path: `${scope}/${key}`, sha256: hash(bytes), bytes: bytes.length }))),
  };
  writeFileSync(resolve(directory, 'backup.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  return report;
}

async function main() {
  const { values } = parseArgs({ options: { directory: { type: 'string' }, credentials: { type: 'string' } } });
  assert(values.directory && isAbsolute(values.directory), 'Supply --directory /new/private/backup');
  assert(values.credentials && isAbsolute(values.credentials), 'Supply --credentials /private/publisher.env');
  const stat = lstatSync(values.credentials);
  assert(stat.isFile() && !stat.isSymbolicLink() && !(stat.mode & 0o077), 'Credentials must be a private regular file');
  loadEnvFile(values.credentials);
  const target = cloudTarget(), client = r2Client(target.account);
  try {
    const report = await backupRemote(new R2Storage(client, target.publicBucket, 'public'), new R2Storage(client, target.privateBucket, 'private'), values.directory, target.origin);
    const summary = { ...report };
    delete summary.files;
    console.log(JSON.stringify({ ...summary, directory: values.directory, remoteReadOnly: true }, null, 2));
  } finally { client.destroy(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

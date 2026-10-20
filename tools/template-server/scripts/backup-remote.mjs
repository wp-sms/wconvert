import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync, realpathSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudTarget, loadCredentials } from './cloud-config.mjs';
import { r2Client, R2Storage } from './r2-storage.mjs';
import { hash, readPublicRelease, readPrivateRelease, releaseClosure, validatePointer, validatePopularity, POINTER } from './storage.mjs';

/** Read the current and all retained release closures. Never read grants or secrets. */
export async function backupRemote(publicBucket, privateBucket, directory) {
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
  // Missing is null: the closure walker decides what must exist.
  async function read(scope, key) {
    let bytes = objects[scope].get(key);
    if (!bytes) {
      const object = await (scope === 'public' ? publicBucket : privateBucket).get(key);
      if (!object) return null;
      bytes = Buffer.from(await object.arrayBuffer());
      total += bytes.length;
      assert(total <= 1073741824 && objects.public.size + objects.private.size < 20000, 'Backup exceeds budget');
      objects[scope].set(key, bytes);
    }
    return bytes;
  }
  const pointer = await read('public', POINTER);
  assert(pointer, 'There is no live catalogue to back up');
  const { release: current, popularity } = validatePointer(pointer);
  const retained = await publicBucket.retainedReleases();
  assert(retained.includes(current), 'Current release is missing from the retained releases');
  for (const id of retained) await releaseClosure(id, read);
  if (popularity) validatePopularity(await read('public', `v3/index/${popularity}.json`) ?? assert.fail('Missing popularity sidecar'));
  const final = await publicBucket.get(POINTER);
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
  const release = await readPublicRelease(directory);
  const privateObjects = await readPrivateRelease(directory, release);
  const report = {
    schema: 3, capturedAt: new Date().toISOString(), release: current, retained,
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
  assert(values.credentials, 'Supply --credentials /private/publisher.env');
  loadCredentials(values.credentials);
  const target = cloudTarget(), client = r2Client(target.account);
  try {
    const report = await backupRemote(new R2Storage(client, target.publicBucket, 'public'), new R2Storage(client, target.privateBucket, 'private'), values.directory);
    const summary = { ...report };
    delete summary.files;
    console.log(JSON.stringify({ ...summary, origin: target.origin, directory: values.directory, remoteReadOnly: true }, null, 2));
  } finally { client.destroy(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

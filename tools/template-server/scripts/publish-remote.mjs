import { parseArgs } from 'node:util';
import { loadEnvFile } from 'node:process';
import { resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lstatSync } from 'node:fs';
import { cloudTarget } from './cloud-config.mjs';
import { readPublicRelease, readPrivateRelease, stagePrivate, promote, hash } from './storage.mjs';
import { r2Client, R2Storage } from './r2-storage.mjs';

export async function currentRelease(bucket) {
  const object = await bucket.get('manifest.json');
  if (!object) return null;
  const manifest = JSON.parse(await object.text());
  if (manifest.schema !== 2 || !/^[a-f0-9]{64}$/.test(manifest.release)) throw Error('Remote catalogue is invalid; inspect before publishing');
  return manifest.release;
}

/** Require an explicit pack-by-pack acknowledgement for destructive catalogue changes. */
export async function checkPackRetention(bucket, release, expected, removals = []) {
  const readPacks = async (manifest, read) => {
    if (!Array.isArray(manifest.pages) || manifest.pages.length > 16) throw Error('Invalid catalogue pages');
    const ids = new Set();
    for (const page of manifest.pages) {
      const url = new URL(page.url), key = url.pathname.slice(1);
      if (url.origin !== release.origin || url.search || url.hash || url.username || url.password
        || !new RegExp(`^releases/${manifest.release}/page-[1-9][0-9]?\\.json$`).test(key)) throw Error('Invalid catalogue page address');
      const bytes = await read(key);
      if (!bytes || hash(bytes) !== page.sha256) throw Error('Missing or changed catalogue page');
      const data = JSON.parse(bytes);
      if (data.release !== manifest.release || !Array.isArray(data.packs)) throw Error('Invalid catalogue page');
      for (const pack of data.packs) {
        if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(pack.id) || ids.has(pack.id)) throw Error('Invalid or duplicate pack identity');
        ids.add(pack.id);
      }
    }
    return ids;
  };
  const next = await readPacks(JSON.parse(release.manifest), key => release.objects.get(key));
  let previous = new Set();
  if (expected !== null) {
    const current = await bucket.get('manifest.json');
    const manifest = current && JSON.parse(await current.text());
    if (!manifest || manifest.release !== expected) throw Error('Current release changed; inspect before retrying');
    previous = await readPacks(manifest, async key => {
      const object = await bucket.get(key);
      return object && Buffer.from(await object.arrayBuffer());
    });
  }
  const missing = [...previous].filter(id => !next.has(id)).sort();
  if (new Set(removals).size !== removals.length || [...removals].sort().join(',') !== missing.join(',')) {
    throw Error(`Publication would remove live packs: ${missing.join(', ') || 'none'}. Restore them, or acknowledge exactly these removals with --remove-pack ID for each intentional removal.`);
  }
}

export async function publishRemote(publicBucket, privateBucket, release, privateObjects, expected, removals = []) {
  if (expected !== null && !/^[a-f0-9]{64}$/.test(expected)) throw Error('Supply the expected remote release ID or none');
  if (await currentRelease(publicBucket) !== expected) throw Error('Current release changed; inspect before retrying');
  await checkPackRetention(publicBucket, release, expected, removals);
  await stagePrivate(privateBucket, privateObjects);
  const result = await promote(publicBucket, release, expected);
  // Exact pointer read-back detects corruption and a subsequent publisher.
  const pointer = await publicBucket.get('manifest.json');
  if (!pointer || !(Buffer.from(await pointer.arrayBuffer()).equals(release.manifest))) throw Error('Publication returned success but the current pointer differs; inspect remote status');
  return { ...result, privateObjects: privateObjects.size };
}

export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: {
    'remove-pack': { type: 'string', multiple: true, default: [] },
    directory: { type: 'string' }, expected: { type: 'string' }, retained: { type: 'string' },
    apply: { type: 'boolean', default: false }, status: { type: 'boolean', default: false }, credentials: { type: 'string' },
  } });
  const target = cloudTarget();
  if (values.status && (values.directory || values.expected || values.retained || values.apply || values['remove-pack'].length)) throw Error('--status cannot be combined with publication options');
  let release, privateObjects, expected;
  if (!values.status) {
    if (!values.directory || !isAbsolute(values.directory) || !values.expected) throw Error('Use --directory /absolute/release-directory --expected none|release-id [--retained release-id] [--apply]');
    expected = values.expected === 'none' ? null : values.expected;
    if (expected !== null && !/^[a-f0-9]{64}$/.test(expected)) throw Error('Invalid expected release');
    release = readPublicRelease(values.directory, values.retained);
    privateObjects = readPrivateRelease(values.directory, release);
    if (release.origin !== target.origin) throw Error('Release origin differs from the configured Worker domain; rebuild the release for that domain');
    if (!values.apply) return { ...target, release: release.id, expected, publicObjects: release.objects.size, privateObjects: privateObjects.size, removals: values['remove-pack'], dryRun: true, remoteChecked: false };
  }
  if (values.credentials) {
    if (!isAbsolute(values.credentials)) throw Error('Use an absolute credentials-file path');
    const stat = lstatSync(values.credentials);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw Error('Credentials must be a private regular file (chmod 600)');
    loadEnvFile(values.credentials);
  }
  const client = r2Client(target.account);
  try {
    const publicBucket = new R2Storage(client, target.publicBucket, 'public');
    if (values.status) return { ...target, release: await currentRelease(publicBucket), readOnly: true };
    const privateBucket = new R2Storage(client, target.privateBucket, 'private');
    return { ...target, ...await publishRemote(publicBucket, privateBucket, release, privateObjects, expected, values['remove-pack']), dryRun: false };
  } finally { client.destroy(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}

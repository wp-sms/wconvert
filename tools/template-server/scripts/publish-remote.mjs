import { parseArgs } from 'node:util';
import { resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lstatSync, readFileSync } from 'node:fs';
import { cloudTarget, loadCredentials } from './cloud-config.mjs';
import { readPublicRelease, readPrivateRelease, stagePrivate, promote, hash, POINTER, REASONS, validatePointer, validatePopularity, pointerBytes } from './storage.mjs';
import { r2Client, R2Storage } from './r2-storage.mjs';

const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const rowKey = row => `${row.id}@${row.revision ?? '*'}`;

/** The live pointer, its R2 validator and exact bytes, or null for an empty catalogue. */
export async function currentPointer(bucket) {
  const object = await bucket.get(POINTER);
  if (!object) return null;
  const bytes = Buffer.from(await object.arrayBuffer());
  try { return { etag: object.etag, bytes, pointer: validatePointer(bytes) }; }
  catch { throw Error('Remote catalogue pointer is invalid; inspect before publishing'); }
}
export const currentRelease = async bucket => (await currentPointer(bucket))?.pointer.release ?? null;

/** `id[@revision]:reason`, as `--withdraw` takes it. */
export function parseWithdrawal(value) {
  const match = /^([a-z0-9][a-z0-9-]{0,59})(?:@([1-9][0-9]{0,8}))?:([a-z]+)$/.exec(value);
  if (!match || !REASONS.includes(match[3])) throw Error(`Use --withdraw ID[@REVISION]:${REASONS.join('|')}`);
  return { id: match[1], ...(match[2] ? { revision: Number(match[2]) } : {}), reason: match[3] };
}
/** `id[@revision]`, as `--reinstate` takes it: the exact row to remove. */
export function parseReinstatement(value) {
  const match = /^([a-z0-9][a-z0-9-]{0,59})(?:@([1-9][0-9]{0,8}))?$/.exec(value);
  if (!match) throw Error('Use --reinstate ID[@REVISION], exactly as the withdrawal names it');
  return { id: match[1], ...(match[2] ? { revision: Number(match[2]) } : {}) };
}

/**
 * The next pointer. Its own fields come first; anything it leaves out is kept
 * from the live pointer. Withdrawals are unioned with the live ones, so a
 * release built without them cannot quietly undo a rights withdrawal: only an
 * explicit `--reinstate` removes a row.
 */
export function composePointer(base, live, { withdraw = [], reinstate = [], popularity } = {}) {
  const rows = new Map();
  for (const row of [...(live?.withdrawn ?? []), ...base.withdrawn, ...withdraw]) rows.set(rowKey(row), row);
  for (const row of reinstate) if (!rows.delete(rowKey(row))) throw Error(`Nothing to reinstate: ${rowKey(row)} is not withdrawn`);
  const pointer = { schema: 3, minor: base.minor, release: base.release,
    withdrawn: [...rows.values()].sort((a, b) => a.id.localeCompare(b.id) || (a.revision ?? 0) - (b.revision ?? 0)) };
  const sidecar = popularity ?? base.popularity ?? live?.popularity;
  if (sidecar) pointer.popularity = sidecar;
  const major = base.latest_major ?? live?.latest_major;
  if (major !== undefined) pointer.latest_major = major;
  return validatePointer(pointerBytes(pointer));
}

/** Design ids a release lists, and the aliases that keep renamed ids alive. */
async function listedDesigns(read, id) {
  const bytes = await read(`v3/releases/${id}.json`);
  if (!bytes || hash(bytes) !== id) throw Error('Missing or changed catalogue release');
  const release = JSON.parse(bytes);
  if (!Array.isArray(release.pages) || release.pages.length > 16) throw Error('Invalid catalogue pages');
  const ids = new Set(), aliases = new Set();
  for (const sha of release.pages) {
    const page = await read(`v3/index/${sha}.json`);
    if (!digest(sha) || !page || hash(page) !== sha) throw Error('Missing or changed catalogue page');
    for (const entry of JSON.parse(page).designs ?? []) {
      ids.add(entry.id);
      for (const alias of entry.aliases ?? []) aliases.add(alias);
    }
  }
  return { ids, aliases };
}

/**
 * The publish guard: a design id live in the current release may leave the
 * pages only if the new pointer withdraws it (or a new entry keeps it as an
 * alias). A dropped design otherwise vanishes from every picker with no notice.
 */
export async function checkDesignRetention(bucket, next, live, pointer) {
  if (!live || live.pointer.release === next.id) return;
  const remote = async key => { const object = await bucket.get(key); return object && Buffer.from(await object.arrayBuffer()); };
  const previous = await listedDesigns(remote, live.pointer.release);
  const upcoming = await listedDesigns(async key => next.objects.get(key) ?? remote(key), next.id);
  const withdrawn = new Set(pointer.withdrawn.map(row => row.id));
  const dropped = [...previous.ids].filter(id => !upcoming.ids.has(id) && !upcoming.aliases.has(id) && !withdrawn.has(id)).sort();
  if (dropped.length) throw Error(`Publication would drop live designs: ${dropped.join(', ')}. Restore them, or withdraw each with --withdraw ID:REASON.`);
}

/**
 * Publish a release, or (without `release.pointer`) republish the live pointer
 * with new withdrawals or popularity. `expected` is the live release ID, or null
 * for an empty catalogue; the pointer is replaced only if it is still exactly
 * the version this run read.
 */
export async function publishRemote(publicBucket, privateBucket, release, privateObjects, expected, options = {}) {
  if (expected !== null && !digest(expected)) throw Error('Supply the expected remote release ID or none');
  const live = await currentPointer(publicBucket);
  if ((live?.pointer.release ?? null) !== expected) throw Error('Current release changed; inspect before retrying');
  const base = release.pointer ? validatePointer(release.pointer) : live?.pointer;
  if (!base) throw Error('There is no live pointer to republish');
  const objects = new Map(release.objects ?? []);
  let popularity;
  if (options.popularity) {
    validatePopularity(options.popularity);
    popularity = hash(options.popularity);
    objects.set(`v3/index/${popularity}.json`, options.popularity);
  }
  const pointer = composePointer(base, live?.pointer, { ...options, popularity });
  await checkDesignRetention(publicBucket, { id: pointer.release, objects }, live, pointer);
  await stagePrivate(privateBucket, privateObjects);
  const next = { id: pointer.release, pointer: pointerBytes(pointer), objects, basis: live?.etag ?? null };
  const result = await promote(publicBucket, next, expected);
  // Exact pointer read-back detects corruption and a subsequent publisher.
  const stored = await publicBucket.get(POINTER);
  if (!stored || !Buffer.from(await stored.arrayBuffer()).equals(next.pointer)) throw Error('Publication returned success but the current pointer differs; inspect remote status');
  return { ...result, privateObjects: privateObjects.size, withdrawn: pointer.withdrawn, popularity: pointer.popularity ?? null };
}

function readSidecar(path) {
  if (!isAbsolute(path)) throw Error('Use an absolute --popularity path');
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 262144) throw Error('The popularity sidecar must be a regular file of at most 256 KiB');
  const bytes = readFileSync(path);
  validatePopularity(bytes);
  return bytes;
}

export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: {
    withdraw: { type: 'string', multiple: true, default: [] }, reinstate: { type: 'string', multiple: true, default: [] },
    popularity: { type: 'string' }, directory: { type: 'string' }, expected: { type: 'string' }, retained: { type: 'string' },
    apply: { type: 'boolean', default: false }, status: { type: 'boolean', default: false }, credentials: { type: 'string' },
  } });
  const target = cloudTarget();
  const pointerOnly = values.withdraw.length || values.reinstate.length || values.popularity;
  if (values.status && (values.directory || values.expected || values.retained || values.apply || pointerOnly)) throw Error('--status cannot be combined with publication options');
  let release, privateObjects = new Map(), expected;
  const options = { withdraw: values.withdraw.map(parseWithdrawal), reinstate: values.reinstate.map(parseReinstatement) };
  if (!values.status) {
    if (!values.expected || (values.directory ? !isAbsolute(values.directory) : !pointerOnly || values.retained)) {
      throw Error('Use --directory /absolute/release-directory --expected none|release-id [--retained release-id], or --expected release-id with --withdraw/--reinstate/--popularity alone; add --apply to write');
    }
    expected = values.expected === 'none' ? null : values.expected;
    if (expected !== null && !digest(expected)) throw Error('Invalid expected release');
    if (values.popularity) options.popularity = readSidecar(values.popularity);
    if (values.directory) {
      release = await readPublicRelease(values.directory, values.retained);
      privateObjects = await readPrivateRelease(values.directory, release);
    } else release = { objects: new Map() };
    if (!values.apply) {
      return { ...target, release: release.id ?? expected, expected, publicObjects: release.objects.size, privateObjects: privateObjects.size,
        withdraw: options.withdraw, reinstate: options.reinstate, popularity: options.popularity ? hash(options.popularity) : null, dryRun: true, remoteChecked: false };
    }
  }
  if (values.credentials) loadCredentials(values.credentials);
  const client = r2Client(target.account);
  try {
    const publicBucket = new R2Storage(client, target.publicBucket, 'public');
    if (values.status) {
      const live = await currentPointer(publicBucket);
      return { ...target, release: live?.pointer.release ?? null, withdrawn: live?.pointer.withdrawn ?? [], popularity: live?.pointer.popularity ?? null, readOnly: true };
    }
    const privateBucket = new R2Storage(client, target.privateBucket, 'private');
    return { ...target, ...await publishRemote(publicBucket, privateBucket, release, privateObjects, expected, options), dryRun: false };
  } finally { client.destroy(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}

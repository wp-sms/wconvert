import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { detailDependencies } from './design-catalogue.mjs';
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (ok, reason) => { if (!ok) throw Error(reason); };
const H = '[a-f0-9]{64}';
/** The only mutable object. Every other key names the SHA-256 of its bytes. */
export const POINTER = 'v3/manifest.json';
export const PUBLIC_KEY = new RegExp(`^v3/(manifest\\.json|(releases|index|designs|setups)/${H}\\.json|assets/${H}\\.(png|jpg|webp)|thumbs/${H}(@2x)?\\.webp|og/${H}\\.jpg|previews/${H}\\.html)$`);
export const PRIVATE_KEY = new RegExp(`^v3/((designs|setups)/${H}\\.json|assets/${H}\\.(png|jpg|webp))$`);
export const budget = key => key === POINTER ? 65536 : key.endsWith('.html') ? 2097152 : key.endsWith('.json') ? 262144 : 5242880;
export const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const REASONS = ['rights', 'quality', 'broken', 'other'];
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const identifier = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/.test(value);
const revision = value => Number.isSafeInteger(value) && value > 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const parse = (bytes, what) => { try { return JSON.parse(bytes.toString('utf8')); } catch { throw Error(`Invalid JSON: ${what}`); } };
/** The 2x thumbnail is named after the 1x digest; nothing else escapes its own name. */
const named = key => key !== POINTER && !key.endsWith('@2x.webp');
export const nameDigest = key => key.match(/([a-f0-9]{64})(?:@2x)?\.[a-z]+$/)?.[1];

export function validatePointer(bytes) {
  check(bytes?.length > 0 && bytes.length <= 65536, 'Pointer exceeds 64 KiB');
  const pointer = parse(bytes, POINTER);
  check(pointer?.schema === 3 && Number.isSafeInteger(pointer.minor) && pointer.minor >= 0 && digest(pointer.release), 'Invalid catalogue pointer');
  check(Array.isArray(pointer.withdrawn), 'Invalid catalogue withdrawals');
  const seen = new Set();
  for (const row of pointer.withdrawn) {
    check(object(row) && identifier(row.id) && (row.revision === undefined || revision(row.revision)) && REASONS.includes(row.reason), 'Invalid withdrawal');
    const key = `${row.id}@${row.revision ?? '*'}`;
    check(!seen.has(key), `Repeated withdrawal: ${key}`); seen.add(key);
  }
  check(pointer.popularity === undefined || digest(pointer.popularity), 'Invalid popularity reference');
  check(pointer.latest_major === undefined || (Number.isSafeInteger(pointer.latest_major) && pointer.latest_major >= 3), 'Invalid latest_major');
  return pointer;
}
export const pointerBytes = pointer => Buffer.from(JSON.stringify(pointer, null, 2) + '\n');

export function validatePopularity(bytes) {
  check(bytes?.length > 0 && bytes.length <= 262144, 'Popularity sidecar exceeds 256 KiB');
  const data = parse(bytes, 'popularity');
  check(data?.schema === 3 && /^\d{4}-\d{2}-\d{2}$/.test(data.generated ?? '') && object(data.downloads)
    && Object.entries(data.downloads).every(([id, count]) => identifier(id) && Number.isSafeInteger(count) && count >= 0), 'Invalid popularity sidecar');
  return data;
}

/**
 * Walk one release's dependency closure: release → pages, details, i18n →
 * designs and setups → bound images and thumbnails. `read(scope, key)` resolves
 * to the exact bytes or null. Premium objects must be absent from public
 * storage; without `withPrivate` their contents are not read.
 */
export async function releaseClosure(id, read, { withPrivate = true } = {}) {
  const objects = new Map();
  const load = async (scope, key, sha, size) => {
    const bytes = await read(scope, key);
    check(bytes, `Missing or changed dependency: ${scope}/${key}`);
    check(bytes.length > 0 && bytes.length <= budget(key), `Dependency exceeds its budget: ${scope}/${key}`);
    if (sha) check(hash(bytes) === sha, `Missing or changed dependency: ${scope}/${key}`);
    if (size !== undefined) check(bytes.length === size, `Dependency size mismatch: ${scope}/${key}`);
    objects.set(`${scope}/${key}`, bytes);
    return bytes;
  };
  const absent = async key => check(!(await read('public', key)), `Premium object in public storage: ${key}`);
  check(digest(id), 'Invalid release identity');
  const release = parse(await load('public', `v3/releases/${id}.json`, id), id);
  check(release?.schema === 3 && Number.isSafeInteger(release.minor) && release.minor >= 0, 'Invalid release identity');
  const unique = list => Array.isArray(list) && list.every(digest) && new Set(list).size === list.length;
  check(unique(release.pages) && release.pages.length >= 1 && release.pages.length <= 16, 'Invalid release pages');
  const details = release.details ?? [], i18n = release.i18n ?? {};
  check(unique(details) && details.length <= 64, 'Invalid release detail pages');
  check(object(i18n) && Object.entries(i18n).every(([locale, sha]) => /^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(locale) && digest(sha)), 'Invalid release i18n');
  check(release.taxonomy === undefined || object(release.taxonomy), 'Invalid release taxonomy');
  check(release.collections === undefined || (Array.isArray(release.collections)
    && release.collections.every(item => identifier(item?.id)) && new Set(release.collections.map(item => item.id)).size === release.collections.length), 'Invalid release collections');
  const designs = new Map(), setups = new Map(); let total = 0;
  const identity = entry => object(entry) && identifier(entry.id) && revision(entry.revision) && digest(entry.sha256)
    && Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= 262144 && typeof entry.tier === 'string' && entry.tier !== '';
  for (const sha of release.pages) {
    const bytes = await load('public', `v3/index/${sha}.json`, sha); total += bytes.length;
    const page = parse(bytes, sha);
    check(page?.schema === 3 && Array.isArray(page.designs ?? []) && Array.isArray(page.setups ?? []), 'Invalid index page');
    for (const entry of page.designs ?? []) {
      check(identity(entry) && !designs.has(entry.id), `Repeated or invalid design entry: ${entry?.id}`);
      designs.set(entry.id, entry);
    }
    for (const entry of page.setups ?? []) {
      check(identity(entry) && !setups.has(entry.id), `Repeated or invalid setup entry: ${entry?.id}`);
      setups.set(entry.id, entry);
    }
  }
  check(total <= 1048576, 'Index pages exceed 1 MiB in total');
  for (const entry of designs.values()) {
    // Ids are never reused: a rename keeps the old id as an alias, never as a live id.
    check(entry.aliases === undefined || (Array.isArray(entry.aliases) && entry.aliases.every(alias => identifier(alias) && !designs.has(alias))), `Invalid aliases: ${entry.id}`);
    if (entry.thumb !== undefined) {
      check(digest(entry.thumb), `Invalid thumbnail digest: ${entry.id}`);
      await load('public', `v3/thumbs/${entry.thumb}.webp`, entry.thumb);
      await load('public', `v3/thumbs/${entry.thumb}@2x.webp`);
    }
    const premium = entry.tier !== 'free', key = `v3/designs/${entry.sha256}.json`;
    if (premium) { await absent(key); if (!withPrivate) continue; }
    const design = parse(await load(premium ? 'private' : 'public', key, entry.sha256, entry.bytes), key);
    check(design?.schema === 3 && design.id === entry.id && design.revision === entry.revision && design.tier === entry.tier, `Design object differs from its entry: ${entry.id}`);
    check(Array.isArray(design.assets) && design.assets.length <= 50, `Invalid image list: ${entry.id}`);
    const assets = new Set(); let images = 0;
    for (const asset of design.assets) {
      const extension = EXTENSIONS[asset?.mime];
      check(extension && typeof asset.id === 'string' && !assets.has(asset.id) && digest(asset.sha256) && ['free', 'premium'].includes(asset.access)
        && Number.isSafeInteger(asset.bytes) && asset.bytes > 0 && asset.bytes <= 5242880, `Invalid image: ${entry.id}`);
      check(premium || asset.access === 'free', `A Free design binds a premium image: ${entry.id}`);
      assets.add(asset.id); images += asset.bytes;
      const image = `v3/assets/${asset.sha256}.${extension}`;
      if (asset.access === 'free') await load('public', image, asset.sha256, asset.bytes);
      else { await absent(image); await load('private', image, asset.sha256, asset.bytes); }
    }
    check(images <= 20971520, `Images exceed 20 MiB: ${entry.id}`);
    check(Array.isArray(design.image_bindings ?? []) && (design.image_bindings ?? []).every(binding => assets.has(binding?.asset_id)), `An image binding names an unlisted image: ${entry.id}`);
  }
  for (const entry of setups.values()) {
    const design = designs.get(entry.design?.id);
    check(design && design.revision === entry.design.revision, `Setup pins an unlisted design revision: ${entry.id}`);
    check(entry.tier !== 'free' || design.tier === 'free', `A Free setup pins a premium design: ${entry.id}`);
    const premium = entry.tier !== 'free', key = `v3/setups/${entry.sha256}.json`;
    if (premium) { await absent(key); if (!withPrivate) continue; }
    const setup = parse(await load(premium ? 'private' : 'public', key, entry.sha256, entry.bytes), key);
    check(setup?.schema === 3 && setup.id === entry.id && setup.revision === entry.revision && setup.tier === entry.tier
      && setup.design?.id === entry.design.id && setup.design?.revision === entry.design.revision, `Setup object differs from its entry: ${entry.id}`);
  }
  const gallery = [], seen = new Set();
  for (const sha of details) {
    const page = parse(await load('public', `v3/index/${sha}.json`, sha), sha);
    for (const [key, sha] of detailDependencies(page, seen)) await load('public', key, sha ?? undefined);
    gallery.push(...page.details);
  }
  for (const sha of Object.values(i18n)) {
    const data = parse(await load('public', `v3/index/${sha}.json`, sha), sha);
    check(data?.schema === 3 && object(data.designs), 'Invalid i18n sidecar');
  }
  return { id, release, designs, setups, details: gallery, objects };
}

/** Read a directory tree of `scope` keys. Names are verified against their bytes. */
function readTree(root, pattern, scope) {
  const objects = new Map(); let total = 0;
  function visit(folder, prefix = '') {
    check(!lstatSync(folder).isSymbolicLink(), 'Symlinks are not allowed');
    for (const name of readdirSync(folder)) {
      const file = join(folder, name), key = prefix + name, stat = lstatSync(file);
      check(!stat.isSymbolicLink(), 'Symlinks are not allowed');
      if (stat.isDirectory()) { visit(file, key + '/'); continue; }
      check(stat.isFile() && pattern.test(key), `Unexpected ${scope} file: ${key}`);
      total += stat.size;
      check(stat.size > 0 && stat.size <= budget(key) && total <= 268435456 && objects.size < 20000, `${scope} release exceeds its local budget`);
      const bytes = readFileSync(file);
      if (named(key)) check(nameDigest(key) === hash(bytes), `Digest mismatch: ${key}`);
      objects.set(key, bytes);
    }
  }
  visit(root);
  return objects;
}

/**
 * Read a trusted, previously validated publisher output, never its private
 * sibling. Every release in the directory is validated: each stays staged for
 * rollback. `retained` points the pointer at an older release instead.
 */
export async function readPublicRelease(directory, retained) {
  const objects = readTree(resolve(directory, 'public'), PUBLIC_KEY, 'public');
  for (const [key, bytes] of objects) {
    if (!/^v3\/(designs|setups)\//.test(key)) continue;
    const data = parse(bytes, key);
    check(data?.tier === 'free' && (data.assets ?? []).every(asset => asset?.access === 'free'), `Premium source cannot enter public storage: ${key}`);
  }
  const original = objects.get(POINTER); check(original, 'No published pointer');
  objects.delete(POINTER);
  let pointer = validatePointer(original);
  if (retained !== undefined) { check(digest(retained), 'Invalid retained release'); pointer = { ...pointer, release: retained }; }
  const releases = [...objects.keys()].map(key => key.match(/^v3\/releases\/([a-f0-9]{64})\.json$/)?.[1]).filter(Boolean).sort();
  check(releases.includes(pointer.release), 'The pointer names a release that is not in this directory');
  const read = async (scope, key) => (scope === 'public' && objects.get(key)) || null;
  const closures = new Map();
  for (const id of releases) closures.set(id, await releaseClosure(id, read, { withPrivate: false }));
  if (pointer.popularity) validatePopularity(objects.get(`v3/index/${pointer.popularity}.json`) ?? check(false, 'Missing popularity sidecar'));
  return { id: pointer.release, pointer: retained === undefined ? original : pointerBytes(pointer), objects, releases, closures };
}

/** Private source closure of every release in the same validated directory. Never exposed by public routes. */
export async function readPrivateRelease(directory, release) {
  const objects = new Map(); let total = 0;
  const readPrivate = key => {
    check(PRIVATE_KEY.test(key), 'Invalid private object path');
    if (objects.has(key)) return objects.get(key);
    let path = resolve(directory, 'private');
    try {
      check(!lstatSync(path).isSymbolicLink(), 'Symlinks are not allowed');
      for (const part of key.split('/')) { path = join(path, part); check(!lstatSync(path).isSymbolicLink(), 'Symlinks are not allowed'); }
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    const stat = lstatSync(path);
    check(stat.isFile() && stat.size > 0 && stat.size <= budget(key), 'Private file exceeds budget');
    const bytes = readFileSync(path);
    check(hash(bytes) === nameDigest(key), `Private digest/size mismatch: ${key}`);
    total += bytes.length; check(total <= 268435456 && objects.size < 20000, 'Private release exceeds its local budget');
    objects.set(key, bytes);
    return bytes;
  };
  const read = async (scope, key) => scope === 'public' ? release.objects.get(key) ?? null : readPrivate(key);
  for (const id of release.releases) await releaseClosure(id, read);
  return objects;
}

/** R2-compatible conditional promotion. Old immutable objects remain for rollback. */
export async function promote(bucket, release, expected) {
  check(expected === null || digest(expected), 'Supply expected release or none');
  const current = await bucket.get(POINTER);
  const currentId = current ? JSON.parse(await current.text()).release : null;
  check(currentId === expected, 'Current release changed; inspect before retrying');
  // A pointer composed from the live one must replace exactly that version.
  if (release.basis !== undefined) check((current?.etag ?? null) === release.basis, 'Current pointer changed; inspect before retrying');
  let created = 0;
  for (const [key, bytes] of release.objects) {
    const existing = await bucket.get(key);
    if (existing) check(hash(Buffer.from(await existing.arrayBuffer())) === hash(bytes), `Immutable object changed: ${key}`);
    else {
      const put = await bucket.put(key, bytes, { onlyIf: { etagDoesNotMatch: '*' }, sha256: hash(bytes) });
      if (put) created++;
    }
    const stored = await bucket.get(key);
    check(stored && hash(Buffer.from(await stored.arrayBuffer())) === hash(bytes), `Read-back failed: ${key}`);
  }
  const promoted = await bucket.put(POINTER, release.pointer, { onlyIf: current ? { etagMatches: current.etag } : { etagDoesNotMatch: '*' }, sha256: hash(release.pointer) });
  check(promoted, 'Concurrent publication won; prior pointer preserved');
  return { release: release.id, created, reused: release.objects.size - created };
}

export async function stagePrivate(bucket, objects) {
  for (const [key, bytes] of objects) {
    const existing = await bucket.get(key);
    if (existing) check(hash(Buffer.from(await existing.arrayBuffer())) === hash(bytes), `Immutable private object changed: ${key}`);
    else await bucket.put(key, bytes, { onlyIf: { etagDoesNotMatch: '*' }, sha256: hash(bytes) });
    const stored = await bucket.get(key);
    check(stored && hash(Buffer.from(await stored.arrayBuffer())) === hash(bytes), `Private read-back failed: ${key}`);
  }
}

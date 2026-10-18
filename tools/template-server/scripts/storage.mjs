import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (ok, reason) => { if (!ok) throw Error(reason); };
const digest = '[a-f0-9]{64}';
const allowed = new RegExp(`^(packs/${digest}\\.json|releases/${digest}/(manifest|page-[1-9][0-9]?)\\.json|previews/${digest}\\.html|assets/free/${digest}\\.(png|jpg|webp))$`);

/** Read a trusted, previously validated publisher output, never its private sibling. */
export function readPublicRelease(directory, retainedRelease) {
  const root = resolve(directory, 'public'), objects = new Map(); let total = 0;
  function visit(folder, prefix = '') {
    check(!lstatSync(folder).isSymbolicLink(), 'Symlinks are not allowed');
    for (const name of readdirSync(folder)) {
      const file = join(folder, name), key = prefix + name, stat = lstatSync(file);
      check(!stat.isSymbolicLink(), 'Symlinks are not allowed');
      if (stat.isDirectory()) { visit(file, key + '/'); continue; }
      check(stat.isFile() && (key === 'manifest.json' || allowed.test(key)), `Unexpected public file: ${key}`);
      const limit = key.startsWith('assets/') ? 5242880 : key.startsWith('previews/') ? 2097152 : 262144;
      total += stat.size; check(stat.size > 0 && stat.size <= limit && total <= 134217728 && objects.size < 2000, 'Public release exceeds local rehearsal budget');
      const bytes = readFileSync(file);
      if (!key.startsWith('releases/') && key !== 'manifest.json') check(key.split('/').pop().split('.')[0] === hash(bytes), `Digest mismatch: ${key}`);
      if (key.startsWith('packs/')) {
        const pack = JSON.parse(bytes);
        check(Array.isArray(pack.templates) && pack.templates.every(t => t.tier === 'free') && (pack.assets ?? []).every(a => a.access === 'free'), 'Premium source cannot enter public storage');
      }
      objects.set(key, bytes);
    }
  }
  visit(root);
  if (retainedRelease !== undefined) check(/^[a-f0-9]{64}$/.test(retainedRelease), 'Invalid retained release');
  const manifest = objects.get(retainedRelease ? `releases/${retainedRelease}/manifest.json` : 'manifest.json'); check(manifest, 'No published manifest');
  const pointer = JSON.parse(manifest);
  check(objects.get(`releases/${pointer.release}/manifest.json`)?.equals(manifest), 'Missing retained manifest');
  // Every retained release is staged for rollback, so validate each dependency
  // closure before allowing any writes, not just the selected catalogue.
  function validateRelease(bytes, expectedId) {
    const pointer = JSON.parse(bytes);
    check(pointer.schema === 2 && new RegExp(`^${digest}$`).test(pointer.release) && pointer.release === expectedId, 'Invalid release identity');
    let origin;
    const localKey = value => { const u = new URL(value); check(u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash, 'Invalid published URL'); origin ??= u.origin; check(u.origin === origin, 'Mixed release origins'); return u.pathname.slice(1); };
    const verified = (key, sha) => { const bytes = objects.get(key); check(bytes && hash(bytes) === sha, `Missing or changed dependency: ${key}`); return bytes; };
    check(Array.isArray(pointer.pages) && pointer.pages.length > 0 && pointer.pages.length <= 16, 'Invalid pages');
    for (const page of pointer.pages) {
      const key = localKey(page.url); check(key.startsWith(`releases/${pointer.release}/page-`), 'Wrong release page');
      const data = JSON.parse(verified(key, page.sha256)); check(data.release === pointer.release, 'Page identity mismatch');
      for (const pack of data.packs) {
        if (pack.preview_url) { const preview = localKey(pack.preview_url); verified(preview, preview.split('/').pop().split('.')[0]); }
        const key = localKey(pack.url);
        if (key.startsWith('downloads/')) { check(pack.access === 'premium', 'Invalid private pack'); continue; }
        check(key === `packs/${pack.sha256}.json` && pack.access === 'free', 'Invalid Free pack');
        const data = JSON.parse(verified(key, pack.sha256));
        for (const asset of data.assets ?? []) verified(`assets/free/${asset.sha256}.${{ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[asset.mime]}`, asset.sha256);
      }
    }
    return origin;
  }
  let origin;
  for (const [key, bytes] of objects) {
    const retained = key.match(new RegExp(`^releases/(${digest})/manifest\\.json$`));
    if (!retained) continue;
    const releaseOrigin = validateRelease(bytes, retained[1]);
    if (retained[1] === pointer.release) origin = releaseOrigin;
  }
  objects.delete('manifest.json');
  return { id: pointer.release, manifest, objects, origin };
}

/** R2-compatible conditional promotion. Old immutable objects remain for rollback. */
export async function promote(bucket, release, expected) {
  check(expected === null || /^[a-f0-9]{64}$/.test(expected), 'Supply expected release or none');
  const current = await bucket.get('manifest.json');
  const currentId = current ? JSON.parse(await current.text()).release : null;
  check(currentId === expected, 'Current release changed; inspect before retrying');
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
  const promoted = await bucket.put('manifest.json', release.manifest, { onlyIf: current ? { etagMatches: current.etag } : { etagDoesNotMatch: '*' }, sha256: hash(release.manifest) });
  check(promoted, 'Concurrent publication won; prior manifest preserved');
  return { release: release.id, created, reused: release.objects.size - created };
}

/** Private source closure from the same validated release. Never exposed by public routes. */
export function readPrivateRelease(directory, release) {
  const objects = new Map(); let total = 0;
  const read = (key, expected, size) => {
    check(/^(packs\/[a-f0-9]{64}\.json|assets\/premium\/[a-f0-9]{64}\.(png|jpg|webp))$/.test(key), 'Invalid private object path');
    const parts = key.split('/'); let path = resolve(directory, 'private');
    check(!lstatSync(path).isSymbolicLink(), 'Symlinks are not allowed');
    for (const part of parts) { path = join(path, part); check(!lstatSync(path).isSymbolicLink(), 'Symlinks are not allowed'); }
    const stat = lstatSync(path); check(stat.isFile() && stat.size > 0 && stat.size <= (key.startsWith('packs/') ? 262144 : 5242880), 'Private file exceeds budget');
    const bytes = readFileSync(path); check(hash(bytes) === expected && (size === undefined || bytes.length === size), `Private digest/size mismatch: ${key}`);
    if (!objects.has(key)) { total += bytes.length; check(total <= 134217728 && objects.size < 2000, 'Private release exceeds rehearsal budget'); objects.set(key, bytes); }
    return bytes;
  };
  for (const [key, bytes] of release.objects) {
    if (!/^releases\/[^/]+\/page-\d+\.json$/.test(key)) continue;
    for (const entry of JSON.parse(bytes).packs) {
      if (entry.access !== 'premium') continue;
      check(new URL(entry.url).pathname === `/downloads/${entry.sha256}.json`, 'Invalid premium download address');
      const pack = JSON.parse(read(`packs/${entry.sha256}.json`, entry.sha256));
      check(Array.isArray(pack.assets) && pack.assets.length <= 16, 'Invalid private asset manifest');
      for (const asset of pack.assets) {
        const ext = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp' }[asset.mime];
        check(ext && ['free','premium'].includes(asset.access), 'Invalid private asset');
        const path = `assets/${asset.access}/${asset.sha256}.${ext}`;
        if (asset.access === 'premium') read(path, asset.sha256, asset.bytes);
        else { const bytes = release.objects.get(path); check(bytes && hash(bytes) === asset.sha256 && bytes.length === asset.bytes, 'Missing Free asset used by premium pack'); }
      }
    }
  }
  return objects;
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

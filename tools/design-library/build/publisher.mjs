import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync, existsSync, lstatSync, fsyncSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const jsonBytes = value => JSON.stringify(value, null, 2) + '\n';
const check = (condition, message) => { if (!condition) throw new Error(message); };
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const identifier = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/.test(value);

/** Compile already reviewed packs. The CLI separately validates with the shipping PHP reader. */
export function buildRelease({ origin, packs, collections }) {
  const url = new URL(origin);
  check(url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/', 'Use an HTTPS service origin without a path or credentials');
  origin = url.origin;
  check(packs.length > 0 && packs.length <= 50 && collections.length <= 100, 'Release exceeds catalog limits');
  const objects = [], ids = new Set(), setups = new Map();
  const rows = [...packs].sort((a, b) => JSON.parse(a.json).id.localeCompare(JSON.parse(b.json).id)).map(({ json, access }) => {
    const pack = JSON.parse(json), bytes = Buffer.from(json), hash = sha256(bytes);
    check(identifier(pack.id) && !ids.has(pack.id) && bytes.length <= 262144, 'Invalid, repeated or oversized pack');
    check(['free', 'premium'].includes(access), 'Invalid pack access');
    check(access !== 'free' || pack.templates.every(template => template.tier === 'free'), 'Premium design cannot be published as Free');
    ids.add(pack.id); setups.set(pack.id, { hash, ids: new Set(pack.playbooks?.map(entry => entry.id) ?? []) });
    const scope = access === 'free' ? 'public' : 'private', key = `packs/${hash}.json`;
    objects.push({ scope, key, bytes, sha256: hash });
    return { id: pack.id, name: pack.name, description: pack.description, version: pack.version, sha256: hash,
      url: `${origin}/${scope === 'public' ? key : `downloads/${hash}.json`}` };
  });
  const collectionIds = new Set();
  const ordered = [...collections].sort((a, b) => a.id.localeCompare(b.id));
  for (const collection of ordered) {
    check(!collectionIds.has(collection.id), 'Repeated collection'); collectionIds.add(collection.id);
    for (const item of collection.items) {
      const pack = setups.get(item.pack_id);
      check(pack && pack.hash === item.pack_digest && pack.ids.has(item.setup_id), 'Missing or stale collection setup reference');
    }
  }
  const id = sha256(jsonBytes({ packs: rows, collections: ordered }));
  const pages = []; let page = { schema: 2, release: id, packs: [], collections: [] };
  const finishPage = () => {
    const bytes = Buffer.from(jsonBytes(page)), key = `releases/${id}/page-${pages.length + 1}.json`, hash = sha256(bytes);
    check(bytes.length <= 262144, 'One catalog entry exceeds the page budget');
    objects.push({ scope: 'public', key, bytes, sha256: hash }); pages.push({ url: `${origin}/${key}`, sha256: hash });
  };
  for (const [type, entries] of [['packs', rows], ['collections', ordered]]) for (const entry of entries) {
    page[type].push(entry);
    if (Buffer.byteLength(jsonBytes(page)) > 262144) {
      page[type].pop(); finishPage(); page = { schema: 2, release: id, packs: [], collections: [] }; page[type].push(entry);
    }
  }
  finishPage();
  check(pages.length <= 16 && objects.filter(item => item.key.startsWith('releases/')).reduce((sum, item) => sum + item.bytes.length, 0) <= 2097152, 'Release exceeds page budget');
  const manifest = jsonBytes({ schema: 2, release: id, pages });
  objects.push({ scope: 'public', key: `releases/${id}/manifest.json`, bytes: Buffer.from(manifest), sha256: sha256(manifest) });
  return { id, manifest, objects };
}

/** Local storage adapter. Only this pointer is mutable; private/ must never be web-served. */
export function publishRelease(directory, release, expectedRelease, { beforeWrite = () => {} } = {}) {
  check(expectedRelease === null || digest(expectedRelease), 'Supply the expected current release, or null for the first publication');
  const root = resolve(directory);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  check(!lstatSync(root).isSymbolicLink(), 'Storage cannot be a symlink');
  const lock = join(root, '.publish.lock'); let handle;
  try { handle = openSync(lock, 'wx', 0o600); } catch { throw new Error('Another publication is active; inspect the lock before retrying'); }
  const pathFor = (scope, key) => {
    check(['public', 'private'].includes(scope) && /^(packs\/[a-f0-9]{64}\.json|releases\/[a-f0-9]{64}\/(page-[0-9]+|manifest)\.json)$/.test(key), 'Invalid object key');
    const path = join(root, scope, key);
    for (let parent = dirname(path); parent !== root; parent = dirname(parent)) {
      if (existsSync(parent)) check(!lstatSync(parent).isSymbolicLink(), 'Storage cannot contain symlinks');
    }
    mkdirSync(dirname(path), { recursive: true, mode: scope === 'private' ? 0o700 : 0o755 });
    if (existsSync(path)) check(!lstatSync(path).isSymbolicLink(), 'Object cannot be a symlink');
    return path;
  };
  const atomic = (path, bytes, mode) => {
    const temp = `${path}.${randomUUID()}.tmp`;
    try {
      const fd = openSync(temp, 'wx', mode);
      try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(temp, path);
    } finally { if (existsSync(temp)) unlinkSync(temp); }
  };
  try {
    // Validate every object before writing anything, even for an idempotent retry.
    check(JSON.parse(release.manifest).release === release.id, 'Manifest identity mismatch');
    for (const object of release.objects) check(sha256(object.bytes) === object.sha256, 'Object digest mismatch');
    const pointer = join(root, 'public/manifest.json');
    pathFor('public', `releases/${release.id}/manifest.json`);
    if (existsSync(pointer)) check(!lstatSync(pointer).isSymbolicLink(), 'Pointer cannot be a symlink');
    const current = existsSync(pointer) ? JSON.parse(readFileSync(pointer, 'utf8')).release : null;
    check(current === expectedRelease, 'Current release changed; inspect it before publishing again');
    // Versions name immutable packs, not just releases. Check retained objects
    // as well as the current pointer so republishing an old version cannot fork it.
    const candidates = release.objects.filter(object => object.key.startsWith('packs/')).map(object => ({ object, pack: JSON.parse(object.bytes) }));
    for (const scope of ['public', 'private']) {
      const folder = join(root, scope, 'packs');
      if (!existsSync(folder)) continue;
      check(!lstatSync(join(root, scope)).isSymbolicLink() && !lstatSync(folder).isSymbolicLink(), 'Storage cannot contain symlinks');
      for (const file of readdirSync(folder)) {
        if (!/^[a-f0-9]{64}\.json$/.test(file)) continue;
        const path = join(folder, file);
        check(!lstatSync(path).isSymbolicLink(), 'Object cannot be a symlink');
        const bytes = readFileSync(path);
        check(sha256(bytes) + '.json' === file, 'Immutable object has different bytes; publication stopped');
        const previous = JSON.parse(bytes);
        for (const { object, pack } of candidates) if (pack.id === previous.id && pack.version === previous.version) {
          check(object.sha256 === sha256(bytes), 'Changed pack bytes require a new version');
          check(object.scope === scope, 'Changing an existing version’s access scope requires a new version');
        }
      }
    }
    let created = 0;
    for (const object of release.objects) {
      const path = pathFor(object.scope, object.key);
      if (existsSync(path)) check(sha256(readFileSync(path)) === object.sha256, 'Immutable object has different bytes; publication stopped');
      else { beforeWrite(object.key); atomic(path, object.bytes, object.scope === 'private' ? 0o600 : 0o644); created++; }
    }
    // Read back all objects, including reused ones, before switching the entry point.
    for (const object of release.objects) check(sha256(readFileSync(pathFor(object.scope, object.key))) === object.sha256, 'Stored object failed verification');
    beforeWrite('manifest.json');
    atomic(pointer, release.manifest, 0o644);
    return { release: release.id, created, reused: release.objects.length - created };
  } finally { closeSync(handle); unlinkSync(lock); }
}

import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync, existsSync, lstatSync, fsyncSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const jsonBytes = value => JSON.stringify(value, null, 2) + '\n';
const compact = value => JSON.stringify(value);
const check = (condition, message) => { if (!condition) throw new Error(message); };
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const identifier = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/.test(value);

/** The reader's bounds (src/Template/Catalog/CatalogIndex.php), shared so the build refuses what a site would. */
export const LIMITS = { object: 262144, pointer: 65536, pages: 16, index: 1048576, html: 2097152, image: 5242880 };
const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const KEY = /^v3\/(manifest\.json|releases\/[a-f0-9]{64}\.json|index\/[a-f0-9]{64}\.json|(designs|setups)\/[a-f0-9]{64}\.json|assets\/[a-f0-9]{64}\.(png|jpg|webp)|thumbs\/[a-f0-9]{64}(@2x)?\.webp|og\/[a-f0-9]{64}\.jpg|previews\/[a-f0-9]{64}\.html)$/;

/**
 * Compile reviewed, exported designs and setups into one v3 release
 * (docs/template-discovery-api.md). Every object but the pointer is
 * content-addressed; free objects are public and premium ones private.
 * The CLI separately runs the shipping PHP reader over the result.
 */
export function buildRelease({ designs, setups = [], collections = [], taxonomy = {}, withdrawn = [], popularity = null, i18n = {}, bundledOnly = [] }) {
  check(designs.length > 0, 'A release needs at least one design');
  const objects = [];
  const put = (scope, key, bytes) => {
    check(KEY.test(key), `Invalid object key ${key}`);
    const existing = objects.find(object => object.scope === scope && object.key === key);
    if (existing) { check(existing.sha256 === sha256(bytes), `Two objects claim ${key}`); return; }
    objects.push({ scope, key, bytes, sha256: sha256(bytes) });
  };
  const index = obj => { const bytes = Buffer.from(compact(obj)); put('public', `v3/index/${sha256(bytes)}.json`, bytes); return sha256(bytes); };

  const entries = [], details = [], ids = new Set(), seen = new Map();
  // Oldest first (`added`, from the revision registry): pages fill in that order.
  const order = (a, b) => (a.added ?? Infinity) - (b.added ?? Infinity) || a.id.localeCompare(b.id);
  for (const design of [...designs].sort(order)) {
    const object = JSON.parse(design.json), bytes = Buffer.from(design.json), hash = sha256(bytes);
    check(identifier(design.id) && !ids.has(design.id) && object.id === design.id && object.revision === design.revision, `Invalid or repeated design ${design.id}`);
    check(bytes.length <= LIMITS.object, `${design.id} exceeds the per-object budget`);
    check(['free', 'pro'].includes(object.tier), `${design.id} has an unknown plan`);
    ids.add(design.id); seen.set(design.id, { revision: design.revision, tier: object.tier, format: object.display_type });
    put(object.tier === 'free' ? 'public' : 'private', `v3/designs/${hash}.json`, bytes);
    const supplied = new Map((design.media ?? []).map(item => [item.id, item]));
    check(supplied.size === (object.assets ?? []).length, `${design.id}: image bytes must match the design's asset list`);
    for (const asset of object.assets ?? []) {
      const item = supplied.get(asset.id), extension = EXTENSIONS[asset.mime];
      check(item && Buffer.isBuffer(item.bytes) && item.bytes.length === asset.bytes && sha256(item.bytes) === asset.sha256 && extension, `${design.id}: image bytes do not match the approved asset`);
      check(item.rights?.redistribution === true && ['original', 'ai-generated', 'licensed'].includes(item.rights.kind) && item.rights.source?.trim() && item.rights.reviewedBy?.trim(), `${design.id}: every image needs a rights record`);
      check(object.tier !== 'free' || asset.access === 'free', `${design.id}: a Free design cannot use a premium image`);
      put(asset.access === 'free' ? 'public' : 'private', `v3/assets/${asset.sha256}.${extension}`, item.bytes);
    }
    const entry = { ...design.entry, sha256: hash, bytes: bytes.length };
    const gallery = design.gallery;
    if (gallery) {
      check(Buffer.isBuffer(gallery.thumb1x) && Buffer.isBuffer(gallery.thumb2x) && gallery.thumb1x.length <= LIMITS.image && gallery.thumb2x.length <= LIMITS.image, `${design.id}: invalid thumbnail`);
      const thumb = sha256(gallery.thumb1x);
      put('public', `v3/thumbs/${thumb}.webp`, gallery.thumb1x);
      put('public', `v3/thumbs/${thumb}@2x.webp`, gallery.thumb2x);
      entry.thumb = thumb;
      const detail = { id: design.id, slug: entry.slug ?? design.id, name: object.name, format: object.display_type, tier: object.tier, revision: object.revision, ...(object.meta ?? {}), screens: gallery.screens,
        thumb: { sha: thumb, width: gallery.width, height: gallery.height, alt: gallery.alt, x2: sha256(gallery.thumb2x) } };
      for (const [field, html] of [['preview', gallery.preview], ['design_only', gallery.designOnly]]) {
        if (html === undefined) continue;
        const htmlBytes = Buffer.from(html);
        check(htmlBytes.length <= LIMITS.html, `${design.id}: preview exceeds its budget`);
        put('public', `v3/previews/${sha256(htmlBytes)}.html`, htmlBytes);
        detail[field] = sha256(htmlBytes);
      }
      if (gallery.og) { put('public', `v3/og/${sha256(gallery.og)}.jpg`, gallery.og); detail.og = sha256(gallery.og); }
      details.push(detail);
    }
    entries.push(entry);
  }
  // Shown on the website from the bundled source; not downloadable, so not in any page.
  const bundled = new Set();
  for (const design of bundledOnly) {
    check(identifier(design.id) && !ids.has(design.id) && !bundled.has(design.id), `Invalid or repeated bundled-only design ${design.id}`);
    bundled.add(design.id);
    const thumb = sha256(design.gallery.thumb1x);
    put('public', `v3/thumbs/${thumb}.webp`, design.gallery.thumb1x);
    put('public', `v3/thumbs/${thumb}@2x.webp`, design.gallery.thumb2x);
    const html = Buffer.from(design.gallery.preview), only = Buffer.from(design.gallery.designOnly);
    put('public', `v3/previews/${sha256(html)}.html`, html);
    put('public', `v3/previews/${sha256(only)}.html`, only);
    put('public', `v3/og/${sha256(design.gallery.og)}.jpg`, design.gallery.og);
    const { description, industries, occasions, style, colour } = design.meta ?? {};
    details.push({ id: design.id, slug: design.meta?.slug ?? design.id, name: design.name, format: design.format, tier: design.tier, bundled_only: true,
      ...Object.fromEntries(Object.entries({ description, industries, occasions, style, colour }).filter(([, value]) => value !== undefined)),
      screens: design.gallery.screens, preview: sha256(html), design_only: sha256(only), og: sha256(design.gallery.og),
      thumb: { sha: thumb, width: design.gallery.width, height: design.gallery.height, alt: design.gallery.alt, x2: sha256(design.gallery.thumb2x) } });
  }

  const setupEntries = [];
  for (const setup of [...setups].sort(order)) {
    const object = JSON.parse(setup.json), bytes = Buffer.from(setup.json), hash = sha256(bytes);
    const pinned = seen.get(object.design?.id);
    check(identifier(setup.id) && object.id === setup.id && pinned?.revision === object.design.revision, `${setup.id} pins a design revision this release does not carry`);
    check(bytes.length <= LIMITS.object, `${setup.id} exceeds the per-object budget`);
    check(object.tier === 'pro' || pinned.tier === 'free', `${setup.id}: a Free setup cannot pin a Pro design`);
    put(object.tier === 'free' ? 'public' : 'private', `v3/setups/${hash}.json`, bytes);
    setupEntries.push({ ...setup.entry, sha256: hash, bytes: bytes.length });
  }

  for (const collection of collections) {
    check(identifier(collection.id) && digest(collection.revision), 'Invalid collection identity');
    for (const item of collection.items) {
      check(item.setup ? setupEntries.some(entry => entry.id === item.setup) : ids.has(item.design) || bundled.has(item.design), `Collection ${collection.id} needs a member this release does not carry`);
    }
  }

  // Pages are filled to the per-object budget; the total is the reader's 1 MiB.
  const pages = []; let pageBytes = 0;
  const paginate = (rows, key) => {
    let page = { schema: 3, designs: [], setups: [] };
    const finish = () => { const sha = index(page); pageBytes += objects.find(o => o.key === `v3/index/${sha}.json`).bytes.length; pages.push(sha); };
    for (const row of rows) {
      page[key].push(row);
      if (Buffer.byteLength(compact(page)) > LIMITS.object) {
        page[key].pop(); check(page[key].length > 0, 'One entry exceeds the page budget');
        finish(); page = { schema: 3, designs: [], setups: [] }; page[key].push(row);
      }
    }
    if (page.designs.length || page.setups.length) finish();
  };
  paginate(entries, 'designs');
  paginate(setupEntries, 'setups');
  check(pages.length <= LIMITS.pages && pageBytes <= LIMITS.index, `The index is ${pageBytes} bytes in ${pages.length} pages; the reader's budget is ${LIMITS.index} in ${LIMITS.pages}`);
  const detailPages = [];
  for (let start = 0, page = []; start <= details.length; start++) {
    const row = details[start];
    if (row) page.push(row);
    if (!row || Buffer.byteLength(compact({ schema: 3, details: page })) > LIMITS.object) {
      if (row) page.pop();
      if (page.length) detailPages.push(index({ schema: 3, details: page }));
      page = row ? [row] : [];
      if (!row) break;
    }
  }
  const sidecars = Object.fromEntries(Object.entries(i18n).map(([locale, words]) => [locale, index({ schema: 3, designs: words })]));
  const release = Buffer.from(compact({ schema: 3, minor: 0, pages, details: detailPages, ...(Object.keys(sidecars).length ? { i18n: sidecars } : {}), taxonomy, collections }));
  check(release.length <= LIMITS.object, 'The release object exceeds its budget');
  const id = sha256(release);
  put('public', `v3/releases/${id}.json`, release);
  const pointer = buildPointer({ release: id, withdrawn, popularity: popularity === null ? null : index({ schema: 3, generated: popularity.generated, downloads: popularity.downloads }) });
  return { id, pointer, objects, designs: [...ids] };
}

/** The one mutable object. Withdrawal and popularity can move without a release. */
export function buildPointer({ release, withdrawn = [], popularity = null }) {
  check(digest(release), 'Invalid release identity');
  for (const row of withdrawn) check(identifier(row.id) && (row.revision === undefined || Number.isInteger(row.revision)) && ['rights', 'quality', 'broken', 'other'].includes(row.reason), 'Invalid withdrawal');
  const bytes = Buffer.from(compact({ schema: 3, minor: 0, release, withdrawn, ...(popularity ? { popularity } : {}) }));
  check(bytes.length <= LIMITS.pointer, 'The pointer exceeds its budget');
  return bytes;
}

/** Design ids a stored release lists, read through its pages. */
export function releaseDesigns(read, release) {
  const object = JSON.parse(read(`v3/releases/${release}.json`));
  return new Set(object.pages.flatMap(sha => JSON.parse(read(`v3/index/${sha}.json`)).designs.map(entry => entry.id)));
}

/**
 * A release may not silently drop a live design: a site that installed it
 * keeps it either way, but the picker and the website lose it, so dropping one
 * means saying so in `withdrawn`.
 */
export function guardDrops(before, after, withdrawn) {
  const named = new Set(withdrawn.filter(row => row.revision === undefined).map(row => row.id));
  const dropped = [...before].filter(id => !after.has(id) && !named.has(id)).sort();
  check(dropped.length === 0, `This release drops live designs without withdrawing them: ${dropped.join(', ')}`);
}

/** Local storage adapter. Only the pointer is mutable; private/ must never be web-served. */
export function publishRelease(directory, release, expectedRelease, { beforeWrite = () => {} } = {}) {
  check(expectedRelease === null || digest(expectedRelease), 'Supply the expected current release, or null for the first publication');
  const root = resolve(directory);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  check(!lstatSync(root).isSymbolicLink(), 'Storage cannot be a symlink');
  const lock = join(root, '.publish.lock'); let handle;
  try { handle = openSync(lock, 'wx', 0o600); } catch { throw new Error('Another publication is active; inspect the lock before retrying'); }
  const pathFor = (scope, key) => {
    check(['public', 'private'].includes(scope) && KEY.test(key) && (scope === 'public' || /^v3\/(designs|setups|assets)\//.test(key)), 'Invalid object key');
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
    const pointer = JSON.parse(release.pointer);
    check(pointer.release === release.id, 'Pointer identity mismatch');
    for (const object of release.objects) check(sha256(object.bytes) === object.sha256, 'Object digest mismatch');
    const pointerPath = pathFor('public', 'v3/manifest.json');
    const current = existsSync(pointerPath) ? JSON.parse(readFileSync(pointerPath, 'utf8')).release : null;
    check(current === expectedRelease, 'Current release changed; inspect it before publishing again');
    if (current !== null && current !== release.id) {
      const read = key => readFileSync(join(root, 'public', key));
      guardDrops(releaseDesigns(read, current), new Set(release.designs), pointer.withdrawn);
    }
    let created = 0;
    for (const object of release.objects) {
      const path = pathFor(object.scope, object.key);
      if (existsSync(path)) check(sha256(readFileSync(path)) === object.sha256, 'Immutable object has different bytes; publication stopped');
      else { beforeWrite(object.key); atomic(path, object.bytes, object.scope === 'private' ? 0o600 : 0o644); created++; }
    }
    // Read back all objects, including reused ones, before switching the entry point.
    for (const object of release.objects) check(sha256(readFileSync(pathFor(object.scope, object.key))) === object.sha256, 'Stored object failed verification');
    beforeWrite('v3/manifest.json');
    atomic(pointerPath, release.pointer, 0o644);
    return { release: release.id, created, reused: release.objects.length - created };
  } finally { closeSync(handle); unlinkSync(lock); }
}

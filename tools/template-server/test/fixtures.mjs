/** In-test v3 catalogues: every object content-addressed exactly as the publisher writes it. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { hash } from '../scripts/storage.mjs';

export const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
export const sha = hash;

/**
 * designs: [{ id, revision = 1, tier = 'free', images = ['free'], aliases }]
 * setups:  [{ id, design, revision = 1, tier = design's tier }]
 * Identical designs produce identical objects, so two catalogues share them.
 */
export function catalogue({ designs = [{ id: 'reading-slip' }], setups = [], withdrawn = [], label = 'base', popularity } = {}) {
  const pub = new Map(), priv = new Map();
  const put = (scope, key, bytes) => { (scope === 'public' ? pub : priv).set(key, bytes); return hash(bytes); };
  const entries = [], setupEntries = [], details = [], objects = {};
  for (const { id, revision = 1, tier = 'free', images = ['free'], aliases } of designs) {
    const assets = images.map((access, n) => {
      const bytes = Buffer.from(`${id}@${revision} image ${n} ${access}`);
      const digest = put(access === 'free' ? 'public' : 'private', `v3/assets/${hash(bytes)}.png`, bytes);
      return { id: `image-${n}`, sha256: digest, mime: 'image/png', bytes: bytes.length, width: 8, height: 8, access };
    });
    const object = json({ schema: 3, minor: 0, id, revision, name: id, display_type: 'popup', tier, family: id,
      meta: { description: 'A design.', slug: id, industries: [], occasions: [], style: [], colour: [] },
      requires: { plugin: '1.0.0', tree: 2, capabilities: [] }, assets,
      image_bindings: assets.map((asset, n) => ({ slot: `tree/steps/0/content/children/${n}/src`, asset_id: asset.id })), tree: { v: 2, steps: [] }, tokens: {} });
    const digest = put(tier === 'free' ? 'public' : 'private', `v3/designs/${hash(object)}.json`, object);
    objects[id] = { sha256: digest, bytes: object, assets };
    const thumb = put('public', `v3/thumbs/${hash(Buffer.from(`thumb ${id}@${revision}`))}.webp`, Buffer.from(`thumb ${id}@${revision}`));
    pub.set(`v3/thumbs/${thumb}@2x.webp`, Buffer.from(`thumb 2x ${id}@${revision}`));
    const preview = Buffer.from(`<!doctype html><title>${id}</title>`), og = Buffer.from(`og ${id}@${revision}`);
    put('public', `v3/previews/${hash(preview)}.html`, preview); put('public', `v3/og/${hash(og)}.jpg`, og);
    entries.push({ id, revision, sha256: digest, bytes: object.length, name: id, format: 'popup', tier, family: id,
      ...(aliases ? { aliases } : {}), slug: id, requires: { plugin: '1.0.0', capabilities: [] }, prerequisites: [], tags: [], facets: {}, thumb });
    details.push({ id, slug: id, description: 'A design.', industries: [], occasions: [], style: [], colour: [],
      screens: [{ id: 's1', label: 'First' }], preview: hash(preview), og: hash(og), thumb: { sha: thumb, width: 8, height: 8, alt: `${id} preview` } });
  }
  for (const { id, design, revision = 1, tier } of setups) {
    const pinned = entries.find(entry => entry.id === design), level = tier ?? pinned.tier;
    const object = json({ schema: 3, minor: 0, id, revision, name: id, tier: level, design: { id: design, revision: pinned.revision },
      requires: { plugin: '1.0.0', capabilities: [] }, playbook: { goal: 'grow_email_list', copy: {}, rules: [], notes: '', business_types: [], destination_hint: null } });
    const digest = put(level === 'free' ? 'public' : 'private', `v3/setups/${hash(object)}.json`, object);
    objects[id] = { sha256: digest, bytes: object };
    setupEntries.push({ id, revision, sha256: digest, bytes: object.length, name: id, goal: 'grow_email_list', tier: level,
      design: { id: design, revision: pinned.revision }, requires: { plugin: '1.0.0', capabilities: [] } });
  }
  const page = put('public', `v3/index/${hash(json({ schema: 3, designs: entries, setups: setupEntries }))}.json`, json({ schema: 3, designs: entries, setups: setupEntries }));
  const detail = put('public', `v3/index/${hash(json({ schema: 3, details }))}.json`, json({ schema: 3, details }));
  const release = json({ schema: 3, minor: 0, pages: [page], details: [detail], i18n: {},
    taxonomy: { style: [{ id: label, label }] }, collections: [] });
  const id = put('public', `v3/releases/${hash(release)}.json`, release);
  let sidecar;
  if (popularity) sidecar = put('public', `v3/index/${hash(json(popularity))}.json`, json(popularity));
  const pointer = json({ schema: 3, minor: 0, release: id, withdrawn, ...(sidecar ? { popularity: sidecar } : {}) });
  return { id, pointer, public: pub, private: priv, objects, entries, setupEntries, page };
}

/** The shape readPublicRelease returns, without a directory. */
export const release = (...catalogues) => {
  const current = catalogues.at(-1);
  return { id: current.id, pointer: current.pointer, objects: new Map(catalogues.flatMap(item => [...item.public])), releases: catalogues.map(item => item.id).sort() };
};
export const privateObjects = (...catalogues) => new Map(catalogues.flatMap(item => [...item.private]));

/** `<root>/public/<key>` and `<root>/private/<key>`; the last catalogue's pointer is current. */
export function writeDirectory(root, ...catalogues) {
  const write = (path, bytes) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); };
  for (const item of catalogues) {
    for (const [key, bytes] of item.public) write(join(root, 'public', key), bytes);
    for (const [key, bytes] of item.private) write(join(root, 'private', key), bytes);
  }
  write(join(root, 'public/v3/manifest.json'), catalogues.at(-1).pointer);
  return root;
}

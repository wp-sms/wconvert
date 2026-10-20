import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildRelease, publishRelease } from './publisher.mjs';
import { readPublicRelease, readPrivateRelease } from '../../template-server/scripts/storage.mjs';
import { backupRemote } from '../../template-server/scripts/backup-remote.mjs';
const design = { id: 'fixed-design', name: 'Original', tier: 'free', display_type: 'inline', tokens: {}, tree: { steps: [{ id: 'intro', name: 'Introduction', content: {} }, { id: 'results', name: 'Results', results: [{ id: 'first', heading: 'First outcome' }, { id: 'fallback', heading: 'Other outcome' }] }] } };
const pack = (template = design, id = 'pack-a', facts) => ({
  preview: '<h1>Public preview</h1>',
  json: JSON.stringify({ id, version: '1.0.0', name: 'A pack', templates: [template], playbooks: [], assets: [] }),
  access: template.tier === 'free' ? 'free' : 'premium',
  ...(facts ? { public_metadata: { [template.id]: facts } } : {}),
});
const release = packs => buildRelease({ origin: 'https://templates.example', packs, collections: [], designs: true });
const catalogue = release => JSON.parse(release.objects.find(object => object.key.endsWith('/designs.json')).bytes);

test('design and screen IDs survive rename and reorder; unknown metadata stays absent', () => {
  const a = catalogue(release([pack()])).designs[0];
  const b = catalogue(release([pack({ ...design, name: 'Renamed', tree: { steps: [...design.tree.steps].reverse() } })])).designs[0];
  assert.equal(a.id, b.id);
  assert.deepEqual(a.screens.map(s => s.id).sort(), b.screens.map(s => s.id).sort());
  assert.notEqual(a.revision, b.revision);
  for (const key of ['description', 'prerequisites', 'bundled', 'categories', 'tree', 'tokens']) assert.equal(key in a, false);
  assert.equal(a.preview_status, 'unavailable'); assert.equal('embed_url' in a, false);
  const fakeName = catalogue(release([pack({ ...design, name: 'WooCommerce premium popup' })])).designs[0];
  assert.equal(fakeName.availability, 'free'); assert.equal('prerequisites' in fakeName, false);
});

test('authoritative availability and dependencies remain distinct from delivery; duplicate designs count once', () => {
  const entry = pack(design, 'pack-a', { bundled: true, bundle_tier: 'free', prerequisites: { plugins: [] }, credentials: 'never-public' });
  entry.access = 'premium';
  const data = catalogue(release([entry, pack(design, 'pack-b')]));
  assert.equal(data.designs.length, 1);
  assert.equal(data.designs[0].availability, 'free');
  assert.deepEqual(data.designs[0].packs, [{ id: 'pack-a', access: 'pro' }, { id: 'pack-b', access: 'free' }]);
  assert.equal(data.designs[0].bundled, true);
  assert.doesNotMatch(JSON.stringify(data), /credentials|never-public|downloads|tokens|content/);
  const pro = catalogue(release([pack({ ...design, tier: 'pro' }, 'pack-pro', { prerequisites: { plugins: ['woocommerce'] } })])).designs[0];
  assert.equal(pro.availability, 'pro'); assert.deepEqual(pro.prerequisites.plugins, ['woocommerce']);
  assert.throws(() => release([pack(), pack({ ...design, name: 'Conflicting version' }, 'pack-b')]), /Conflicting/);
});

test('gallery assets are mandatory dependencies; promotion and backup preserve complete releases', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'gallery-publisher-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const empty = pack(); empty.json = JSON.stringify({ ...JSON.parse(empty.json), templates: [] });
  const initial = release([empty]);
  assert.deepEqual(catalogue(initial).designs, []);
  publishRelease(directory, initial, null);
  const entry = pack({ ...design, tier: 'pro' });
  entry.json = JSON.stringify({ ...JSON.parse(entry.json), version: '1.0.1' });
  entry.gallery = [{ id: design.id, embed: '<h1>Focused preview</h1>', thumbnail: { bytes: Buffer.from('fixture JPEG bytes'), width: 640, height: 480, alt: 'Sample design', partial: false, screen_id: 'intro' } }];
  const next = release([entry]);
  assert.throws(() => publishRelease(directory, next, initial.id, { beforeWrite(key) { if (key === 'manifest.json') throw Error('interrupted'); } }), /interrupted/);
  assert.equal(JSON.parse(readFileSync(join(directory, 'public/manifest.json'))).release, initial.id);
  publishRelease(directory, next, initial.id);
  assert.equal(readPublicRelease(directory).id, next.id);
  const staged = readPublicRelease(directory), privateObjects = readPrivateRelease(directory, staged);
  const bucket = objects => ({ get: async key => objects.has(key) ? { arrayBuffer: async () => objects.get(key) } : null });
  const snapshot = join(directory, 'backup');
  await backupRemote({
    ...bucket(new Map([...staged.objects, ['manifest.json', Buffer.from(next.manifest)]])),
    retainedReleases: async () => [initial.id, next.id],
  }, bucket(privateObjects), snapshot, 'https://templates.example');
  assert.deepEqual(readPublicRelease(snapshot).objects, staged.objects);
  assert.equal(readPublicRelease(snapshot, initial.id).id, initial.id);
  const files = next.objects.filter(object => object.key.endsWith('/designs.json') || object.key.startsWith('thumbnails/') || object.bytes.toString() === '<h1>Focused preview</h1>');
  for (const object of files) {
    const file = join(directory, 'public', object.key);
    unlinkSync(file);
    assert.throws(() => readPublicRelease(directory), /Missing/);
    writeFileSync(file, object.bytes);
  }
  const catalogueFile = join(directory, 'public', `releases/${next.id}/designs.json`);
  const changed = catalogue(next); changed.designs[0].availability = 'free';
  writeFileSync(catalogueFile, JSON.stringify(changed));
  assert.throws(() => readPublicRelease(directory), /integrity mismatch/);
  writeFileSync(catalogueFile, next.objects.find(object => object.key.endsWith('/designs.json')).bytes);
  assert.equal(readPublicRelease(directory, initial.id).id, initial.id);
  const removedEntry = { ...empty, json: JSON.stringify({ ...JSON.parse(empty.json), version: '1.0.2' }) };
  const removed = release([removedEntry]);
  publishRelease(directory, removed, next.id);
  assert.equal(catalogue(removed).designs.length, 0);
  assert.equal(readPublicRelease(directory).id, removed.id);
  assert.equal(readPublicRelease(directory, next.id).id, next.id, 'Removed designs leave historical releases available');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRelease, publishRelease, sha256, jsonBytes } from './publisher.mjs';
import { readPublicRelease } from '../../template-server/scripts/storage.mjs';
import { validateDesignCatalogue } from '../../template-server/scripts/design-catalogue.mjs';

const design = id => ({ id, name: id, tier: 'pro', display_type: 'fullscreen',
  tree: { steps: [{ id: 'results', name: 'Results', results: [{ id: 'fallback/other', heading: 'Other' }] }] } });
const render = id => ({ json: JSON.stringify({ id, templates: [design(id)] }),
  public_metadata: { [id]: { bundled: true, bundle_tier: 'pro', prerequisites: { plugins: [] } } },
  gallery: [{ id, embed: 'focused', designOnly: 'design-only', thumbnail: {
    bytes: Buffer.from('jpeg'), width: 100, height: 500, partial: false, alt: 'Preview', screen_id: 'results/fallback/other',
  } }] });
const event = { family: 'black-friday', start: '2026-11-27', end_exclusive: '2026-12-01',
  feature_start: '2026-10-16', feature_end_exclusive: '2026-12-01' };
function candidate(bundled = [render('bundled-design')]) {
  return buildRelease({ origin: 'https://templates.example', packs: [{
    access: 'free', preview: 'focused', json: JSON.stringify({ id: 'existing-pack', version: '1.0.0', templates: [{ ...design('packed-design'), tier: 'free' }], playbooks: [] }),
  }], collections: [], designs: true, gallery: {
    bundled, collections: [{ id: 'black-friday-2026', name: 'Black Friday', description: 'Review your dates.',
      event, items: [{ setup_id: 'sale-setup', stage: 'during' }, { setup_id: 'other-setup', stage: 'after' }] }],
    setupDesigns: new Map([['sale-setup', { design_id: 'bundled-design' }], ['other-setup', { design_id: 'bundled-design' }]]),
  } });
}
function data(release) {
  return JSON.parse(release.objects.find(o => o.key.endsWith('/designs.json')).bytes);
}
function context(release) {
  const page = JSON.parse(release.objects.find(o => o.key.endsWith('/page-1.json')).bytes);
  return { id: release.id, packs: page.packs, collections: page.collections, origin: 'https://templates.example' };
}
test('bundled projection preserves legacy designs, exact membership, dates and encoded screen URLs', () => {
  const release = candidate(), catalogue = data(release), { extensions } = catalogue;
  assert.deepEqual(catalogue.designs.map(design => design.id), ['packed-design']);
  assert.equal(release.id, sha256(jsonBytes({ packs: context(release).packs, collections: [], designs: catalogue.designs })), 'The pre-extension release identity algorithm remains valid');
  const item = extensions.bundled_designs[0];
  assert.deepEqual(item.packs, []); assert.equal('pack_id' in item, false);
  assert.equal(item.availability, 'pro'); assert.equal(item.bundle_tier, 'pro');
  assert.match(item.screens[0].design_only_embed_url, /#screen=results%2Ffallback%2Fother$/);
  assert.deepEqual(extensions.collections[0].design_ids, ['bundled-design']);
  assert.equal(extensions.collections[0].items.length, 2);
  assert.deepEqual(extensions.collections[0].event, { ...event, date_basis: 'site-calendar', end_semantics: 'exclusive' });
  assert.doesNotMatch(JSON.stringify(catalogue), /"tree"|"tokens"|downloads|private|licen[cs]e/);
  assert.equal(release.objects.filter(o => o.key.startsWith('packs/')).length, 1, 'No synthetic bundled delivery pack');
  assert.equal(validateDesignCatalogue(catalogue, context(release)).size, 3);
});
test('extensions and design-only assets participate in immutable release integrity and retention', t => {
  const directory = mkdtempSync(join(tmpdir(), 'gallery-extension-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const release = candidate(); publishRelease(directory, release, null);
  assert.equal(readPublicRelease(directory).id, release.id);
  const changed = data(release); changed.extensions.collections[0].event.start = '2026-11-26';
  assert.throws(() => validateDesignCatalogue(changed, context(release)), /integrity/);
  const object = release.objects.find(o => o.bytes.toString() === 'design-only');
  unlinkSync(join(directory, 'public', object.key));
  assert.throws(() => readPublicRelease(directory), /Missing or changed dependency/);
});
test('unavailable bundled previews have no asset or screen URLs', () => {
  const entry = render('bundled-design'); delete entry.gallery;
  const release = candidate([entry]), catalogue = data(release);
  const item = catalogue.extensions.bundled_designs[0];
  assert.equal(item.preview_status, 'unavailable');
  for (const key of ['preview_url', 'embed_url', 'design_only_embed', 'thumbnail']) assert.equal(key in item, false);
  assert.deepEqual([...validateDesignCatalogue(catalogue, context(release))], []);
});
test('membership and event validators reject invalid projections even with a recomputed release digest', () => {
  const release = candidate(), ctx = context(release);
  for (const mutate of [
    c => { c.extensions.bundled_designs[0].pack_id = 'invented'; },
    c => { c.extensions.collections[0].items[0].design_id = 'absent'; },
    c => { c.extensions.collections[0].design_ids.push('invented'); },
    c => { c.extensions.collections[0].event.end_exclusive = '2026-11-26'; },
    c => { c.extensions.bundled_designs[0].screens[0].design_only_embed_url += '&device=tablet'; },
    c => { c.designs.push(c.extensions.bundled_designs[0]); },
  ]) {
    const c = data(release); mutate(c);
    for (const design of c.designs) design.gallery_extensions_sha256 = sha256(jsonBytes(c.extensions));
    const id = sha256(jsonBytes({ packs: ctx.packs, collections: ctx.collections, designs: c.designs }));
    c.release = id;
    assert.throws(() => validateDesignCatalogue(c, { ...ctx, id }));
  }
});

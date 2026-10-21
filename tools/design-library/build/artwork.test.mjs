import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { artworkExports } from './artwork.mjs';

const root = resolve(import.meta.dirname, '../../..');
const plan = JSON.parse(readFileSync(resolve(root, 'tools/design-library/publishing/catalog.json')));
const exportDesign = (sources, id = 'product-shelf', rights = plan.image_rights) => JSON.parse(execFileSync('php', [resolve(import.meta.dirname, 'export-designs.php')], {
  input: JSON.stringify({ mode: 'designs', designs: [{ id, revision: 1 }], setups: [], raster_sources: sources, image_rights: rights }), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
}));

test('reviewed derivative exports the real illustrated design without embedding raster bytes in the bundled template', () => {
  const sources = artworkExports(root, plan.artwork_exports);
  const output = exportDesign(sources).designs[0], design = JSON.parse(output.json);
  assert.equal(design.schema, 3);
  assert.equal(design.assets.length, 1);
  assert.equal(design.assets[0].width, 1920);
  assert.equal(design.assets[0].height, 500);
  assert.deepEqual(Buffer.from(output.media[0].base64, 'base64'), readFileSync(resolve(root, Object.values(plan.artwork_exports)[0].path)));
  assert.equal(output.media[0].rights.kind, 'original');
  assert.deepEqual(Object.keys(design.image_bindings[0]), ['slot', 'asset_id']);
  assert.match(design.image_bindings[0].slot, /^tree\/steps\/0\/content\/.*\/src$/);
  assert.ok(design.requires.capabilities.includes('pack-images:1'), 'An image design declares image support');
  assert.doesNotMatch(output.json, /data:image/);
  assert.match(readFileSync(resolve(root, 'resources/templates/library/product-shelf.json'), 'utf8'), /data:image\/svg/);
  assert.match(exportDesign({ ['0'.repeat(64)]: Object.values(sources)[0] }).failures[0].reason, /SVG conversion needs a new review/);
});

test('an image without a rights record of a known kind cannot be exported', () => {
  const sources = artworkExports(root, plan.artwork_exports);
  const rights = structuredClone(plan.image_rights);
  for (const record of Object.values(rights)) delete record.kind;
  const output = JSON.parse(execFileSync('php', [resolve(import.meta.dirname, 'export-designs.php')], {
    input: JSON.stringify({ mode: 'designs', designs: [{ id: 'product-shelf', revision: 1 }], setups: [], raster_sources: sources, image_rights: rights }), encoding: 'utf8',
  }));
  assert.deepEqual(output.designs, []);
  assert.match(output.failures[0].reason, /original, ai-generated or licensed/);
});

test('changed raster bytes, evidence or an escaped source path cannot publish an approved derivative', () => {
  for (const mutate of [
    declaration => { declaration.sha256 = '0'.repeat(64); },
    declaration => { declaration.evidence.sha256 = '0'.repeat(64); },
    declaration => { declaration.path = 'README.md'; },
  ]) {
    const changed = structuredClone(plan.artwork_exports);
    mutate(Object.values(changed)[0]);
    assert.throws(() => artworkExports(root, changed), /changed|pilot\/assets/);
  }
});

test('C1: a screen background shared by two steps is one asset bound at two slots, left empty in the tree', () => {
  const output = exportDesign(artworkExports(root, plan.artwork_exports), 'halloween-monster').designs[0], design = JSON.parse(output.json);
  assert.equal(design.assets.length, 1);
  assert.deepEqual(design.image_bindings, [0, 1].map(step => ({ slot: `tree/steps/${step}/content/tokens/bg-image`, asset_id: design.assets[0].id })));
  assert.deepEqual(design.tree.steps.map(step => step.content.tokens['bg-image']), ['none', 'none']);
  assert.equal(output.entry.facets.has_image, true, 'An empty slot bound to a picture is still a picture');
  assert.doesNotMatch(output.json, /data:image/);
});

test('C6: an SVG background with a reviewed derivative exports the PNG, premium in a Pro design', () => {
  const output = exportDesign(artworkExports(root, plan.artwork_exports), 'halloween-countdown').designs[0], design = JSON.parse(output.json);
  assert.deepEqual(design.image_bindings, [{ slot: 'tree/steps/0/content/children/0/children/0/children/0/tokens/bg-image', asset_id: design.assets[0].id }]);
  assert.deepEqual([design.assets[0].mime, design.assets[0].width, design.assets[0].access], ['image/png', 256, 'premium']);
  assert.deepEqual(Buffer.from(output.media[0].base64, 'base64'), readFileSync(resolve(root, 'tools/design-library/pilot/assets/halloween-pumpkin.png')));
});

test('C7, C8 and C9: an unreviewed SVG, a missing rights record and a premium picture in a Free design are held with their reasons', () => {
  assert.match(exportDesign({}, 'halloween-countdown').failures[0].reason, /SVG conversion needs a new review/);
  const sources = artworkExports(root, plan.artwork_exports), asset = JSON.parse(exportDesign(sources, 'halloween-monster').designs[0].json).assets[0];
  const unrecorded = Object.fromEntries(Object.entries(plan.image_rights).filter(([sha256]) => sha256 !== asset.sha256));
  assert.match(exportDesign(sources, 'halloween-monster', unrecorded).failures[0].reason, /original, ai-generated or licensed/);
  assert.match(exportDesign(sources, 'halloween-monster', { ...plan.image_rights, [asset.sha256]: { ...plan.image_rights[asset.sha256], access: 'premium' } }).failures[0].reason, /Free design cannot use a premium image/);
});

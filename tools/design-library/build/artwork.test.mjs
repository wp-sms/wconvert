import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { artworkExports } from './artwork.mjs';

const root = resolve(import.meta.dirname, '../../..');
const plan = JSON.parse(readFileSync(resolve(root, 'tools/design-library/publishing/catalog.json')));
const onlyIllustrated = { ...plan, packs: plan.packs.filter(pack => pack.id === 'homeware-care') };
const exportPack = sources => JSON.parse(execFileSync('php', [resolve(import.meta.dirname, 'export-packs.php')], {
  input: JSON.stringify({ ...onlyIllustrated, raster_sources: sources }), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
}));

test('reviewed derivative exports the real illustrated pack without embedding raster bytes in the bundled template', () => {
  const sources = artworkExports(root, plan.artwork_exports);
  const output = exportPack(sources)[0], pack = JSON.parse(output.json);
  assert.equal(pack.schema, 2);
  assert.equal(pack.assets.length, 1);
  assert.equal(pack.assets[0].width, 1920);
  assert.equal(pack.assets[0].height, 500);
  assert.deepEqual(Buffer.from(output.media[0].base64, 'base64'), readFileSync(resolve(root, Object.values(plan.artwork_exports)[0].path)));
  assert.equal(pack.image_bindings[0].template_id, 'product-shelf');
  assert.doesNotMatch(output.json, /data:image/);
  assert.match(readFileSync(resolve(root, 'resources/templates/library/product-shelf.json'), 'utf8'), /data:image\/svg/);
  assert.throws(() => exportPack({ ['0'.repeat(64)]: Object.values(sources)[0] }), /SVG conversion needs a new review/);
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

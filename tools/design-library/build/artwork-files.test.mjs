import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';
import { artworkReferences, inlineArtwork } from './artwork-files.mjs';
import { extractArtwork } from './extract-artwork.mjs';
import { exportObjects } from './catalogue.mjs';
import { fileURLToPath } from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

/** A real 4×4 RGBA PNG, as an author pastes one. */
function png() {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])));
    return Buffer.concat([length, Buffer.from(type), data, crc]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(4, 0); header.writeUInt32BE(4, 4); header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.concat(Array.from({ length: 4 }, (_, y) => Buffer.from([0, ...Array.from({ length: 4 }, (_, x) => (x + y) % 2 ? [20, 40, 160, 255] : [250, 240, 200, 128]).flat()])));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

function plugin(t) {
  const root = mkdtempSync(join(tmpdir(), 'wconvert-artwork-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['resources/templates/library', 'resources/template-artwork', 'pro/resources/template-artwork', 'tools/design-library/publishing']) mkdirSync(join(root, dir), { recursive: true });
  return root;
}

test('a reference is written back as the bytes it names, its url() kept', t => {
  const root = plugin(t);
  const bytes = Buffer.from('reviewed bytes'), name = `${sha(bytes)}.webp`;
  writeFileSync(join(root, 'resources/template-artwork', name), bytes);
  const design = { tree: { steps: [{ content: { type: 'image', src: `artwork:${name}`, tokens: { 'bg-image': `url("artwork:${name}")` } } }] }, tokens: { font: 'artwork: not a reference' } };
  const inlined = inlineArtwork(design, root);
  const uri = `data:image/webp;base64,${bytes.toString('base64')}`;
  assert.equal(inlined.tree.steps[0].content.src, uri);
  assert.equal(inlined.tree.steps[0].content.tokens['bg-image'], `url("${uri}")`);
  assert.equal(inlined.tokens.font, 'artwork: not a reference');
  assert.deepEqual(artworkReferences(design), [`artwork:${name}`]);
});

test('a missing or altered file is refused, never drawn', t => {
  const root = plugin(t);
  const name = `${sha(Buffer.from('reviewed'))}.webp`;
  assert.throws(() => inlineArtwork({ src: `artwork:${name}` }, root), /missing/);
  writeFileSync(join(root, 'resources/template-artwork', name), 'different');
  assert.throws(() => inlineArtwork({ src: `artwork:${name}` }, root), /altered/);
});

test('extraction stores a photo once, moves its rights and deletes what nothing names', t => {
  try { execFileSync('cwebp', ['-version'], { stdio: 'ignore' }); } catch { t.skip('cwebp is not installed'); return; }
  const root = plugin(t);
  const source = png();
  const uri = `data:image/png;base64,${source.toString('base64')}`;
  writeFileSync(join(root, 'resources/templates/library/card.json'), JSON.stringify({ id: 'card', tier: 'free', tree: { steps: [{ content: { type: 'image', src: uri, tokens: { 'bg-image': `url("${uri}")` } } }] } }, null, 2));
  writeFileSync(join(root, 'resources/template-artwork', `${'0'.repeat(64)}.jpg`), 'stale');
  const record = { kind: 'original', source: 'test', redistribution: true, reviewedBy: 'test', access: 'free' };
  writeFileSync(join(root, 'tools/design-library/publishing/catalog.json'), JSON.stringify({ schema: 3, image_rights: { [sha(source)]: record } }));

  const result = extractArtwork(root);

  const design = JSON.parse(readFileSync(join(root, 'resources/templates/library/card.json'), 'utf8'));
  const [reference] = artworkReferences(design);
  const name = reference.slice('artwork:'.length);
  assert.match(reference, /^artwork:[a-f0-9]{64}\.webp$/);
  assert.equal(design.tree.steps[0].content.tokens['bg-image'], `url("${reference}")`);
  assert.equal(sha(readFileSync(join(root, 'resources/template-artwork', name))), name.slice(0, 64));
  assert.equal(existsSync(join(root, 'resources/template-artwork', `${'0'.repeat(64)}.jpg`)), false);
  const rights = JSON.parse(readFileSync(join(root, 'tools/design-library/publishing/catalog.json'), 'utf8')).image_rights;
  assert.deepEqual(rights, { [name.slice(0, 64)]: record });
  assert.equal(result.converted.length, 1);
  assert.equal(extractArtwork(root).rewritten.length, 0, 'A second run changes nothing');
});

test('the exporter sends a bundled photo as its own asset, from the file its ZIP ships, Free and Pro', () => {
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const catalog = JSON.parse(readFileSync(join(root, 'tools/design-library/publishing/catalog.json'), 'utf8'));
  const exported = exportObjects(root, root, { designs: [{ id: 'citrus-sunrise', revision: 1 }, { id: 'polaroid', revision: 1 }], setups: [], raster_sources: {}, image_rights: catalog.image_rights });
  assert.deepEqual(exported.failures ?? [], []);
  for (const [id, folder] of [['citrus-sunrise', 'resources/template-artwork'], ['polaroid', 'pro/resources/template-artwork']]) {
    const design = exported.designs.find(item => item.id === id);
    const [name] = artworkReferences(JSON.parse(readFileSync(join(root, folder === 'resources/template-artwork' ? 'resources/templates/library' : 'pro/modules/display-types/templates', `${id}.json`), 'utf8')));
    const file = readFileSync(join(root, folder, name.slice('artwork:'.length)));
    assert.equal(design.media.length, 1, id);
    assert.equal(sha(Buffer.from(design.media[0].base64, 'base64')), sha(file), `${id} carries the file's exact bytes`);
    assert.doesNotMatch(design.json, /artwork:|data:image/, `${id}'s object leaves its picture slot empty`);
  }
});

test('a picture cwebp cannot read stops the run before anything is written', t => {
  const root = plugin(t);
  const path = join(root, 'resources/templates/library/card.json');
  const text = JSON.stringify({ id: 'card', tier: 'free', tree: { steps: [{ content: { type: 'image', src: `data:image/png;base64,${png().toString('base64')}` } }, { content: { type: 'image', src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' } }] } });
  writeFileSync(path, text);
  writeFileSync(join(root, 'tools/design-library/publishing/catalog.json'), JSON.stringify({ schema: 3, image_rights: {} }));
  try { execFileSync('cwebp', ['-version'], { stdio: 'ignore' }); } catch { t.skip('cwebp is not installed'); return; }
  assert.throws(() => extractArtwork(root), /re-save its GIF picture/);
  assert.equal(readFileSync(path, 'utf8'), text);
  assert.deepEqual(readdirSync(join(root, 'resources/template-artwork')), []);
});

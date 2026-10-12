import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { artworkExports } from './artwork.mjs';
import { buildRelease } from './publisher.mjs';

test('the real export plan validates paid basket rules and illustrated previews without WordPress', t => {
  const root = resolve(import.meta.dirname, '../../..');
  const plan = JSON.parse(readFileSync(resolve(root, 'tools/design-library/publishing/catalog.json')));
  const php = input => execFileSync('php', [resolve(import.meta.dirname, 'export-packs.php')], { input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const packs = JSON.parse(php({ ...plan, raster_sources: artworkExports(root, plan.artwork_exports) }));
  assert.equal(packs.find(p => JSON.parse(p.json).id === 'shopping-help').access, 'premium');
  assert.ok(packs.some(p => p.media.length));
  const release = buildRelease({ origin: 'https://templates.example', packs: packs.map(p => ({ ...p, media: p.media.map(m => ({ ...m, bytes: Buffer.from(m.base64, 'base64') })) })), collections: [] });
  const responses = Object.fromEntries(release.objects.map(o => [`https://templates.example/${o.scope === 'private' ? o.key.replace('packs/', 'downloads/') : o.key}`, o.bytes.toString(o.key.startsWith('assets/') ? 'base64' : 'utf8')]));
  responses['https://templates.example/manifest.json'] = release.manifest;
  const directory = mkdtempSync(join(tmpdir(), 'wconvert-export-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  assert.match(php({ mode: 'validate', packs, responses, source: 'https://templates.example/manifest.json', empty_directory: directory }), /Validated by the shipping catalog/);
});

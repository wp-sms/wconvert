import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogue } from './fixtures.mjs';
import { releaseClosure } from '../scripts/storage.mjs';

const read = library => async (scope, key) => (scope === 'public' ? library.public : library.private).get(key);

test('a design carries at most the 16 images the plugin reads (VerifiedAssets::MAX_ASSETS)', async () => {
  const sixteen = catalogue({ designs: [{ id: 'gallery-wall', images: Array(16).fill('free') }] });
  await releaseClosure(sixteen.id, read(sixteen));
  const seventeen = catalogue({ designs: [{ id: 'gallery-wall', images: Array(17).fill('free') }] });
  await assert.rejects(releaseClosure(seventeen.id, read(seventeen)), /Invalid image list: gallery-wall/);
});

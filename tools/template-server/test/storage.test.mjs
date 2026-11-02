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

test('a language\'s word files are part of a release, so a missing or damaged one is refused', async () => {
  const words = { de_DE: [{ schema: 3, words: { Hello: 'Hallo' } }, { schema: 3, words: { Thanks: 'Danke' } }] };
  const whole = catalogue({ words });
  const { objects } = await releaseClosure(whole.id, read(whole));
  const file = [...whole.public.keys()].filter(key => key.startsWith('v3/index/') && JSON.parse(whole.public.get(key)).words);
  assert.equal(file.length, 2);
  for (const key of file) assert.ok(objects.has(`public/${key}`), 'verified, and so backed up');

  const missing = catalogue({ words });
  missing.public.delete(file[0]);
  await assert.rejects(releaseClosure(missing.id, read(missing)), /Missing or changed dependency|exceeds its budget/);

  const wrong = catalogue({ words: { de_DE: [{ schema: 3, designs: {} }] } });
  await assert.rejects(releaseClosure(wrong.id, read(wrong)), /Invalid word list/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { put, slots, withPictures } from './design-images.mjs';

const root = resolve(import.meta.dirname, '../../..');
const picture = 'data:image/png;base64,iVBORw0KGgo=';
// Every kind of slot, an empty one of each, and a gradient that is no slot.
const design = {
  tree: { steps: [
    { id: 's1', content: { type: 'stack', tokens: { 'bg-image': `url("${picture}")` }, narrow: { 'bg-image': 'none' }, children: [
      { type: 'image', id: 'n1', src: picture, alt: '' },
      { type: 'image', id: 'n2', src: '', alt: '' },
      { type: 'panel', tokens: { 'bg-image': 'linear-gradient(#000, #fff)' }, children: [] },
    ] } },
    { id: 's2', content: { type: 'split', start: [{ type: 'panel', narrow: { 'bg-image': `url('${picture}')` }, children: [] }], end: [] } },
  ] },
  tokens: { 'bg-image': '', bg: '#fff' },
};

test('the JavaScript slots are the PHP slots, on one fixture', () => {
  const php = JSON.parse(execFileSync('php', ['-r', `define('ABSPATH', '/'); function __($text, $domain = '') { return $text; } require ${JSON.stringify(resolve(root, 'vendor/autoload.php'))};
    echo json_encode(WConvert\\Template\\Transfer\\DesignImages::slots(json_decode(stream_get_contents(STDIN), true)), JSON_UNESCAPED_SLASHES);`], { input: JSON.stringify(design), encoding: 'utf8' }));
  assert.deepEqual(slots(design), php);
  assert.deepEqual(Object.keys(php).sort(), [
    'tokens/bg-image',
    'tree/steps/0/content/children/0/src',
    'tree/steps/0/content/children/1/src',
    'tree/steps/0/content/narrow/bg-image',
    'tree/steps/0/content/tokens/bg-image',
    'tree/steps/1/content/start/0/narrow/bg-image',
  ], 'C5: a gradient stays a token');
});

test('put writes one slot in place', () => {
  const copy = structuredClone(design);
  put(copy, slots(copy)['tree/steps/1/content/start/0/narrow/bg-image'].path, 'none');
  assert.equal(copy.tree.steps[1].content.start[0].narrow['bg-image'], 'none');
});

test('withPictures writes each bound picture into its empty slot, as an installed site shows it', () => {
  const object = { id: 'monster', assets: [{ id: 'a', mime: 'image/png' }], tokens: { 'bg-image': 'none' },
    tree: { steps: [{ content: { type: 'stack', children: [{ type: 'image', src: '' }] } }] },
    image_bindings: [{ slot: 'tokens/bg-image', asset_id: 'a' }, { slot: 'tree/steps/0/content/children/0/src', asset_id: 'a' }] };
  const bound = withPictures(object, [{ id: 'a', bytes: Buffer.from('png') }]);
  assert.equal(bound.tokens['bg-image'], 'url("data:image/png;base64,cG5n")');
  assert.equal(bound.tree.steps[0].content.children[0].src, 'data:image/png;base64,cG5n');
  assert.equal(object.tokens['bg-image'], 'none', 'The exported object is left as it is');
  assert.throws(() => withPictures({ ...object, image_bindings: [{ slot: 'tokens/missing', asset_id: 'a' }] }, [{ id: 'a', bytes: Buffer.from('png') }]), /Unbound picture/);
});

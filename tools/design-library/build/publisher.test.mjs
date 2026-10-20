import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRelease, buildPointer, publishRelease, guardDrops, sha256, LIMITS } from './publisher.mjs';

const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=', 'base64');
const rights = { redistribution: true, kind: 'original', source: 'Original test pixel', reviewedBy: 'test' };
function design(id, { tier = 'free', revision = 1, access, name = id } = {}) {
  const assets = access ? [{ id: 'pixel', sha256: sha256(image), mime: 'image/png', bytes: image.length, width: 1, height: 1, access }] : [];
  const object = { schema: 3, minor: 0, id, revision, name, display_type: tier === 'free' ? 'popup' : 'slide_in', tier,
    requires: { plugin: '1.0.0', tree: 2, capabilities: ['capture-journey:1', 'template-tree:2'] }, assets, tree: { v: 2, steps: [] }, tokens: {} };
  return { id, revision, tier, json: JSON.stringify(object), media: access ? [{ id: 'pixel', bytes: image, rights }] : [],
    entry: { id, revision, name, format: object.display_type, tier, requires: { plugin: '1.0.0' }, tags: [], facets: { act: 'submit', captures: ['email'], shape: 'stack' } } };
}
function setup(id, pinned, tier = 'free') {
  const object = { schema: 3, minor: 0, id, revision: 1, name: id, tier, design: { id: pinned.id, revision: pinned.revision }, requires: { plugin: '1.0.0', capabilities: ['campaign-starts:1'] }, playbook: { goal: 'grow_email_list' } };
  return { id, revision: 1, tier, json: JSON.stringify(object), entry: { id, revision: 1, name: id, goal: 'grow_email_list', tier, design: object.design, requires: object.requires } };
}

test('free objects are public, premium objects private, and every object is named by its bytes', () => {
  const free = design('free-card', { access: 'free' }), pro = design('pro-slide', { tier: 'pro', access: 'premium' });
  const release = buildRelease({ designs: [free, pro], setups: [setup('start', free), setup('pro-start', pro, 'pro')] });
  const find = (scope, prefix) => release.objects.filter(object => object.scope === scope && object.key.startsWith(prefix));
  assert.equal(find('public', 'v3/designs/').length, 1);
  assert.equal(find('private', 'v3/designs/').length, 1);
  assert.equal(find('private', 'v3/setups/').length, 1);
  assert.equal(find('public', 'v3/assets/').length, 1, 'The free image is public');
  assert.equal(find('private', 'v3/assets/').length, 1, 'The premium image is private');
  for (const object of release.objects) if (!object.key.includes('@2x')) assert.ok(object.key.includes(object.sha256) || object.key === 'v3/manifest.json', object.key);
  const pointer = JSON.parse(release.pointer);
  assert.deepEqual(pointer, { schema: 3, minor: 0, release: release.id, withdrawn: [] });
  const page = JSON.parse(release.objects.find(object => object.key.startsWith('v3/index/')).bytes);
  assert.deepEqual(page.designs.map(entry => entry.id), ['free-card', 'pro-slide']);
  assert.equal(page.designs[0].sha256, sha256(Buffer.from(free.json)));
});

test('a Free design cannot carry a premium image, and every image needs a rights record of a known kind', () => {
  assert.throws(() => buildRelease({ designs: [design('leaky', { access: 'premium' })] }), /cannot use a premium image/);
  const unknown = design('unrecorded', { access: 'free' });
  unknown.media[0].rights = { ...rights, kind: 'found-online' };
  assert.throws(() => buildRelease({ designs: [unknown] }), /rights record/);
});

test('a setup must pin a design revision the release carries', () => {
  const card = design('card');
  assert.throws(() => buildRelease({ designs: [card], setups: [setup('start', { id: 'card', revision: 2 })] }), /pins a design revision/);
  assert.throws(() => buildRelease({ designs: [design('pro', { tier: 'pro' })], setups: [setup('start', { id: 'pro', revision: 1 })] }), /Free setup cannot pin a Pro design/);
});

test('a 2,000-design release fits the reader budget', () => {
  const designs = Array.from({ length: 2000 }, (_, i) => {
    const row = design(`design-${String(i).padStart(4, '0')}`, { name: `A design for stress number ${i}` });
    Object.assign(row.entry, { family: `family-${Math.floor(i / 5)}`, tags: ['industry:food-drink', 'occasion:evergreen', 'style:minimal', 'colour:warm'], thumb: sha256(String(i)) });
    return row;
  });
  const release = buildRelease({ designs });
  const pages = JSON.parse(release.objects.find(object => object.key === `v3/releases/${release.id}.json`).bytes).pages;
  const bytes = pages.reduce((sum, sha) => sum + release.objects.find(object => object.key === `v3/index/${sha}.json`).bytes.length, 0);
  assert.ok(pages.length <= LIMITS.pages && bytes <= LIMITS.index, `${bytes} bytes in ${pages.length} pages`);
  for (const sha of pages) assert.ok(release.objects.find(object => object.key === `v3/index/${sha}.json`).bytes.length <= LIMITS.object);
  assert.throws(() => buildRelease({ designs: Array.from({ length: 4500 }, (_, i) => design(`d-${i}`, { name: 'x'.repeat(100) })) }), /reader's budget/);
});

test('a release may not drop a live design unless it withdraws it', () => {
  assert.throws(() => guardDrops(new Set(['a', 'b']), new Set(['a']), []), /drops live designs without withdrawing them: b/);
  assert.doesNotThrow(() => guardDrops(new Set(['a', 'b']), new Set(['a']), [{ id: 'b', reason: 'rights' }]));
  assert.throws(() => guardDrops(new Set(['a', 'b']), new Set(['a']), [{ id: 'b', revision: 1, reason: 'rights' }]), /b/, 'Withdrawing one revision does not drop the design');
  assert.throws(() => buildPointer({ release: '0'.repeat(64), withdrawn: [{ id: 'b', reason: 'shrug' }] }), /Invalid withdrawal/);
});

test('local publication reuses immutable objects, guards drops, and swaps only the pointer', t => {
  const directory = mkdtempSync(join(tmpdir(), 'wconvert-v3-publish-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const first = buildRelease({ designs: [design('a', { access: 'free' }), design('b', { tier: 'pro', access: 'premium' })] });
  assert.equal(publishRelease(directory, first, null).created, first.objects.length);
  assert.equal(statSync(join(directory, 'private')).mode & 0o777, 0o700);
  assert.ok(existsSync(join(directory, 'private/v3/designs', sha256(Buffer.from(design('b', { tier: 'pro', access: 'premium' }).json)) + '.json')));
  assert.equal(publishRelease(directory, first, first.id).created, 0, 'Same release, nothing written');
  assert.throws(() => publishRelease(directory, first, null), /Current release changed/);
  const dropped = buildRelease({ designs: [design('a', { access: 'free' })] });
  assert.throws(() => publishRelease(directory, dropped, first.id), /drops live designs/);
  const withdrawn = buildRelease({ designs: [design('a', { access: 'free' })], withdrawn: [{ id: 'b', reason: 'quality' }] });
  publishRelease(directory, withdrawn, first.id);
  assert.equal(JSON.parse(readFileSync(join(directory, 'public/v3/manifest.json'))).release, withdrawn.id);
  assert.ok(existsSync(join(directory, 'public/v3/releases', first.id + '.json')), 'The previous release stays for rollback');
});

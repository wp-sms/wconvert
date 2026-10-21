import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { refuseStranded } from './catalogue-revisions.mjs';
import { checkRuntimeCollections, collectionLabels } from './collections.mjs';
import { delivery, releaseCollections, staleApprovals } from './delivery.mjs';
import { setupIds } from './sources.mjs';

const approved = { decision: 'approved' };
const row = (id, state, record = approved) => ({ id, state, record });
const entry = (id, template_id) => ({ id, template_id });
const exported = (setups, failures = []) => ({ setups: setups.map(id => ({ id })), failures });
// The exporter's own words for each reason a design stays bundled.
const CAUSES = {
  svg: 'Artwork must be reviewed PNG, JPEG or WebP source bytes. SVG conversion needs a new review.',
  link: 'Pack links and pictures must be supplied by the site owner.',
  setting: 'Update required: this design uses an unknown setting.',
  consent: 'Pack consent must start hidden.',
  rights: 'Record the image kind (original, ai-generated or licensed), source, redistribution rights and reviewer before export.',
};

test('B1: an approved setup that exports is published with no list to edit', () => {
  const online = delivery({ entries: [entry('new-welcome', 'new-card')], queue: [row('new-welcome', 'approved')], exported: exported(['new-welcome']) });
  assert.deepEqual(online.published, ['new-welcome']);
  assert.deepEqual(online.held, []);
});

test('B2: an approved setup whose design cannot export is held with the exporter\'s own reason', () => {
  const causes = Object.entries(CAUSES);
  const online = delivery({
    entries: causes.map(([cause]) => entry(`setup-${cause}`, `design-${cause}`)),
    queue: causes.map(([cause]) => row(`setup-${cause}`, 'approved')),
    exported: exported([], causes.flatMap(([cause, reason]) => [{ kind: 'design', id: `design-${cause}`, reason },
      { kind: 'setup', id: `setup-${cause}`, reason: `Its design design-${cause} is not exported in this release.` }])),
  });
  assert.deepEqual(online.published, []);
  assert.deepEqual(online.held, causes.map(([cause, reason]) => ({ setup: `setup-${cause}`, design: `design-${cause}`, reason: `Design design-${cause}: ${reason}` })));
});

test('a setup that fails on its own is held with its own reason', () => {
  const online = delivery({ entries: [entry('offer', 'card')], queue: [row('offer', 'approved')], exported: exported([], [{ kind: 'setup', id: 'offer', reason: 'Invalid rule.' }]) });
  assert.deepEqual(online.held, [{ setup: 'offer', design: 'card', reason: 'Invalid rule.' }]);
});

test('B3 and A4: only a stale approval refuses the release; one never approved is simply not published', () => {
  const queue = [row('was-live', 'stale'), row('sent-back', 'stale', { decision: 'revise' }), row('new', 'review', null), row('fixing', 'revise', { decision: 'revise' })];
  assert.deepEqual(staleApprovals(queue).map(item => item.id), ['was-live']);
  const online = delivery({ entries: queue.map(item => entry(item.id, 'card')), queue, exported: exported(queue.map(item => item.id)) });
  assert.deepEqual([...online.published, ...online.held], [], 'Without the refusal, was-live would drop off the website silently');
});

test('B5 and B6: withdrawal is never undone by derivation, and design-only publications stay', () => {
  const queue = [row('gone-setup', 'approved'), row('gone-design-setup', 'approved'), row('live', 'approved')];
  const online = delivery({
    entries: [entry('gone-setup', 'card'), entry('gone-design-setup', 'retired-card'), entry('live', 'card')], queue,
    exported: exported(['gone-setup', 'gone-design-setup', 'live']),
    designs: ['ribbon-tag', 'retired-card'], withdrawn: [{ id: 'gone-setup', reason: 'quality' }, { id: 'retired-card', reason: 'rights' }, { id: 'live', revision: 1, reason: 'broken' }],
  });
  assert.deepEqual(online.published, ['live'], 'A withdrawal of one revision is the pointer\'s, not a reason to stop publishing');
  assert.deepEqual(online.designs, ['ribbon-tag']);
});

test('B7 and B8: a published Collection lists a held member as bundled-only; an unapproved one is left out', () => {
  const compiled = [
    { id: 'sale', status: 'published', revision: 'r', name: 'Sale', description: 'd', cover: 'sale', priority: 1, business_types: [], markets: [],
      items: [{ setup_id: 'live', stage: 'before' }, { setup_id: 'svg-poster', stage: 'during' }, { setup_id: 'unreviewed', stage: 'after' }] },
    { id: 'draft', status: 'draft', items: [] },
  ];
  const online = delivery({
    entries: [entry('live', 'card'), entry('svg-poster', 'poster'), entry('unreviewed', 'card')],
    queue: [row('live', 'approved'), row('svg-poster', 'approved'), row('unreviewed', 'review', null)],
    exported: exported(['live', 'unreviewed'], [{ kind: 'design', id: 'poster', reason: CAUSES.svg }]), compiled,
  });
  assert.deepEqual(online.collections, ['sale']);
  assert.deepEqual(releaseCollections(compiled, online)[0].items,
    [{ setup: 'live', stage: 'before' }, { design: 'poster', stage: 'during', bundled_only: true }]);
});

test('B8: a Collection never approved ships nowhere and blocks nothing; one that shipped and went stale is refused', t => {
  const root = mkdtempSync(join(tmpdir(), 'wconvert-delivery-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'resources/collections'), { recursive: true });
  const live = { id: 'live', name: 'Live', description: 'Shown.', status: 'published' };
  writeFileSync(join(root, 'resources/collections/live.json'), JSON.stringify(live, null, 2) + '\n');
  writeFileSync(join(root, 'resources/collections/labels.php'), collectionLabels([live]));
  checkRuntimeCollections(root, [live, { id: 'draft', name: 'Draft', description: 'Not yet.', status: 'draft' }]);
  assert.throws(() => checkRuntimeCollections(root, [{ ...live, status: 'draft' }]), /missing or stale: live/);
  assert.ok(existsSync(join(root, 'resources/collections/live.json')));
  assert.equal(readFileSync(join(root, 'resources/collections/labels.php'), 'utf8'), collectionLabels([live]));
});

test('B4: every authored setup is numbered, so one removed from the repository is retired', t => {
  const root = mkdtempSync(join(tmpdir(), 'wconvert-setups-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of ['resources/playbooks/free-one.php', 'pro/modules/display-types/playbooks/pro-one.php', 'tools/design-library/hosted/playbooks/hosted-one.php']) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), '<?php return [];');
  }
  assert.deepEqual(setupIds(root), ['free-one', 'hosted-one', 'pro-one']);
});

test('B9: a hosted design that cannot export is still a hard error', () => {
  const authored = new Map([['on-server', { ships: 'hosted' }], ['in-zip', { ships: 'free' }]]);
  assert.doesNotThrow(() => refuseStranded(authored, [{ kind: 'design', id: 'in-zip', reason: CAUSES.svg }]));
  assert.throws(() => refuseStranded(authored, [{ kind: 'design', id: 'on-server', reason: CAUSES.svg }]), /Hosted designs cannot be exported:\n {2}on-server/);
});

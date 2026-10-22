import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCollection } from './collections.mjs';
const collection = { id: 'sale', name: 'Sale', description: 'Sale ideas', cover: 'sale', priority: 1, business_types: ['stores'], markets: [], items: [{ setup_id: 'offer', setup_hash: 'a'.repeat(64), design_hash: 'b'.repeat(64), stage: 'during' }], event: { family: 'black-friday', start: '2026-11-27', end_exclusive: '2026-12-01', feature_start: '2026-10-16', feature_end_exclusive: '2026-12-01' } };
test('exclusive calendar endpoints include all four sale days', () => assert.doesNotThrow(() => validateCollection(collection)));
test('duplicate membership and invalid calendar dates fail before publication', () => {
  assert.throws(() => validateCollection({ ...collection, items: [collection.items[0], collection.items[0]] }));
  assert.throws(() => validateCollection({ ...collection, event: { ...collection.event, start: '2026-02-30' } }));
  assert.throws(() => validateCollection({ ...collection, event: { ...collection.event, feature_start: '2026-11-28' } }));
});

test('runtime publication refuses stale reviews and changed shipped metadata', async () => {
  const { checkRuntimeCollections, collectionLabels } = await import('./collections.mjs');
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = mkdtempSync(join(tmpdir(), 'wconvert-collections-'));
  try {
    mkdirSync(join(root, 'resources/collections'), { recursive: true });
    const reviewed = { ...collection, status: 'published', revision: 'c'.repeat(64) };
    const file = join(root, 'resources/collections/sale.json');
    writeFileSync(join(root, 'resources/collections/labels.php'), collectionLabels([reviewed]));
    writeFileSync(file, JSON.stringify(reviewed, null, 2) + '\n');
    assert.doesNotThrow(() => checkRuntimeCollections(root, [reviewed]));
    assert.throws(() => checkRuntimeCollections(root, [{ ...reviewed, status: 'draft' }]), /stale/);
    writeFileSync(file, JSON.stringify({ ...reviewed, name: 'Unreviewed change' }, null, 2) + '\n');
    assert.throws(() => checkRuntimeCollections(root, [reviewed]), /reviewed revision/);
    writeFileSync(join(root, 'resources/collections/obsolete.json'), '{}');
    assert.throws(() => checkRuntimeCollections(root, [reviewed]), /Retire obsolete/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a Collection is carried only when every setup in it was carried and its decision was current', async () => {
  const { carryCollections, collectionRevision } = await import('./collections.mjs');
  const { createHash } = await import('node:crypto');
  const record = body => ({ ...body, record_id: createHash('sha256').update(JSON.stringify(body)).digest('hex') });
  const checks = { visual: { status: 'passed', evidence: [] }, journey: { status: 'passed', evidence: [] }, wordpress: { status: 'passed', evidence: [] } };
  const two = { ...collection, id: 'pair', items: [collection.items[0], { ...collection.items[0], setup_id: 'other' }] };
  const source = { collections: [collection, two] };
  const before = { offer: 'o'.repeat(64), other: 'p'.repeat(64) };
  // Each setup's revision under the base renderer, by identity scheme: old, then new.
  // `pair` was reviewed under the old scheme, so it is matched there.
  const previous = new Map([['offer', [before.offer, 'x'.repeat(64)]], ['other', ['y'.repeat(64), before.other]]]);
  const entries = [{ id: 'offer', revision: '1'.repeat(64) }, { id: 'other', revision: '2'.repeat(64) }];
  const store = { schema: 1, records: [
    record({ id: 'collection-sale', revision: collectionRevision(collection, [before.offer]), base_id: null, decision: 'approved', reviewer: 'A person', note: 'Looked', at: '2026-10-20T00:00:00Z', checks }),
    record({ id: 'collection-pair', revision: collectionRevision(two, [before.offer, 'y'.repeat(64)]), base_id: null, decision: 'approved', reviewer: 'A person', note: 'Looked', at: '2026-10-20T00:00:00Z', checks }),
  ] };
  const evidence = [{ path: 'docs/reviews/visual-diff/report.md', sha256: 'e'.repeat(64) }];
  const carried = carryCollections({ source, entries, store, carried: ['offer', 'other'], previous, at: '2026-10-21T00:00:00Z', evidence });
  assert.deepEqual(carried.map(item => item.id), ['collection-sale', 'collection-pair']);
  assert.equal(carried[0].revision, collectionRevision(collection, [entries[0].revision]));
  assert.equal(carried[0].base_id, store.records[0].record_id);
  assert.equal(carried[0].decision, 'approved');
  assert.deepEqual(carried[0].checks.visual.evidence, evidence);
  // A setup that changed and was NOT carried leaves its Collection for a person.
  assert.deepEqual(carryCollections({ source, entries, store, carried: ['offer'], previous, at: 'now' }).map(item => item.id), ['collection-sale']);
  // A decision that was already stale under the base renderer is never carried.
  const stale = { schema: 1, records: [record({ ...store.records[0], record_id: undefined, revision: 'f'.repeat(64) })] };
  assert.deepEqual(carryCollections({ source, entries, store: stale, carried: ['offer', 'other'], previous, at: 'now' }), []);
});

test('online-only collections publish every member without entering the bundled snapshot', async () => {
  const { bundledCollections, checkRuntimeCollections, collectionLabels } = await import('./collections.mjs');
  const { releaseCollections } = await import('./delivery.mjs');
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = mkdtempSync(join(tmpdir(), 'wconvert-online-collection-'));
  try {
    const online = { ...collection, catalogue_only: true, status: 'published', revision: 'c'.repeat(64) };
    validateCollection(online);
    assert.throws(() => validateCollection({ ...online, catalogue_only: 'true' }), /delivery/);
    assert.deepEqual(bundledCollections([online]), []);
    mkdirSync(join(root, 'resources/collections'), { recursive: true });
    writeFileSync(join(root, 'resources/collections/labels.php'), collectionLabels([]));
    checkRuntimeCollections(root, [online]);
    const released = releaseCollections([online], { published: ['offer'], held: [], collections: ['sale'] });
    assert.deepEqual(released[0].items, [{ setup: 'offer', stage: 'during' }]);
    assert.equal(released[0].catalogue_only, undefined, 'Delivery is editorial metadata, not a new client protocol');
    writeFileSync(join(root, 'resources/collections/sale.json'), JSON.stringify(online));
    assert.throws(() => checkRuntimeCollections(root, [online]), /Retire obsolete/, 'An accidental bundled copy is refused');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a stale approved online collection cannot silently disappear from a release', async () => {
  const { checkRuntimeCollections, collectionLabels } = await import('./collections.mjs');
  const { emptyReviews, writeReviews } = await import('./reviews.mjs');
  const { createHash } = await import('node:crypto');
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = mkdtempSync(join(tmpdir(), 'wconvert-stale-online-collection-'));
  try {
    mkdirSync(join(root, 'resources/collections'), { recursive: true });
    writeFileSync(join(root, 'resources/collections/labels.php'), collectionLabels([]));
    const body = { id: 'collection-sale', revision: 'c'.repeat(64), base_id: null, decision: 'approved', reviewer: 'Reviewer', note: 'Reviewed', at: '2026-10-22T00:00:00Z', checks: {} };
    const record = { ...body, record_id: createHash('sha256').update(JSON.stringify(body)).digest('hex') };
    writeReviews(root, emptyReviews(), { schema: 1, records: [record] });
    assert.throws(() => checkRuntimeCollections(root, [{ ...collection, catalogue_only: true, status: 'draft', revision: 'd'.repeat(64) }]), /missing or stale: sale/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

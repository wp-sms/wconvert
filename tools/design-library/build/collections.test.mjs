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

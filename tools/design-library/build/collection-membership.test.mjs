import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('Black Friday collection includes the published native Black Friday campaign batch', () => {
  const metadata = read('../publishing/designs.json');
  const source = read('../collections/source.json');
  const collection = source.collections.find(item => item.id === 'black-friday-cyber-monday-2026');
  const members = new Set(collection.items.map(item => item.setup_id));
  const campaigns = Object.entries(metadata.designs)
    .filter(([id, design]) => id.startsWith('campaign-') && design.occasions?.includes('black-friday'))
    .map(([id]) => id);
  assert.ok(campaigns.includes('campaign-black-friday-department'), 'The reported missing design is in the source inventory');
  assert.deepEqual(campaigns.filter(id => !members.has(id)), [], 'Published Black Friday campaign designs must be discoverable in the collection');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { designSources } from './sources.mjs';
import { bundledRevisionFiles } from './catalogue.mjs';

function tree(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'wconvert-sources-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, design] of Object.entries(files)) {
    const { id, tier } = typeof design === 'string' ? { id: design, tier: path.startsWith('pro/') ? 'pro' : 'free' } : design;
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), JSON.stringify({ id, tier, tree: { v: 2, steps: [] } }));
  }
  return root;
}

test('a hosted design is a catalogue design that neither ZIP lists as bundled', t => {
  const root = tree(t, {
    'resources/templates/library/in-free.json': 'in-free',
    'pro/modules/display-types/templates/in-pro.json': 'in-pro',
    'tools/design-library/hosted/templates/on-server.json': 'on-server',
  });

  assert.deepEqual([...designSources(root)].map(([id, source]) => [id, source.ships]).sort(),
    [['in-free', 'free'], ['in-pro', 'pro'], ['on-server', 'hosted']]);

  const registry = { designs: { 'in-free': { revision: 1 }, 'in-pro': { revision: 2 }, 'on-server': { revision: 3 } } };
  const files = Object.fromEntries(Object.entries(bundledRevisionFiles(root, registry)).map(([path, bytes]) => [path, JSON.parse(bytes).designs]));
  assert.deepEqual(files, {
    'resources/templates/revisions.json': { 'in-free': 1 },
    'pro/resources/templates/revisions.json': { 'in-pro': 2 },
  });
});

test('a design copied from the hosted folder into a bundled one is refused, not shipped', t => {
  const root = tree(t, {
    'resources/templates/library/on-server.json': 'on-server',
    'tools/design-library/hosted/templates/on-server.json': 'on-server',
  });

  assert.throws(() => designSources(root), /on-server is authored twice/);
});

test('a Pro design in the hosted folder is refused: the catalogue would serve it to Free sites for free', t => {
  const root = tree(t, { 'tools/design-library/hosted/templates/premium.json': { id: 'premium', tier: 'pro' } });

  assert.throws(() => designSources(root), /premium is hosted but not tier free/);
});

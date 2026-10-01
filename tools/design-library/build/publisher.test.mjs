import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRelease, publishRelease } from './publisher.mjs';
const pack = (id, access = 'free', version = '1.0.0') => ({ access, json: JSON.stringify({ schema: 1, id, name: id, description: 'A reviewed example', version, templates: [], playbooks: [] }) });
const directory = t => { const path = mkdtempSync(join(tmpdir(), 'wconvert-publisher-')); t.after(() => rmSync(path, { recursive: true, force: true })); return path; };
test('publishes complete immutable releases, separates premium bytes and reuses unchanged objects', t => {
  const root = directory(t);
  const input = { origin: 'https://templates.example', packs: [pack('reading'), pack('store', 'premium')], collections: [] };
  const release = buildRelease(input);
  const first = publishRelease(root, release, null);
  const manifest = JSON.parse(readFileSync(join(root, 'public/manifest.json')));
  assert.equal(manifest.release, release.id);
  assert.equal(first.created, release.objects.length);
  const premium = release.objects.find(item => item.scope === 'private');
  assert.ok(premium);
  assert.throws(() => readFileSync(join(root, 'public', premium.key)));
  const file = join(root, premium.scope, premium.key), before = statSync(file).mtimeMs;
  const repeat = publishRelease(root, buildRelease({ ...input, packs: [...input.packs].reverse() }), release.id);
  assert.equal(repeat.created, 0);
  assert.equal(statSync(file).mtimeMs, before);
  assert.equal(repeat.release, first.release);
});

test('an interrupted publication retains the previous manifest and can be retried', t => {
  const root = directory(t), base = { origin: 'https://templates.example', collections: [] };
  const first = buildRelease({ ...base, packs: [pack('reading')] }); publishRelease(root, first, null);
  const next = buildRelease({ ...base, packs: [pack('reading', 'free', '1.1.0')] });
  assert.throws(() => publishRelease(root, next, first.id, { beforeWrite(key) { if (key === 'manifest.json') throw new Error('Connection lost'); } }), /Connection lost/);
  assert.equal(JSON.parse(readFileSync(join(root, 'public/manifest.json'))).release, first.id);
  const retry = publishRelease(root, next, first.id);
  assert.equal(retry.created, 0);
  assert.equal(JSON.parse(readFileSync(join(root, 'public/manifest.json'))).release, next.id);
  assert.throws(() => publishRelease(root, first, first.id), /Current release changed/);
});

test('refuses a concurrent publisher, corrupt immutable objects and missing setup references', async t => {
  const { writeFileSync } = await import('node:fs');
  const root = directory(t), input = { origin: 'https://templates.example', packs: [pack('reading')], collections: [] };
  const release = buildRelease(input);
  writeFileSync(join(root, '.publish.lock'), 'occupied');
  assert.throws(() => publishRelease(root, release, null), /Another publication/);
  rmSync(join(root, '.publish.lock'));
  publishRelease(root, release, null);
  writeFileSync(join(root, release.objects[0].scope, release.objects[0].key), 'corrupt');
  assert.throws(() => publishRelease(root, release, release.id), /Immutable object/);
  assert.throws(() => buildRelease({ ...input, collections: [{ id: 'missing', items: [{ pack_id: 'reading', pack_digest: release.objects[0].sha256, setup_id: 'absent' }] }] }), /Missing or stale/);
});

test('changed pack bytes require a new version while unchanged packs are reused', t => {
  const root = directory(t), base = { origin: 'https://templates.example', collections: [] };
  const first = buildRelease({ ...base, packs: [pack('reading'), pack('store')] }); publishRelease(root, first, null);
  const edited = pack('reading'); const data = JSON.parse(edited.json); data.name = 'Edited'; edited.json = JSON.stringify(data);
  const candidate = buildRelease({ ...base, packs: [edited, pack('store')] });
  assert.throws(() => publishRelease(root, candidate, first.id), /version/);
  data.version = '1.0.1'; edited.json = JSON.stringify(data);
  const changed = buildRelease({ ...base, packs: [edited, pack('store')] });
  const result = publishRelease(root, changed, first.id);
  assert.equal(result.reused, 1);
});

import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, realpathSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { buildCollections, checkRuntimeCollections } from './collections.mjs';
import { reviewQueue } from './reviews.mjs';
import { publicPreview } from './public-preview.mjs';
import { buildRelease, publishRelease, sha256 } from './publisher.mjs';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const { values } = parseArgs({ options: { directory: { type: 'string' }, origin: { type: 'string' }, expected: { type: 'string' } } });
if (!values.directory || !values.origin || !values.expected) throw new Error('Usage: npm run templates:release:local -- --directory /private/local/storage --origin https://templates.example --expected none|<current-release>');
// R2 is not needed. This directory models separate public/private storage, so it
// must not live inside WordPress's public document root (including through symlinks).
mkdirSync(resolve(values.directory), { recursive: true, mode: 0o700 });
const directory = realpathSync(resolve(values.directory));
const wpRoot = resolve(root, '../../..');
if (existsSync(join(wpRoot, 'wp-load.php')) && (directory === wpRoot || directory.startsWith(wpRoot + sep))) throw new Error('Use a storage directory outside the WordPress public document root');
execFileSync('bash', [resolve(root, 'tools/design-library/build.sh'), 'renderer', 'pilot'], { cwd: root, stdio: 'inherit' });
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const plan = read('tools/design-library/publishing/catalog.json');
if (plan.schema !== 1) throw new Error('Unsupported publishing plan');
const entries = read('tools/design-library/out/pilot.json'), reviews = read('tools/design-library/review/shared-reviews.json');
const queue = reviewQueue(reviews, entries, root);
const source = read('tools/design-library/collections/source.json');
const { compiled } = buildCollections(root, source, entries, queue, reviews);
checkRuntimeCollections(root, compiled);
const selected = plan.packs.flatMap(pack => pack.setups);
if (new Set(selected).size !== selected.length) throw new Error('A setup is assigned to multiple delivery packs');
for (const id of selected) {
  if (!source.collections.some(collection => collection.items.some(item => item.setup_id === id)) || queue.find(row => row.id === id)?.state !== 'approved') throw new Error(`Missing current approval: ${id}`);
}
const php = (input) => execFileSync('php', [resolve(root, 'tools/design-library/build/export-packs.php')], { input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const renderer = readFileSync(resolve(root, 'tools/design-library/out/renderer.iife.js'), 'utf8');
const packs = JSON.parse(php(plan)).map(pack => {
  const media = pack.media.map(item => ({ ...item, bytes: Buffer.from(item.base64, 'base64') }));
  return { ...pack, media, preview: publicPreview(JSON.parse(pack.json), renderer, media) };
});
const references = new Map();
for (const { json } of packs) { const pack = JSON.parse(json); for (const setup of pack.playbooks) references.set(setup.id, { pack_id: pack.id, pack_digest: sha256(json), setup_id: setup.id }); }
const collections = plan.collections.map(id => {
  const collection = compiled.find(item => item.id === id);
  if (!collection || collection.status !== 'published') throw new Error(`Collection lacks current approval: ${id}`);
  const publicFields = Object.fromEntries(Object.entries(collection).filter(([key]) => !['dependencies_current', 'status'].includes(key)));
  return { ...publicFields, items: collection.items.map(item => {
    const reference = references.get(item.setup_id);
    if (!reference) throw new Error(`Collection needs a setup absent from this release: ${item.setup_id}`);
    return { ...reference, stage: item.stage };
  }) };
});
const release = buildRelease({ origin: values.origin, packs, collections });
const responses = Object.fromEntries(release.objects.map(object => [`${new URL(values.origin).origin}/${object.scope === 'private' ? object.key.replace('packs/', 'downloads/') : object.key}`, object.bytes.toString(object.key.startsWith('assets/') ? 'base64' : 'utf8')]));
responses[`${new URL(values.origin).origin}/manifest.json`] = release.manifest;
const empty = mkdtempSync(join(tmpdir(), 'wconvert-release-validation-'));
try { process.stdout.write(php({ mode: 'validate', packs: packs.map(({ json, access }) => ({ json, access })), responses, source: `${new URL(values.origin).origin}/manifest.json`, empty_directory: empty })); }
finally { rmSync(empty, { recursive: true, force: true }); }
const result = publishRelease(directory, release, values.expected === 'none' ? null : values.expected);
console.log(JSON.stringify({ ...result, directory, packs: packs.length, setups: selected.length, collections: collections.length, deferred: plan.deferred, hosted: false }, null, 2));

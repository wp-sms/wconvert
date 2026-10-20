import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, realpathSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { buildCollections, checkRuntimeCollections } from './collections.mjs';
import { reviewQueue } from './reviews.mjs';
import { galleryArtwork } from './design-gallery.mjs';
import { buildRelease, publishRelease } from './publisher.mjs';
import { computeRevisions } from './catalogue-revisions.mjs';
import { readJson } from './catalogue.mjs';
import { literalColourReport } from './catalogue-lint.mjs';

/**
 * Build a catalogue v3 release from reviewed repository sources into a local
 * storage directory (docs/template-discovery-api.md). No network, R2 or
 * credentials: `npm run publish` in tools/template-server moves it to the
 * hosted service.
 */
const implementationRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const { values } = parseArgs({ options: { directory: { type: 'string' }, origin: { type: 'string' }, expected: { type: 'string' }, 'source-directory': { type: 'string' } } });
const root = values['source-directory'] ? realpathSync(resolve(values['source-directory'])) : implementationRoot;
if (!values.directory || !values.origin || !values.expected) throw new Error('Usage: npm run templates:release:local -- --directory /private/local/storage --origin https://templates.example --expected none|<current-release>');
// R2 is not needed. This directory models separate public/private storage, so it
// must not live inside WordPress's public document root (including through symlinks).
mkdirSync(resolve(values.directory), { recursive: true, mode: 0o700 });
const directory = realpathSync(resolve(values.directory));
const wpRoot = resolve(implementationRoot, '../../..');
if (existsSync(join(wpRoot, 'wp-load.php')) && (directory === wpRoot || directory.startsWith(wpRoot + sep))) throw new Error('Use a storage directory outside the WordPress public document root');
const origin = new URL(values.origin);
if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username) throw new Error('Use an HTTPS service origin without a path or credentials');

execFileSync('bash', [resolve(root, 'tools/design-library/build.sh'), 'renderer', 'pilot'], { cwd: root, stdio: 'inherit' });
const plan = readJson(root, 'tools/design-library/publishing/catalog.json');
if (plan.schema !== 2) throw new Error('Unsupported delivery plan');
const metadata = readJson(root, 'tools/design-library/publishing/designs.json');
const entries = readJson(root, 'tools/design-library/out/pilot.json'), reviews = readJson(root, 'tools/design-library/review/shared-reviews.json');
const queue = reviewQueue(reviews, entries, root);
const { compiled } = buildCollections(root, readJson(root, 'tools/design-library/collections/source.json'), entries, queue, reviews);
checkRuntimeCollections(root, compiled);

// The approval process is unchanged: only a current approval publishes.
const bundledOnly = plan.bundled_only.map(row => row.setup);
for (const id of [...plan.setups, ...bundledOnly]) {
  if (queue.find(row => row.id === id)?.state !== 'approved') throw new Error(`Missing current approval: ${id}`);
}

// Revisions come from the committed registry; publishing never renumbers.
const numbered = computeRevisions(root, implementationRoot);
const registry = readJson(root, 'tools/design-library/publishing/revisions.json');
if (JSON.stringify(numbered.registry) !== JSON.stringify(registry)) throw new Error('Catalogue revisions are stale. Run npm run templates:revisions, review and commit the result.');
const setups = numbered.setups.filter(setup => plan.setups.includes(setup.id));
const wanted = new Set([...setups.map(setup => JSON.parse(setup.json).design.id), ...plan.designs]);
const designs = numbered.designs.filter(design => wanted.has(design.id));
for (const id of wanted) if (!designs.some(design => design.id === id)) throw new Error(`${id} cannot be exported: ${numbered.failures.find(f => f.id === id)?.reason ?? 'unknown design'}`);
const colours = literalColourReport(root, designs.map(design => design.id));
if (colours.increased.length) throw new Error('These designs added literal colours instead of tokens:\n' + colours.increased.map(row => `  ${row.id}: ${row.count} (baseline ${row.baseline})`).join('\n'));

// Public artwork: the shipping renderer, a blocked network, downscaled premium pictures.
const renderer = readFileSync(resolve(root, 'tools/design-library/out/renderer.iife.js'), 'utf8');
const media = design => design.media.map(item => ({ ...item, bytes: Buffer.from(item.base64, 'base64') }));
const previewPack = (object, setupWords) => ({
  name: object.name, description: object.meta?.description ?? setupWords ?? '', version: `r${object.revision}`,
  assets: object.assets ?? [], image_bindings: (object.image_bindings ?? []).map(binding => ({ ...binding, template_id: object.id })),
  templates: [{ id: object.id, name: object.name, display_type: object.display_type, tier: object.tier, tree: object.tree, tokens: object.tokens }],
});
const artwork = designs.map(design => ({ id: design.id, pack: previewPack(JSON.parse(design.json)), media: media(design) }));
// A bundled-only design is shown from its bundled source: it is not downloadable.
const setupDesign = new Map(entries.map(entry => [entry.id, entry.template_id]));
const bundledArtwork = [...new Set(bundledOnly.map(id => setupDesign.get(id)))].map(id => {
  const files = [resolve(root, 'resources/templates/library', id + '.json'), ...['cart-recovery', 'display-types', 'journeys'].map(module => resolve(root, 'pro/modules', module, 'templates', id + '.json'))].filter(existsSync);
  const source = JSON.parse(readFileSync(files[0], 'utf8'));
  return { id, pack: previewPack({ ...source, revision: 0, meta: { description: metadata.designs?.[id]?.description } }), media: [] };
});
await galleryArtwork([...artwork, ...bundledArtwork], renderer);
for (const design of designs) Object.assign(design, { gallery: artwork.find(item => item.id === design.id).gallery, media: media(design) });

const known = new Set([...setups.map(setup => setup.id), ...bundledOnly]);
const collections = plan.collections.map(id => {
  const collection = compiled.find(item => item.id === id);
  if (!collection || collection.status !== 'published') throw new Error(`Collection lacks current approval: ${id}`);
  return { id: collection.id, revision: collection.revision, name: collection.name, description: collection.description, cover: collection.cover,
    priority: collection.priority, business_types: collection.business_types, markets: collection.markets,
    items: collection.items.filter(item => known.has(item.setup_id)).map(item => setups.some(setup => setup.id === item.setup_id)
      ? { setup: item.setup_id, stage: item.stage } : { design: setupDesign.get(item.setup_id), stage: item.stage, bundled_only: true }),
    ...(collection.event ? { event: collection.event } : {}) };
});
const release = buildRelease({
  designs, setups, collections, withdrawn: plan.withdrawn,
  taxonomy: metadata.taxonomy, bundledOnly: bundledArtwork.map(item => ({ id: item.id, gallery: item.gallery, name: item.pack.name, format: item.pack.templates[0].display_type, tier: item.pack.templates[0].tier, meta: metadata.designs?.[item.id] ?? {} })),
});

// The shipping PHP reader, over an in-memory copy, before anything is written.
const base = `${origin.origin}/v3/`;
const responses = { '@base': base };
for (const object of release.objects) {
  const path = object.key.slice('v3/'.length);
  const url = base + (object.scope === 'private' ? 'premium/' : '') + path;
  responses[url] = object.bytes.toString(/\.(png|jpg|webp)$/.test(path) ? 'base64' : 'utf8');
}
responses[`${base}manifest.json`] = release.pointer.toString('utf8');
const empty = mkdtempSync(join(tmpdir(), 'wconvert-release-validation-'));
try {
  process.stdout.write(execFileSync('php', [resolve(implementationRoot, 'tools/design-library/build/export-designs.php'), root], {
    input: JSON.stringify({ mode: 'validate', source: `${base}manifest.json`, responses, designs: designs.map(d => d.id), setups: setups.map(s => s.id), empty_directory: empty }),
    encoding: 'utf8', maxBuffer: 512 * 1024 * 1024,
  }));
} finally { rmSync(empty, { recursive: true, force: true }); }

const result = publishRelease(directory, release, values.expected === 'none' ? null : values.expected);
const missingWords = designs.filter(design => !JSON.parse(design.json).meta?.description).map(design => design.id);
console.log(JSON.stringify({ ...result, directory, sourceDirectory: root, designs: designs.length, setups: setups.length, collections: collections.length,
  bundledOnly: bundledArtwork.length, withdrawn: plan.withdrawn.length, literalColours: colours.total,
  // Advisory until the website ships: each design page needs its own words.
  designsWithoutDescription: missingWords.length, hosted: false }, null, 2));

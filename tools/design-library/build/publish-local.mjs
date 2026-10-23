import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, realpathSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { buildCollections, checkRuntimeCollections } from './collections.mjs';
import { loadReviews, reviewQueue } from './reviews.mjs';
import { galleryArtwork } from './design-gallery.mjs';
import { buildRelease, publishRelease } from './publisher.mjs';
import { computeRevisions } from './catalogue-revisions.mjs';
import { readJson } from './catalogue.mjs';
import { literalColourReport } from './catalogue-lint.mjs';
import { allowedPairs, nearDuplicates } from './near-duplicates.mjs';
import { contrastReport } from './catalogue-contrast.mjs';
import { copyIssues } from './catalogue-copy.mjs';
import { designSource } from './sources.mjs';
import { delivery, releaseCollections, staleApprovals } from './delivery.mjs';
import { withPictures } from './design-images.mjs';
import { FIX } from './releasable.mjs';

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
if (plan.schema !== 3) throw new Error('Unsupported delivery plan');
const metadata = readJson(root, 'tools/design-library/publishing/designs.json');
const entries = readJson(root, 'tools/design-library/out/pilot.json'), reviews = loadReviews(root);
const queue = reviewQueue(reviews, entries, root);
// A stale approval would drop a live setup from the website with nobody
// having decided to, so it refuses the release (ADR 0162).
const stale = staleApprovals(queue);
if (stale.length) throw new Error(`These approvals are stale:\n${stale.map(row => `  ${row.id}`).join('\n')}\nRun ${FIX}, and review what it lists.`);
const { compiled } = buildCollections(root, readJson(root, 'tools/design-library/collections/source.json'), entries, queue, reviews);
checkRuntimeCollections(root, compiled);

// Revisions come from the committed registry; publishing never renumbers.
const numbered = computeRevisions(root, implementationRoot);
const registry = readJson(root, 'tools/design-library/publishing/revisions.json');
if (JSON.stringify(numbered.registry) !== JSON.stringify(registry)) throw new Error('Catalogue revisions are stale. Run npm run templates:revisions, review and commit the result.');

// The approval process is unchanged: only a current approval publishes, and
// what is online follows from it (ADR 0162).
const online = delivery({ entries, queue, exported: numbered, compiled, designs: plan.designs, withdrawn: plan.withdrawn });
const setups = numbered.setups.filter(setup => online.published.includes(setup.id));
const wanted = new Set([...setups.map(setup => JSON.parse(setup.json).design.id), ...online.designs]);
const designs = numbered.designs.filter(design => wanted.has(design.id));
for (const id of wanted) if (!designs.some(design => design.id === id)) throw new Error(`${id} cannot be exported: ${numbered.failures.find(f => f.id === id)?.reason ?? 'unknown design'}`);
const colours = literalColourReport(root, designs.map(design => design.id));
if (colours.increased.length) throw new Error('These designs added literal colours instead of tokens:\n' + colours.increased.map(row => `  ${row.id}: ${row.count} (baseline ${row.baseline})`).join('\n'));

// Words a visitor reads, published or not, carry no objective defect.
const copy = [...designs.map(design => [design.id, copyIssues(JSON.parse(design.json).tree, design.id)]),
  ...setups.map(setup => [setup.id, copyIssues({ copy: JSON.parse(setup.json).playbook.copy ?? null }, setup.id)])].filter(([, issues]) => issues.length);
if (copy.length) throw new Error('Fix these words before publishing:\n' + copy.flatMap(([, issues]) => issues.map(issue => `  ${issue.at}: ${issue.rule} — “${issue.text}”`)).join('\n'));

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
const bundledArtwork = [...new Set(online.held.map(row => row.design))].map(id => {
  const source = JSON.parse(readFileSync(designSource(root, id), 'utf8'));
  return { id, pack: previewPack({ ...source, revision: 0, meta: { description: metadata.designs?.[id]?.description } }), media: [] };
});
await galleryArtwork([...artwork, ...bundledArtwork], renderer);
// Text measured against the pixels actually behind it, pictures included (WCAG AA).
const contrast = [...await contrastReport(designs.map(design => withPictures(JSON.parse(design.json), media(design))), renderer)].filter(([, failures]) => failures.length);
if (contrast.length) throw new Error('These designs have text a visitor cannot read against what is behind it:\n'
  + contrast.flatMap(([id, failures]) => failures.map(failure => `  ${id} ${failure.screen}: “${failure.text}” ${failure.ratio}:1`)).join('\n'));
for (const design of designs) Object.assign(design, { gallery: artwork.find(item => item.id === design.id).gallery, media: media(design) });

// Two published designs that are one design are refused unless listed as deliberate.
const duplicates = nearDuplicates(designs.map(design => JSON.parse(design.json)), new Map(designs.map(design => [design.id, design.gallery.dhash])), allowedPairs(root));
if (duplicates.length) throw new Error('These published designs are near-duplicates; change one, or list the pair with its reason in publishing/near-duplicates.json:\n'
  + duplicates.map(pair => `  ${pair.a} ~ ${pair.b} (structure ${pair.structure}%, palette ${pair.palette}, picture ${pair.picture ?? 'n/a'} bits)`).join('\n'));

const collections = releaseCollections(compiled, online);
const release = buildRelease({
  designs, setups, collections, withdrawn: plan.withdrawn,
  taxonomy: metadata.taxonomy, bundledOnly: bundledArtwork.map(item => ({ id: item.id, gallery: item.gallery, name: item.pack.name, format: item.pack.templates[0].display_type, tier: item.pack.templates[0].tier, meta: metadata.designs?.[item.id] ?? {} })),
});

// The shipping PHP reader, over an in-memory copy, before anything is written.
const base = `${origin.origin}/v3/`;
const responses = { '@base': base };
for (const object of release.objects) {
  // The PHP catalogue reads JSON and image assets, never website preview HTML.
  // Embedded preview fonts otherwise duplicate megabytes in this transport.
  if (object.key.endsWith('.html')) continue;
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

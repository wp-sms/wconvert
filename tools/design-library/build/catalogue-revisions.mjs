import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artworkExports } from './artwork.mjs';
import { assignRevisions, bundledDesigns, bundledRevisionFiles, exportObjects, metadataFor, readJson, retireMissing, writeJson } from './catalogue.mjs';
import { writeFileSync } from 'node:fs';

/**
 * Number every exportable design and every planned setup (ADR 0156).
 *
 *   npm run templates:revisions            write the registry and both bundled revision files
 *   npm run templates:revisions -- --check fail if either is stale (CI)
 *
 * A design whose source cannot be exported yet (an unconverted SVG, a
 * site-specific link) is left unnumbered; it is still bundled.
 */
export function computeRevisions(root, implementationRoot = root) {
  const plan = readJson(root, 'tools/design-library/publishing/catalog.json');
  if (plan.schema !== 2) throw new Error('Unsupported delivery plan');
  const metadata = readJson(root, 'tools/design-library/publishing/designs.json');
  const registry = readJson(root, 'tools/design-library/publishing/revisions.json');
  const bundled = bundledDesigns(root);
  const exported = exportObjects(root, implementationRoot, {
    designs: [...bundled.keys()].sort().map(id => ({ id, revision: 1, ...metadataFor(metadata, id) })),
    setups: plan.setups.map(id => ({ id, revision: 1 })),
    raster_sources: artworkExports(root, plan.artwork_exports), image_rights: plan.image_rights,
  });
  const blocking = exported.failures.filter(failure => failure.kind === 'setup');
  if (blocking.length) throw new Error('Planned setups cannot be exported:\n' + blocking.map(f => `  ${f.id}: ${f.reason}`).join('\n'));
  const numbered = assignRevisions(retireMissing(registry, { designs: new Set(bundled.keys()), setups: new Set(plan.setups) }), exported);
  return { ...numbered, failures: exported.failures, files: bundledRevisionFiles(root, numbered.registry) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
  const result = computeRevisions(root);
  const current = { 'tools/design-library/publishing/revisions.json': JSON.stringify(result.registry, null, 2) + '\n', ...result.files };
  const stale = Object.entries(current).filter(([path, bytes]) => !existsSync(resolve(root, path)) || readFileSync(resolve(root, path), 'utf8') !== bytes).map(([path]) => path);
  if (process.argv.includes('--check')) {
    if (stale.length) {
      console.error(`Catalogue revisions are stale (${stale.join(', ')}). Run npm run templates:revisions and commit the result.`);
      process.exit(1);
    }
    console.log('Catalogue revisions are current.');
  } else {
    for (const [path, bytes] of Object.entries(current)) writeFileSync(resolve(root, path), bytes);
    console.log(JSON.stringify({ changed: result.changed, unexportable: result.failures.map(f => `${f.kind}:${f.id}`) }, null, 2));
  }
}

export { writeJson };

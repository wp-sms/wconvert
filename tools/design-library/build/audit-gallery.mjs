import { readFileSync, writeFileSync, globSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { reviewQueue } from './reviews.mjs';
import { readPublicRelease } from '../../template-server/scripts/storage.mjs';
import { validateDesignCatalogue } from '../../template-server/scripts/design-catalogue.mjs';

const [sourceDirectory, snapshotFile, candidateDirectory, output] = process.argv.slice(2);
if (!output) throw Error('Usage: node audit-gallery.mjs /reviewed/source /live-snapshot.json /candidate /report.json');
const root = realpathSync(sourceDirectory), read = file => JSON.parse(readFileSync(file));
const live = read(snapshotFile), packs = live.pages.flatMap(page => page.packs), collections = live.pages.flatMap(page => page.collections);
validateDesignCatalogue(live.catalogue, { id: live.manifest.release, packs, collections, origin: new URL(live.manifest.pages[0].url).origin });
const entries = read(resolve(root, 'tools/design-library/out/pilot.json'));
const reviews = reviewQueue(read(resolve(root, 'tools/design-library/review/shared-reviews.json')), entries, root);
const approved = entries.filter(entry => reviews.find(review => review.id === entry.id)?.state === 'approved');
const bundled = globSync(['resources/templates/library/*.json', 'pro/modules/*/templates/*.json'], { cwd: root }).map(file => read(resolve(root, file)));
const liveIds = new Set(live.catalogue.designs.map(design => design.id));
const missing = bundled.filter(design => !liveIds.has(design.id)).map(design => ({
  id: design.id, format: design.display_type, tier: design.tier,
  approved_setups: approved.filter(entry => entry.template_id === design.id).map(entry => entry.id),
}));
const release = readPublicRelease(candidateDirectory);
const candidate = JSON.parse(release.objects.get(`releases/${release.id}/designs.json`));
const candidatePacks = [...release.objects].filter(([key]) => key.startsWith(`releases/${release.id}/page-`))
  .flatMap(([, bytes]) => JSON.parse(bytes).packs);
const all = [...candidate.designs, ...(candidate.extensions?.bundled_designs ?? [])];
const missingApproved = missing.filter(design => design.approved_setups.length);
const removed = [...liveIds].filter(id => !all.some(design => design.id === id));
const omitted = missingApproved.filter(design => !all.some(item => item.id === design.id));
if (removed.length || omitted.length || new Set(all.map(design => design.id)).size !== all.length) throw Error('Candidate removes, omits or duplicates designs');
for (const pack of packs) if (!candidatePacks.some(item => item.id === pack.id && item.sha256 === pack.sha256 && item.access === pack.access)) {
  throw Error(`Existing delivery pack changed or disappeared: ${pack.id}`);
}
const counts = designs => Object.fromEntries([...new Set(designs.map(d => d.format ?? d.display_type))].sort()
  .map(format => [format, designs.filter(d => (d.format ?? d.display_type) === format).length]));
const report = {
  observed_at: new Date().toISOString(), source_directory: root,
  source_commit: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  source_clean: execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' }).trim() === '',
  live: { release: live.manifest.release, designs: liveIds.size, packs: packs.length, formats: counts(live.catalogue.designs) },
  source: { bundled_designs: bundled.length, formats: counts(bundled), approved_setups: approved.length,
    missing_designs: missing.length, approved_missing_designs: missingApproved.length },
  candidate: { release: release.id, designs: all.length, pack_designs: candidate.designs.length,
    bundled_only_designs: candidate.extensions.bundled_designs.length, packs: candidatePacks.length,
    formats: counts(all), screens: all.reduce((count, design) => count + design.screens.length, 0),
    gallery_collections: candidate.extensions.collections.length, removed_designs: removed,
    existing_pack_bytes_unchanged: true, missing_approved_designs: omitted,
    all_previews_available: all.every(design => design.preview_status === 'available'),
    all_design_only_v1: all.every(design => design.design_only_embed?.version === 1) },
  approved_missing: missingApproved, remaining_missing: missing.filter(design => !design.approved_setups.length),
  collections: candidate.extensions.collections,
};
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ live: report.live, source: report.source, candidate: report.candidate }, null, 2));

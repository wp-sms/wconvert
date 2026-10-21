import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCollections, checkRuntimeCollections } from './collections.mjs';
import { staleApprovals } from './delivery.mjs';
import { loadReviews, reviewQueue } from './reviews.mjs';

/** The one command that carries what only the renderer moved, and lists the rest. */
export const FIX = 'npm run templates:visual-diff -- --apply';

/**
 * Could `main` publish the catalogue as it stands (ADR 0156, ADR 0162)?
 *
 * A setup's revision includes the shared stylesheet ({@link renderedIdentities}),
 * so a renderer edit stales every approval even when it draws nothing
 * differently. Nothing else notices until someone publishes; this refuses the
 * pull request instead, and names the command that carries what is
 * pixel-identical and lists only what a person has to look at again.
 *
 * @return {string[]} problems, empty when releasable
 */
export function releasable(root, entries, reviews) {
  const queue = reviewQueue(reviews, entries, root);
  const problems = staleApprovals(queue).map(row => `${row.id}: ${row.reason}`);
  const { compiled } = buildCollections(root, JSON.parse(readFileSync(resolve(root, 'tools/design-library/collections/source.json'), 'utf8')), entries, queue, reviews);
  try { checkRuntimeCollections(root, compiled); } catch (error) { problems.push(`Collections: ${error.message}`); }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
  const entries = JSON.parse(readFileSync(resolve(root, 'tools/design-library/out/pilot.json'), 'utf8'));
  const problems = releasable(root, entries, loadReviews(root));
  if (problems.length) {
    console.error(`Approved designs went stale, so nothing can be published:\n${problems.map(line => `  ${line}`).join('\n')}\n\n`
      + `Run:  ${FIX}\n\nIt carries every setup and Collection that looks the same, and lists the rest in tools/design-library/out/visual-diff.html. Commit what it writes.`);
    process.exit(1);
  }
  console.log('Every approval is current; the catalogue can be published.');
}

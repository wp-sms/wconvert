import { loaderConfig } from './vite.loader-config.mjs';

/**
 * Where each of Pro's six builds writes, and why the top rung is the odd one.
 *
 * ============================================================================
 * ELITE WRITES WHERE THE PLUGIN LOOKS. THE OTHER TWO WRITE BESIDE IT.
 * ============================================================================
 * An installed WConvert Pro reads `public/loader/loader.js` whatever tier it
 * is — `ProLoaderEnqueue::DIST` is one path, because a plugin directory holds
 * one build and asking it which tier it is at enqueue time would be a runtime
 * tier check on the request path (ADR 0015, ADR 0004). So the release build
 * stages exactly one tier's bundle into that path per ZIP.
 *
 * That leaves the repository, where all three exist at once and one of them
 * has to be the one a source checkout runs. It is **elite**: the Playground
 * one-liner in README.md mounts `pro/` straight off disk, and
 * `bin/verify-loader-replacement.php` declines without a bundle at that exact
 * path. Developing against the top rung is also the right default — it is the
 * product, and the other two are subsets of it.
 *
 * `public/tiers/` is therefore release-only scaffolding and never ships:
 * `bin/build.sh` copies the tier's bundle into `public/loader/` and deletes the
 * directory, and `bin/verify-artifact-contract.sh` fails a staged tree that
 * still has one (ADR 0056).
 *
 * @param {{ tier: string, entry: string, kind: 'loader' | 'inspector' }} options
 */
export function proTierConfig({ tier, entry, kind }) {
  const fileName = kind === 'loader' ? 'loader.js' : 'inspector.js';
  const outDir = tier === 'elite' ? `pro/public/${kind}` : `pro/public/tiers/${tier}/${kind}`;

  return loaderConfig({
    entry,
    outDir,
    // The global an IIFE build assigns itself. One per artifact, so two
    // bundles can never quietly be the same one.
    name: `wconvertPro${tier[0].toUpperCase()}${tier.slice(1)}${kind === 'loader' ? 'Loader' : 'Inspector'}`,
    fileName,
  });
}

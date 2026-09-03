import type { LoaderModule } from '@loader/types';

/**
 * The manifest's own invariant, as a function, so the failure case can be
 * tested as well as the happy one.
 *
 * ADR 0029: "Every entry resolves to an implementation on the side its `tier`
 * names, and carries all four fields three decisions now hang on it. This map
 * has refused a fourth hand-maintained list three times, and the manifest
 * survived each time BECAUSE BOTH RUNTIMES READ IT; that only holds if
 * something asserts it. Otherwise an entry with no implementation suspends
 * Optins at runtime for a reason that is a bug rather than a missing
 * dependency."
 *
 * It returns problems rather than throwing, because a test that can only be
 * run against a correct manifest cannot prove it would catch an incorrect one.
 */

export interface ManifestEntry {
  readonly kind?: unknown;
  readonly tier?: unknown;
  readonly consent_category?: unknown;
  readonly on_absence?: unknown;
}

export type Manifest = Readonly<Record<string, Readonly<Record<string, ManifestEntry>>>>;

export type Tier = 'free' | 'basic' | 'pro' | 'elite';

const CLIENT_KINDS = ['trigger', 'condition'];

/**
 * Every entry the loader is responsible for, across every axis.
 *
 * Read by KIND rather than by axis name, so an entry filed under the wrong
 * section is a parity failure rather than an entry nothing checks.
 */
function clientEntries(manifest: Manifest): Map<string, ManifestEntry> {
  const entries = new Map<string, ManifestEntry>();

  for (const axis of Object.values(manifest)) {
    for (const [type, entry] of Object.entries(axis ?? {})) {
      if (CLIENT_KINDS.includes(String(entry?.kind))) {
        entries.set(type, entry);
      }
    }
  }

  return entries;
}

/**
 * @param tier    The rung being checked — free's tree, or one PAID rung's own
 *                additions. Never a cumulative set: the ladder is cumulative
 *                and the manifest is not, so `elite` is asked about the modules
 *                the elite rung ADDS and nothing it merely inherits (ADR 0056).
 * @param modules The modules that rung ships, and only that rung's own.
 */
export function parityProblems(manifest: Manifest, tier: Tier, modules: readonly LoaderModule[]): string[] {
  const problems: string[] = [];
  const entries = clientEntries(manifest);
  const byId = new Map(modules.map((module) => [module.id, module]));

  if (byId.size !== modules.length) {
    problems.push(`${tier}: two modules share an id`);
  }

  for (const [type, entry] of entries) {
    if (entry.tier !== tier) {
      continue;
    }

    const module = byId.get(type);

    if (module === undefined) {
      problems.push(`${type} is declared ${tier} but no ${tier} module implements it`);
      continue;
    }

    if (module.kind !== entry.kind) {
      problems.push(`${type} is a ${String(entry.kind)} in the manifest and a ${module.kind} in its module`);
    }

    // The module's copy of `consent_category` is the loader's ONLY source for
    // it. Free's bundle must not import the manifest — that would inline every
    // premium identifier into it, which is precisely the leak ADR 0029's scan
    // looks for — so the duplicate is deliberate and this is what stops it
    // drifting.
    if ((module.consentCategory ?? null) !== (entry.consent_category ?? null)) {
      problems.push(`${type} declares a different consent category in its module than in the manifest`);
    }
  }

  for (const module of modules) {
    const entry = entries.get(module.id);

    if (entry === undefined) {
      problems.push(`${module.id} has a ${tier} module but no entry in the manifest`);
      continue;
    }

    if (entry.tier !== tier) {
      problems.push(`${module.id} is declared ${String(entry.tier)} but is implemented on ${tier}'s side`);
    }
  }

  return problems;
}

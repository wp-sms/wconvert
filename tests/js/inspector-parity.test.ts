import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ============================================================================
 * THE INSPECTOR MUST COMPOSE WHAT THE LOADER COMPOSES, OR IT LIES.
 * ============================================================================
 * The whole value of the panel is that it reports the decision the page
 * actually took. Free's inspector on a Pro install would have no `exit_intent`
 * module and would report every exit-intent Optin as `inert` — *"it has no
 * trigger this site can fire, so it can never show"* — about Optins that are
 * working perfectly. A diagnostic that is confidently wrong is worse than
 * none, because the merchant acts on it and goes to rewrite correct rules.
 *
 * So each build's inspector entry names the same module sets as that build's
 * loader entry, and this asserts it in both trees.
 *
 * ============================================================================
 * AND NOTHING IN THE PRODUCTION GRAPH MAY REACH `inspect/`.
 * ============================================================================
 * `npm run check:loader` must print byte-identical numbers before and after
 * this feature. That is enforced by the shape rather than by remembering to
 * compare: one static import from anything the loader entry reaches pulls the
 * panel, its CSS and the report into the 8KB-budgeted bundle. The same silent
 * failure `tests/js/admin-split.test.ts` guards one bundle over.
 */
const ROOT = resolve(import.meta.dirname, '../..');

const source = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

/**
 * Which module sets an entry composes.
 *
 * Free's entries call `createLoader(...)` directly. Pro's do not: there is one
 * entry per TIER (ADR 0056) and the composition they share — free's modules
 * first, Pro's presenter, the boot — lives in `pro/resources/loader/src/tier.ts`
 * so it cannot be got right at two rungs and wrong at the third. What a Pro
 * entry states is the one thing that differs, which is the argument it hands
 * `bootProLoader` / `bootProInspector`.
 *
 * Both spellings are read the same way — the identifiers ending `_MODULES` in
 * the composing call — so this asserts what each entry NAMES rather than how
 * its tree happens to be factored.
 */
function composed(path: string): string[] {
  const call = /(?:createLoader|bootProLoader|bootProInspector)\(\[?([^)]*)\]?\)/.exec(source(path));

  expect(call, `${path} does not compose a loader`).not.toBeNull();

  return [...(call as RegExpExecArray)[1].matchAll(/([A-Z_]+_MODULES)/g)].map((match) => match[1]);
}

/** Every paid rung, ascending — the same three `tiers.json` declares. */
const TIERS = ['basic', 'pro', 'elite'] as const;

describe('each build’s inspector', () => {
  it('composes exactly what that build’s loader composes', () => {
    expect(composed('resources/loader/src/inspect/main.ts')).toEqual(
      composed('resources/loader/src/main.ts'),
    );
  });

  /**
   * ==========================================================================
   * AND PER RUNG, WHICH IS WHERE THE HAZARD GOT FINER.
   * ==========================================================================
   * Free's inspector on a Pro install reports every `exit_intent` Optin as
   * `inert` while it works perfectly. One rung down that same mistake is an
   * ELITE inspector on a Basic install reporting the cart Conditions as
   * evaluable on a build that cannot evaluate them — the same confidently
   * wrong diagnostic, arriving from inside Pro rather than from free.
   */
  it.each(TIERS)('composes at the %s rung exactly what that rung’s loader composes', (tier) => {
    expect(composed(`pro/resources/loader/src/inspect/${tier}.ts`)).toEqual(
      composed(`pro/resources/loader/src/${tier}.ts`),
    );
  });

  /**
   * Each rung names its own set, and no two name the same one — asserted
   * positively so the equalities above cannot be satisfied by two entries that
   * are both wrong in the same way, or by three rungs that are all elite.
   */
  it('is free’s modules alone in free, and one distinct set per paid rung', () => {
    expect(composed('resources/loader/src/inspect/main.ts')).toEqual(['FREE_MODULES']);

    const named = TIERS.map((tier) => composed(`pro/resources/loader/src/${tier}.ts`));

    expect(named).toEqual([['BASIC_MODULES'], ['PRO_MODULES'], ['ELITE_MODULES']]);
  });

  /** All four run the SAME inspector, imported from free's tree rather than forked. */
  it('runs one implementation, which lives in free’s tree', () => {
    expect(source('resources/loader/src/inspect/main.ts')).toContain("from './run'");
    expect(source('pro/resources/loader/src/inspect/tier.ts')).toContain("from '@loader/inspect/run'");

    for (const tier of TIERS) {
      expect(source(`pro/resources/loader/src/inspect/${tier}.ts`)).toContain("from './tier'");
    }
  });
});

describe('the production loader graph', () => {
  /**
   * Walked the way the bundler walks it, from the entry, so this is what the
   * 8KB budget actually measures — not a grep over the directory.
   */
  const reachedFrom = (entry: string): Set<string> => {
    const files = new Set<string>();
    const queue = [resolve(ROOT, entry)];

    while (queue.length > 0) {
      const file = queue.pop() as string;

      if (files.has(file)) {
        continue;
      }

      files.add(file);

      for (const match of readFileSync(file, 'utf8').matchAll(
        /^(?:import|export)\s+([^;]*?)\s*from\s*['"]([^'"]+)['"]/gm,
      )) {
        // `import type` is erased before the bundler sees it, so it costs
        // nothing and must not be counted.
        if (/^type[\s{]/.test(match[1])) {
          continue;
        }

        const resolved = fileFor(match[2], file);

        if (resolved !== null) {
          queue.push(resolved);
        }
      }
    }

    return files;
  };

  const LOADER = resolve(ROOT, 'resources/loader/src');

  function fileFor(specifier: string, importer: string): string | null {
    const base = specifier.startsWith('@loader/')
      ? resolve(LOADER, specifier.slice('@loader/'.length))
      : specifier.startsWith('.')
        ? resolve(dirname(importer), specifier)
        : null;

    if (base === null) {
      return null;
    }

    for (const candidate of [`${base}.ts`, base, `${base}/index.ts`]) {
      try {
        readFileSync(candidate, 'utf8');

        return candidate;
      } catch {
        continue;
      }
    }

    return null;
  }

  it.each([
    ['free', 'resources/loader/src/main.ts'],
    ...TIERS.map((tier): [string, string] => [`pro ${tier}`, `pro/resources/loader/src/${tier}.ts`]),
  ])('never reaches the inspector from %s’s loader entry', (_name, entry) => {
    const inspector = resolve(LOADER, 'inspect');

    expect([...reachedFrom(entry)].filter((file) => file.startsWith(`${inspector}/`))).toEqual([]);
  });

  /**
   * Without this the assertion above would also pass on a tree that had
   * deleted the inspector.
   */
  it('has an inspector to keep out of it', () => {
    expect(readdirSync(resolve(LOADER, 'inspect')).length).toBeGreaterThan(3);
  });

  /** And the inspector's own entry genuinely reaches the real `decide`. */
  it('is reached BY the inspector, which is how it reports the real decision', () => {
    expect(reachedFrom('resources/loader/src/inspect/main.ts')).toContain(resolve(LOADER, 'decide.ts'));
  });
});

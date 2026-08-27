import { readFileSync, existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ============================================================================
 * THE READING SCREENS DO NOT REACH THE BUILDER (#73, ADR 0038).
 * ============================================================================
 * The Optins, Analytics, Leads and Destinations screens need none of the
 * gallery, none of the settings panel and none of the renderer, and since #73
 * they no longer download them: `builder/lazy.tsx` reaches all of it through
 * one `import()`, and Rollup puts everything only that import can reach into a
 * chunk nobody fetches until a merchant opens the builder.
 *
 * **The way that breaks is silent, which is the whole reason this file exists.**
 * One static `import` from anything the reading screens reach — a helper lifted
 * out of the panel, a type import that lost its `type` keyword, a
 * convenience re-export — pulls the entire subtree back into `main.js`. The
 * build still succeeds. Every screen still works. The only symptom is a number
 * in a build log, and the merchant this was done for pays it again.
 *
 * So this walks the STATIC import graph from the bundle's entry, exactly as the
 * bundler does, and asserts what is not in it. It is the admin's counterpart to
 * `bin/check-loader.mjs`'s premium-import scan
 * ([ADR 0029](../../docs/adr/0029-the-free-contract-is-proven-at-the-source.md)):
 * proven at the source, per run, rather than measured after the fact.
 *
 * `import type` is skipped because TypeScript erases it — `templates/api.ts`
 * imports the renderer's types and carries none of its code, and a test that
 * could not tell the two apart would forbid the thing that is already free.
 */

const SRC = resolve(import.meta.dirname, '../../resources/admin/src');
const RENDERER = resolve(import.meta.dirname, '../../resources/renderer/src');
const ENTRY = resolve(SRC, 'main.tsx');

/** The one module allowed to reach the far side, and how it is allowed to. */
const BOUNDARY = resolve(SRC, 'builder/lazy.tsx');

/**
 * Every static `import`/`export … from` in a file, minus the type-only ones.
 *
 * A regex rather than a parser: this reads the repo's own source, which is
 * formatted by one linter and written in one style, and the shapes it must not
 * miss are the two above. A `require()` or a string built at runtime would slip
 * past — neither exists in this tree, and the bundler would not resolve them
 * either.
 */
function specifiersOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const found: string[] = [];

  for (const match of source.matchAll(/^(?:import|export)\s+([^;]*?)\s*from\s*'([^']+)'/gm)) {
    const [, clause, specifier] = match;

    // `import type { X } from` and `export type { X } from` are erased; an
    // inline `{ a, type B }` is not, because `a` still arrives at runtime.
    if (!/^type[\s{]/.test(clause)) {
      found.push(specifier);
    }
  }

  // A bare `import './index.css'` has no `from` clause and still pulls a file.
  for (const match of source.matchAll(/^import\s+'([^']+)'/gm)) {
    found.push(match[1]);
  }

  return found;
}

/** A specifier as a file on disk, or null where it is a package. */
function fileFor(specifier: string, importer: string): string | null {
  const base = specifier.startsWith('@renderer/')
    ? resolve(RENDERER, specifier.slice('@renderer/'.length))
    : specifier.startsWith('@/')
      ? resolve(SRC, specifier.slice('@/'.length))
      : specifier.startsWith('.')
        ? resolve(dirname(importer), specifier)
        : null;

  if (base === null) {
    return null;
  }

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (existsSync(candidate) && !candidate.endsWith('.css')) {
      return candidate;
    }
  }

  return null;
}

/** Every file and every package the entry can reach without an `import()`. */
function staticGraph(): { files: Set<string>; packages: Set<string> } {
  const files = new Set([ENTRY]);
  const packages = new Set<string>();
  const queue = [ENTRY];

  while (queue.length > 0) {
    const file = queue.pop() as string;

    for (const specifier of specifiersOf(file)) {
      const resolved = fileFor(specifier, file);

      if (resolved === null) {
        packages.add(specifier);
        continue;
      }

      if (!files.has(resolved)) {
        files.add(resolved);
        queue.push(resolved);
      }
    }
  }

  return { files, packages };
}

const graph = staticGraph();
const inside = (root: string) =>
  [...graph.files].filter((file) => file.startsWith(`${root}/`)).map((file) => relative(SRC, file));

describe('the lazy boundary', () => {
  /**
   * The entry reaches the boundary — without this the three assertions below
   * would also pass on an admin that had deleted the builder entirely.
   */
  it('is reachable from the entry, and reaches the builder only through import()', () => {
    expect(graph.files).toContain(BOUNDARY);
    expect(readFileSync(BOUNDARY, 'utf8')).toContain("import('./deferred')");
  });

  /**
   * **The renderer is the expensive half and the reason the ticket exists.** It
   * is in this bundle because gallery cards and previews draw the REAL template
   * — there are no static thumbnails (ADR 0010) — and a merchant checking
   * yesterday's leads has no use for any of it.
   */
  it('keeps the renderer off the reading screens', () => {
    expect(inside(RENDERER)).toEqual([]);
  });

  /**
   * `lazy.tsx` is the eager half of the boundary and belongs here. Everything
   * else under `builder/` is behind it, `deferred.ts` included — a static
   * import of that file is the single edit that undoes the whole split.
   */
  it('keeps the builder itself off them too', () => {
    expect(inside(resolve(SRC, 'builder'))).toEqual(['builder/lazy.tsx']);
  });

  /**
   * The creation flow ends in the builder by construction and draws a real
   * design at its last step, so it is on the far side of the line with it.
   */
  it('keeps the creation flow off them', () => {
    expect(inside(resolve(SRC, 'goals'))).not.toContain('goals/GoalScreen.tsx');
  });

  /**
   * The two dependencies only the settings panel has. Named rather than
   * inferred, because a package is where a static import is least visible: it
   * arrives at the top of one editor and costs every screen in the admin.
   */
  it('keeps the colour picker and the popover off them', () => {
    expect([...graph.packages]).not.toContain('react-colorful');
    expect([...graph.packages]).not.toContain('radix-ui');
  });
});

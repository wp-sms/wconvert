import type { TemplateIndexEntry } from '../templates/api';

/**
 * Narrowing a library of forty designs down to the ones worth looking at.
 *
 * ============================================================================
 * FILTERING IS THE CLIENT'S, BECAUSE THE INDEX IS ALREADY HERE.
 * ============================================================================
 * The whole index arrives in one response — a card is a name, a Display Type,
 * a tier and five derived facets, and none of it is a tree (ADR 0043). So every
 * chip and every keystroke is a filter over an array that is already in memory,
 * with no request behind it and nothing to debounce. A server-side filter would
 * be a round trip per chip for a set small enough to hold.
 *
 * **What is expensive is the tree**, and that is exactly what the split moved:
 * the picker fetches designs for the cards near the viewport, so filtering to
 * three designs fetches three trees rather than forty.
 *
 * ============================================================================
 * OR WITHIN A FACET, AND WITH NO "ALL" CHIP TO EXPLAIN.
 * ============================================================================
 * *Email* and *Phone number* both pressed means "asks for either", which is what
 * a merchant pressing two chips means, and nothing pressed means no
 * constraint — so the unfiltered state IS the empty state and there is no
 * "All" chip to define, keep in step, or explain (ADR 0042 rule 2).
 *
 * Across facets it is AND: *Side by side* + *Email* is designs that are both.
 * That is the only reading under which two chips narrow rather than widen, and
 * a chip that widens a set is a chip nobody can predict.
 */

/** What the toolbar has been asked for: facet → the values pressed. */
export type Chosen = Readonly<Record<string, readonly string[]>>;

/**
 * One design's value for a facet, as a set of strings the chips compare
 * against.
 *
 * ============================================================================
 * THREE FACETS, THREE CARDINALITIES, AND ONE COMPARISON.
 * ============================================================================
 * `shape` is a single word, `captures` is a list, `has_image` is a boolean. A
 * filter that had to know which was which would carry a table of shapes beside
 * the manifest's — the fifth cross-cutting list this project has refused
 * (ADR 0019). Flattening each to a set of strings costs nothing and lets one
 * line answer all three.
 *
 * `has_image` flattens to `['true']` or `[]`, which is why the manifest offers
 * exactly the value `"true"` for it: the chip's value and the design's value
 * are the same string, so the vocabulary the manifest enumerates is the
 * vocabulary the comparison uses.
 */
function valuesOf(entry: TemplateIndexEntry, facet: string): readonly string[] {
  const held = (entry.facets as unknown as Record<string, unknown>)[facet];

  if (typeof held === 'boolean') {
    return held ? ['true'] : [];
  }

  if (typeof held === 'string') {
    return [held];
  }

  return Array.isArray(held) ? (held as string[]) : [];
}

/** Does this design answer every facet the merchant narrowed by? */
export function matchesFacets(entry: TemplateIndexEntry, chosen: Chosen): boolean {
  return Object.entries(chosen).every(([facet, wanted]) => {
    if (wanted.length === 0) {
      return true;
    }

    const held = valuesOf(entry, facet);

    return wanted.some((value) => held.includes(value));
  });
}

/**
 * Does this design match what was typed?
 *
 * **The NAME and nothing else.** A Template carries no copy — the words come
 * from the [[Playbook]] (CONTEXT.md, Template) — so there is no body text to
 * search and searching the facet words would make *"row"* match a design
 * arranged in one, which is what the chip beside the box already does and does
 * better. A search box that quietly does a second thing is a search box whose
 * results nobody can predict.
 *
 * Case- and accent-insensitive through `localeCompare`'s own collator rather
 * than a `toLowerCase()` that is wrong in Turkish: `İ` lowercases to `i̇` in
 * most locales and not in `tr`, and a merchant typing their own language into
 * their own admin is the case this has to be right for.
 */
export function matchesQuery(name: string, query: string): boolean {
  const needle = query.trim();

  if (needle === '') {
    return true;
  }

  const collator = new Intl.Collator(undefined, { sensitivity: 'base', usage: 'search' });

  for (let at = 0; at + needle.length <= name.length; at += 1) {
    if (collator.compare(name.slice(at, at + needle.length), needle) === 0) {
      return true;
    }
  }

  return false;
}

/**
 * The library, narrowed — Display Type first, then the toolbar.
 *
 * **Display Type is not one of the chips.** One Template serves exactly one
 * (CONTEXT.md, Template) and the Optin already declares which, so a control for
 * it here would be asking a question the screen has already answered
 * (ADR 0042 rule 2).
 */
export function narrow(
  entries: readonly TemplateIndexEntry[],
  displayType: string,
  chosen: Chosen,
  query: string,
): TemplateIndexEntry[] {
  return entries.filter(
    (entry) =>
      entry.display_type === displayType &&
      matchesFacets(entry, chosen) &&
      matchesQuery(entry.name, query),
  );
}


/**
 * One chip pressed or unpressed, as a whole new selection.
 *
 * Multi-select within the facet, which is what OR-within-a-facet means from the
 * control's side: pressing a second chip adds to the first rather than
 * replacing it.
 */
export function toggled(chosen: Chosen, facet: string, value: string): Chosen {
  const held = chosen[facet] ?? [];

  return {
    ...chosen,
    [facet]: held.includes(value) ? held.filter((each) => each !== value) : [...held, value],
  };
}

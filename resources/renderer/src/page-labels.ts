/**
 * The visitor-facing words the renderer and the loader write themselves — a
 * close button's name, a countdown's units, a field's fallback label — in the
 * site's language.
 *
 * ============================================================================
 * THEY ARRIVE AS DATA, BECAUSE THE PAGE CARRIES NO `wp.i18n`.
 * ============================================================================
 * The loader is a raw IIFE with no `wp.i18n` dependency, and adding one would
 * put a second script on every visitor's page for a handful of strings (ADR
 * 0004). So PHP translates them — `WConvert\Frontend\PageLabels`, where they
 * reach the POT like any other call — and prints the list on the payload tag
 * as `data-labels`, beside the payload itself.
 *
 * Read by POSITION, with the English at the call site: `pageLabel(0, 'Close')`.
 * The position is `PageLabels::ENGLISH`'s, and `PageLabelsTest` holds every
 * call here to it, so the two lists cannot drift apart. The English stays
 * inline because it is what renders where nothing is printed — every
 * untranslated site, every cached page from before, the design studio — and
 * because the loader's byte budget has no room for a second copy.
 *
 * Pro's loader words sit at positions from 100 in the same attribute, added
 * by Pro's PHP through `wconvert_page_labels`, so free's list can grow without
 * moving Pro's. Only the words that differ from English are printed, as an
 * object keyed by position.
 */
let read: Record<number, string> | undefined;

export function pageLabel(index: number, english: string): string {
  // A page with no tag, or no attribute on it, throws or parses `null`, and
  // either way reads as nothing printed. A value PHP did not print as a string
  // cannot be there: `PageLabels::differing()` filters to strings.
  try {
    read ??= JSON.parse(document.getElementById('wconvert-payload')!.getAttribute('data-labels')!) ?? {};
  } catch {
    read = {};
  }

  return read![index] || english;
}

/**
 * The admin's previews have no payload tag; it hands over the same words PHP
 * prints for visitors (`wconvertAdmin.pageLabels`), so a preview speaks the
 * merchant's language. Tests pass `undefined` to read the page again.
 */
export function providePageLabels(labels: Readonly<Record<number, string>> | undefined): void {
  read = labels === undefined ? undefined : { ...labels };
}

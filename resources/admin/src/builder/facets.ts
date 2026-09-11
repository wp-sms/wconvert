import { __ } from '@wordpress/i18n';
import type { TemplateIndexEntry, TemplateLabelsWithFacets } from '../templates/api';

/** Facet selections operate on the already-loaded index, never on preview trees. */
export type Chosen = Readonly<Record<string, readonly string[]>>;

type SearchLabels = Pick<TemplateLabelsWithFacets, 'facetValues' | 'fields' | 'params'>;

/** Normalise the index's scalar, list and boolean facets for one comparison. */
function valuesOf(entry: TemplateIndexEntry, facet: string): readonly string[] {
  const held = (entry.facets as unknown as Record<string, unknown>)[facet];

  if (typeof held === 'boolean') return held ? ['true'] : [];
  if (typeof held === 'string') return [held];
  return Array.isArray(held) ? (held as string[]) : [];
}

/**
 * Every selected field is required: Email + Phone must offer both. Alternate
 * layouts or actions are alternatives, so those facets use OR within a group.
 * Different groups always combine with AND.
 */
export function matchesFacets(entry: TemplateIndexEntry, chosen: Chosen): boolean {
  return Object.entries(chosen).every(([facet, wanted]) => {
    if (wanted.length === 0) return true;
    const held = valuesOf(entry, facet);
    return facet === 'captures'
      ? wanted.every((value) => held.includes(value))
      : wanted.some((value) => held.includes(value));
  });
}

/** Case- and accent-insensitive substring matching in the admin's locale. */
export function matchesQuery(name: string, query: string): boolean {
  return contains(name, query, new Intl.Collator(undefined, { sensitivity: 'base', usage: 'search' }));
}

function contains(name: string, query: string, collator: Intl.Collator): boolean {
  const needle = query.trim().normalize('NFC');
  if (needle === '') return true;
  const haystack = name.normalize('NFC');

  for (let at = 0; at + needle.length <= haystack.length; at += 1) {
    if (collator.compare(haystack.slice(at, at + needle.length), needle) === 0) return true;
  }
  return false;
}

/**
 * Search the name and features the index can actually prove. Labels come from
 * the same translated vocabulary as the controls, not a second design taxonomy.
 * A name search still matches whole phrases; feature queries may combine words
 * across fields, e.g. "email picture". There are no Goal or industry guesses.
 */
export function matchesEntryQuery(entry: TemplateIndexEntry, query: string, labels?: SearchLabels): boolean {
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', usage: 'search' });
  if (contains(entry.name, query, collator)) return true;

  const words = [entry.name];
  if (entry.facets.shape !== null) {
    words.push(labels?.facetValues[`shape.${entry.facets.shape}`] ?? entry.facets.shape);
  }
  for (const field of entry.facets.captures) {
    words.push(labels?.facetValues[`captures.${field}`] ?? labels?.fields?.[field] ?? field);
  }
  if (entry.facets.has_image) {
    words.push(labels?.facetValues['has_image.true'] ?? __('With a picture', 'wconvert'));
    words.push(__('Image', 'wconvert'));
  }
  if (entry.facets.act === 'submit') {
    words.push(__('Form', 'wconvert'), labels?.params?.submit ?? __('Sends the form', 'wconvert'));
  } else if (entry.facets.act === 'click') {
    words.push(__('Link', 'wconvert'), __('Click-through', 'wconvert'), labels?.params?.link ?? __('Goes somewhere else', 'wconvert'));
  }

  return query.trim().split(/\s+/u).every((part) => words.some((word) => contains(word, part, collator)));
}

/** Display Type is fixed by the Optin; the remaining choices narrow its designs. */
export function narrow(
  entries: readonly TemplateIndexEntry[],
  displayType: string,
  chosen: Chosen,
  query: string,
  labels?: SearchLabels,
): TemplateIndexEntry[] {
  return entries.filter((entry) => entry.display_type === displayType
    && matchesFacets(entry, chosen) && matchesEntryQuery(entry, query, labels));
}

export interface FacetOption {
  readonly value: string;
  readonly count: number;
}

/**
 * Values that exist in this Display Type, retaining manifest order. Counts
 * answer how many designs match this option and the other active constraints.
 * Field counts also retain the other required fields; a selected option counts
 * its current matches, so it remains possible to remove a zero-result choice.
 */
export function facetOptions(
  entries: readonly TemplateIndexEntry[],
  facet: string,
  values: readonly string[],
  chosen: Chosen,
  query: string,
  labels?: SearchLabels,
): FacetOption[] {
  const held = chosen[facet] ?? [];
  return values
    .filter((value) => held.includes(value) || entries.some((entry) => valuesOf(entry, facet).includes(value)))
    .map((value) => {
      const candidates = facet === 'captures' ? [...new Set([...held, value])] : [value];
      const constraints = { ...chosen, [facet]: candidates };
      return {
        value,
        count: entries.filter((entry) => matchesFacets(entry, constraints) && matchesEntryQuery(entry, query, labels)).length,
      };
    });
}

/** Toggle one value without mutating the current selection. */
export function toggled(chosen: Chosen, facet: string, value: string): Chosen {
  const held = chosen[facet] ?? [];
  return { ...chosen, [facet]: held.includes(value) ? held.filter((each) => each !== value) : [...held, value] };
}

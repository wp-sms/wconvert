import apiFetch from '@wordpress/api-fetch';

/**
 * Finding a post or a term by its NAME, so targeting a page stops being an act
 * of typing a number.
 *
 * ============================================================================
 * `wp/v2/search`, DIRECTLY — NO ROUTE OF OUR OWN.
 * ============================================================================
 * Core already has this endpoint, its permission callback returns `true`, and
 * `apiFetch` already carries the nonce. A `GET /wconvert/v1/objects` would be
 * a route, a permission check, a controller and four route-count assertions
 * (`DestinationRoutesTest`, `BuilderRoutesTest` and two more) to say the same
 * thing core says.
 *
 * `include[]` is the half that makes it work as a picker rather than only as a
 * search: it *"limits the result set to specific IDs"*, which is how a stored
 * `42` becomes "Pricing" on the way back in.
 *
 * ============================================================================
 * TWO SILENT LIMITS, WRITTEN DOWN RATHER THAN DISCOVERED.
 * ============================================================================
 * **`post_status => 'publish'` is hard-coded in core's handler.** A draft
 * landing page cannot be found by title at all, and an id whose post was later
 * unpublished resolves to nothing. So {@link resolveObjects} answering with
 * nothing is NORMAL and the row must fall back to the raw `#42` — an empty box
 * there would read as *"your rule is gone"*, which is the one thing that is
 * not true. The follow-up is a `GET /wconvert/v1/objects` that can see drafts,
 * deliberately not in this slice.
 *
 * **Searchable post types are `public && show_in_rest`,** while
 * `RuleCatalogue::postTypes()` offers `public` alone. A public type registered
 * with `show_in_rest => false` is therefore offered as a `singular` or
 * `archive` option and is unfindable as a `post`. Named here; not fixed here,
 * because the fix is either narrowing what the other control offers or the new
 * route above, and both are decisions of their own.
 *
 * Queries are built with `URLSearchParams` rather than `@wordpress/url`, which
 * is not a dependency — and adding a name the WordPress script shim does not
 * export is a hard build failure by design.
 */

/** What the picker shows: the merchant's own words, and the id they hide. */
export interface ObjectHit {
  readonly id: string;
  readonly title: string;
}

/** `post` searches posts and pages; `term` searches categories and tags. */
export type ObjectKind = 'post' | 'term';

/**
 * A page of matches — **never everything**.
 *
 * A site with 50,000 posts is the ordinary case this has to survive, so the
 * list is a page of twenty off a debounced query rather than a select the
 * merchant scrolls.
 */
const PER_PAGE = 20;

export function searchObjects(kind: ObjectKind, search: string, signal?: AbortSignal): Promise<ObjectHit[]> {
  return fetchHits(
    new URLSearchParams({ search, type: kind, per_page: String(PER_PAGE), _fields: 'id,title' }),
    signal,
  );
}

/** A page, post or product a link can point at, by its permalink. */
export interface LinkHit {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  /** The post type: `page`, `post`, `product` or any other searchable one. */
  readonly subtype: string;
}

/**
 * Published content to link to, for `LinkField`. The same endpoint and the
 * same two limits as {@link searchObjects}; only `url` and `subtype` are new,
 * because a link stores the permalink rather than the id.
 */
export function searchLinks(search: string, signal?: AbortSignal): Promise<LinkHit[]> {
  const query = new URLSearchParams({ search, type: 'post', per_page: String(PER_PAGE), _fields: 'id,title,url,subtype' });

  return apiFetch<{ id: number | string; title: string; url: string; subtype: string }[]>({
    path: `/wp/v2/search?${query.toString()}`,
    signal,
  }).then((results) =>
    (Array.isArray(results) ? results : [])
      .filter((result) => typeof result.url === 'string' && result.url !== '')
      .map((result) => ({
        id: String(result.id),
        title: typeof result.title === 'string' && result.title !== '' ? result.title : result.url,
        url: result.url,
        subtype: typeof result.subtype === 'string' ? result.subtype : '',
      })),
  );
}

/**
 * The titles for ids already stored, so a saved rule reads as words.
 *
 * **An id that resolves to nothing is not an error.** Core hard-codes
 * `post_status => 'publish'`, so an unpublished or deleted post simply is not
 * in the answer — and the caller renders `#42` rather than a blank.
 */
export function resolveObjects(kind: ObjectKind, ids: readonly string[], signal?: AbortSignal): Promise<ObjectHit[]> {
  const wanted = ids.filter((id) => /^\d+$/.test(id));

  if (wanted.length === 0) {
    return Promise.resolve([]);
  }

  const query = new URLSearchParams({ type: kind, per_page: String(PER_PAGE), _fields: 'id,title' });

  // Repeated `include[]`, which is how WP_REST_Request reads an array
  // parameter out of a query string.
  for (const id of wanted) {
    query.append('include[]', id);
  }

  return fetchHits(query, signal);
}

function fetchHits(query: URLSearchParams, signal?: AbortSignal): Promise<ObjectHit[]> {
  return apiFetch<{ id: number | string; title: string }[]>({
    path: `/wp/v2/search?${query.toString()}`,
    signal,
  }).then((results) =>
    // A search result's `title` is already the post's rendered title as a plain
    // string — this endpoint returns it flat rather than as `{rendered}` — so
    // there is nothing to unwrap and nothing to strip.
    (Array.isArray(results) ? results : []).map((result) => ({
      id: String(result.id),
      title: typeof result.title === 'string' && result.title !== '' ? result.title : String(result.id),
    })),
  );
}

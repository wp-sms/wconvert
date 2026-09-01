/**
 * The site's published `inline` Optins, as the editor receives them.
 *
 * ============================================================================
 * HANDED OVER AT ENQUEUE, NOT FETCHED.
 * ============================================================================
 * `WConvert\Frontend\InlineOptinBlock::provideTheOptinList()` prints this
 * beside the script on `enqueue_block_editor_assets`, which is the one hook
 * that fires exactly where this block can be placed and nowhere else.
 *
 * A REST route was the alternative and it costs more than it looks. It would
 * need a capability, and the honest one is not `manage_options`: whoever can
 * open the post editor can place this block, so gating the picker on the
 * administration capability gives an Author a block with an empty dropdown and
 * nothing that says why. Answering that properly means a third exception to
 * `WConvert\Rest\Routes`' one-capability rule, a loading state, an error state
 * and a controller — for a list the editor page could simply have arrived
 * with.
 *
 * What it buys instead is staleness measured in one page load: an Optin
 * published in another tab appears here when the editor is reloaded. For a
 * picker whose entries are created on a different screen entirely, that is the
 * right trade.
 */
export interface InlineOptin {
  readonly id: string;
  readonly name: string;
}

declare global {
  interface Window {
    wconvertInlineOptins?: unknown;
  }
}

/**
 * What the page provided, or **null where it provided nothing at all**.
 *
 * ============================================================================
 * "NO OPTINS" AND "NO LIST" ARE DIFFERENT ANSWERS AND MUST NOT COLLAPSE.
 * ============================================================================
 * An empty array is a real answer: a site that has published no inline Optin
 * yet is the ordinary state of a fresh install, and it renders as *there is
 * nothing to place yet*.
 *
 * Null is not an answer at all. The inline script did not arrive — stripped by
 * a JS optimizer, lost to a stale cached bundle, or overwritten by something
 * else on that name. Returning `[]` for it made the two indistinguishable, and
 * the consequence lands on the one message that is supposed to be
 * trustworthy: **every block on the site would report that its Optin is no
 * longer published**, while the front end went on rendering all of them
 * perfectly. A diagnostic that is confidently wrong is acted on — a merchant
 * republishes an Optin that was never unpublished, or rebuilds a page that was
 * never broken.
 *
 * So the caller is handed the distinction and decides. Nothing here throws or
 * reports: this runs in the post editor, and an editor that cannot draw a
 * picker must still let somebody write their post.
 */
export function publishedInlineOptins(): InlineOptin[] | null {
  const provided = window.wconvertInlineOptins;

  if (!Array.isArray(provided)) {
    return null;
  }

  // The narrowing is defensive for the half-way case the check above cannot
  // see: an array of the wrong shape. An entry that is not an `{id, name}` is
  // dropped rather than rendered as `undefined — undefined` in the picker.
  return provided.filter(
    (optin): optin is InlineOptin =>
      typeof optin === 'object' &&
      optin !== null &&
      typeof (optin as InlineOptin).id === 'string' &&
      typeof (optin as InlineOptin).name === 'string',
  );
}

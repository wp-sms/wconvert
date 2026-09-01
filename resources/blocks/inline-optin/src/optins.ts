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
 * What the page provided, or an empty list.
 *
 * **Empty is a real answer and not a failure**, which is why nothing here
 * throws or reports: a site that has published no inline Optin yet is the
 * ordinary state of a fresh install, and it renders as the placeholder's
 * "there is nothing to place yet" rather than as an error. The narrowing is
 * defensive for the other case — another plugin, or a stale cached script,
 * putting something else on that name.
 */
export function publishedInlineOptins(): InlineOptin[] {
  const provided = window.wconvertInlineOptins;

  if (!Array.isArray(provided)) {
    return [];
  }

  return provided.filter(
    (optin): optin is InlineOptin =>
      typeof optin === 'object' &&
      optin !== null &&
      typeof (optin as InlineOptin).id === 'string' &&
      typeof (optin as InlineOptin).name === 'string',
  );
}

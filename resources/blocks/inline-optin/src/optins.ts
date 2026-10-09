import type { CampaignChoices, ChoicesSource, PickerCampaign } from './campaignPicker';
import { urlOrNull } from './campaignPicker';

/**
 * The site's inline campaigns, as the editor receives them.
 *
 * ============================================================================
 * HANDED OVER AT ENQUEUE, AND REFRESHED ON REQUEST.
 * ============================================================================
 * `WConvert\Frontend\InlineOptinBlock::provideTheOptinList()` prints this
 * beside the script on `enqueue_block_editor_assets`, which is the one hook
 * that fires exactly where this block can be placed and nowhere else — so the
 * picker draws with no loading state.
 *
 * It used to be only that, and the staleness it bought was one page load: a
 * campaign published in another tab did not appear until the editor was
 * reloaded, and the block said "none" in the meantime. Refresh asks
 * `GET /wconvert/v1/inline-campaigns` for the same list. Its capability is
 * `Routes::canPlaceCampaign()`, not the administration one: whoever can open
 * the post editor can place this block, and an Author refused the refresh
 * would hold a list nothing could update.
 *
 * Drafts are in the list with `status: 'draft'`, so the picker can say "publish
 * to place it" rather than "none". The links are null for anyone who cannot
 * open WConvert.
 */
export interface InlineCampaign extends PickerCampaign {
  readonly status: 'published' | 'draft';
  readonly editUrl: string | null;
}

export type InlineChoices = CampaignChoices<InlineCampaign>;

declare global {
  interface Window {
    wconvertInlineOptins?: unknown;
  }
}

/**
 * The list, or **null where there is no list at all**.
 *
 * ============================================================================
 * "NO CAMPAIGNS" AND "NO LIST" ARE DIFFERENT ANSWERS AND MUST NOT COLLAPSE.
 * ============================================================================
 * An empty list is a real answer: a site that has made no inline campaign
 * yet is the ordinary state of a fresh install, and it renders as *there is
 * nothing to place yet*.
 *
 * Null is not an answer at all. The inline script did not arrive — stripped by
 * a JS optimizer, lost to a stale cached bundle, or overwritten by something
 * else on that name. Reading that as empty made the two indistinguishable,
 * and the consequence lands on the one message that is supposed to be
 * trustworthy: **every block on the site would report that its campaign is no
 * longer published**, while the front end went on rendering all of them
 * perfectly. A diagnostic that is confidently wrong is acted on — a merchant
 * republishes a campaign that was never unpublished, or rebuilds a page that
 * was never broken.
 *
 * So the caller is handed the distinction and decides. Nothing here throws or
 * reports: this runs in the post editor, and an editor that cannot draw a
 * picker must still let somebody write their post.
 */
export function inlineChoices(value: unknown): InlineChoices | null {
  if (!value || typeof value !== 'object' || !('campaigns' in value) || !Array.isArray(value.campaigns)) {
    return null;
  }

  // The narrowing is defensive for the half-way case the check above cannot
  // see: a list with an entry of the wrong shape. That entry is dropped
  // rather than rendered as `undefined` in the picker, and the rest stand.
  const campaigns = (value.campaigns as unknown[]).flatMap((item): InlineCampaign[] => {
    if (!item || typeof item !== 'object') return [];
    const { id, name, status } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof name !== 'string' || (status !== 'published' && status !== 'draft')) return [];
    return [{ id, name, status, editUrl: urlOrNull(item, 'editUrl') }];
  });

  return { campaigns, manageUrl: urlOrNull(value, 'manageUrl'), createUrl: urlOrNull(value, 'createUrl') };
}

/** Where the picker reads its list from, and refreshes it. */
export const inlineSource: ChoicesSource<InlineCampaign> = {
  initial: () => window.wconvertInlineOptins,
  path: '/wconvert/v1/inline-campaigns',
  parse: inlineChoices,
  // Every inline block on the page shares the global, so the next one to
  // mount starts from the refreshed list rather than the page's.
  remember: (next) => { window.wconvertInlineOptins = next; },
};

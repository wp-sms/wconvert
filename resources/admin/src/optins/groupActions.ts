import { __, _n, sprintf } from '@wordpress/i18n';
import { campaignName, statusOf, type OptinSummary } from './api';

/**
 * Publish, Pause, Duplicate and Delete over the ticked rows of the campaign list.
 *
 * Each row goes through the route a single row uses, one after another. The
 * server refuses none of the skips below, so the browser decides them, and
 * names every one in the result rather than leaving a ticked row untouched
 * without a word.
 */
export type GroupAction = 'publish' | 'pause' | 'duplicate' | 'delete';
/** The three that can take a campaign off the site or put one on, and so ask first. */
export type ConfirmedAction = Exclude<GroupAction, 'duplicate'>;

export type SkipReason = 'variant' | 'test' | 'suspended' | 'no_design' | 'current' | 'draft';

export interface Skipped {
  readonly row: OptinSummary;
  readonly reason: SkipReason;
}

export interface GroupPlan {
  readonly run: readonly OptinSummary[];
  readonly skipped: readonly Skipped[];
}

/**
 * Which ticked rows the action runs on, and why each other one is left alone.
 *
 * `missingDesign` is the list's own reading of a row's preview: a row with no
 * saved design cannot publish, and the row menu refuses it the same way.
 */
export function plan(action: GroupAction, rows: readonly OptinSummary[], missingDesign: (row: OptinSummary) => boolean): GroupPlan {
  const run: OptinSummary[] = [];
  const skipped: Skipped[] = [];
  for (const row of rows) {
    const reason = skipOf(action, row, missingDesign(row));
    if (reason === null) run.push(row);
    else skipped.push({ row, reason });
  }
  return { run, skipped };
}

function skipOf(action: GroupAction, row: OptinSummary, missingDesign: boolean): SkipReason | null {
  // A variant is a sub-row of its test and has no tick-box. Belt and braces.
  if (row.parent_id !== null) return 'variant';
  if (action === 'duplicate') return null;
  // Changing the first arm alone would leave the others running, so a test is
  // changed from its own row, where each arm is in view.
  if (row.arms.length > 0) return 'test';
  if (action === 'delete') return null;
  const status = statusOf(row);
  if (action === 'pause') return status === 'draft' ? 'draft' : null;
  if (status === 'suspended') return 'suspended';
  if (missingDesign) return 'no_design';
  return status === 'published' && !row.has_unpublished_changes ? 'current' : null;
}

export interface Failed {
  readonly row: OptinSummary;
  readonly message: string;
}

export interface GroupResult {
  readonly action: GroupAction;
  readonly done: readonly OptinSummary[];
  readonly skipped: readonly Skipped[];
  readonly failed: readonly Failed[];
}

export type GroupEvent =
  | { readonly type: 'done'; readonly row: OptinSummary }
  | { readonly type: 'failed'; readonly row: OptinSummary; readonly message: string };

export const startResult = (action: GroupAction, skipped: readonly Skipped[]): GroupResult => ({ action, done: [], skipped, failed: [] });

/** One row's outcome, added to the running result. */
export function reduceResult(result: GroupResult, event: GroupEvent): GroupResult {
  return event.type === 'done'
    ? { ...result, done: [...result.done, event.row] }
    : { ...result, failed: [...result.failed, { row: event.row, message: event.message }] };
}

/** Why a row was skipped, in a few words. */
export function skipLabel(reason: SkipReason): string {
  switch (reason) {
    case 'variant': return __('A/B variant', 'wconvert');
    case 'test': return __('A/B test', 'wconvert');
    case 'suspended': return __('Suspended', 'wconvert');
    case 'no_design': return __('No design', 'wconvert');
    case 'current': return __('Already published', 'wconvert');
    case 'draft': return __('Draft', 'wconvert');
  }
}

/** "A/B test: Spring sale; Suspended: Cart saver" — each reason once, with its rows. */
export function skippedList(skipped: readonly Skipped[]): string {
  const byReason = new Map<SkipReason, string[]>();
  for (const { row, reason } of skipped) byReason.set(reason, [...(byReason.get(reason) ?? []), campaignName(row)]);
  /* translators: 1: why campaigns were skipped, such as "A/B test", 2: their names, comma separated. */
  return [...byReason].map(([reason, names]) => sprintf(__('%1$s: %2$s', 'wconvert'), skipLabel(reason), names.join(', '))).join('; ');
}

/** "Published 3. Skipped 1 (A/B test: Spring sale). 1 failed." */
export function resultSentence(result: GroupResult): string {
  const count = result.done.length;
  const parts: string[] = [
    result.action === 'publish'
      ? sprintf(/* translators: %d: how many campaigns were published. */ __('Published %d.', 'wconvert'), count)
      : result.action === 'pause'
        ? sprintf(/* translators: %d: how many campaigns were unpublished. */ __('Unpublished %d.', 'wconvert'), count)
        : result.action === 'delete'
          ? sprintf(/* translators: %d: how many campaigns were deleted. */ __('Deleted %d.', 'wconvert'), count)
          : sprintf(/* translators: %d: how many campaigns were copied. */ _n('Copied %d as a draft.', 'Copied %d as drafts.', count, 'wconvert'), count),
  ];
  if (result.skipped.length) {
    /* translators: 1: how many campaigns were skipped, 2: why and which, e.g. "A/B test: Spring sale". */
    parts.push(sprintf(__('Skipped %1$d (%2$s).', 'wconvert'), result.skipped.length, skippedList(result.skipped)));
  }
  if (result.failed.length) {
    /* translators: %d: how many campaigns could not be changed. */
    parts.push(sprintf(__('%d failed.', 'wconvert'), result.failed.length));
  }
  return parts.join(' ');
}

/** The confirm's words for Publish, Pause and Delete, counted and naming what is left alone. */
export function groupConfirmCopy(action: ConfirmedAction, group: GroupPlan): { title: string; description: string; confirmLabel: string } {
  const n = group.run.length;
  const skipped = group.skipped.length
    /* translators: 1: how many campaigns are left alone, 2: why and which, e.g. "A/B test: Spring sale". */
    ? ' ' + sprintf(__('%1$d will be skipped (%2$s).', 'wconvert'), group.skipped.length, skippedList(group.skipped))
    : '';
  if (action === 'delete') {
    return {
      title: sprintf(/* translators: %d: how many campaigns. */ _n('Delete %d campaign?', 'Delete %d campaigns?', n, 'wconvert'), n),
      description: __('They stop showing and leave this list. Their leads and results are kept.', 'wconvert') + skipped,
      confirmLabel: sprintf(/* translators: %d: how many campaigns. */ _n('Delete %d campaign', 'Delete %d campaigns', n, 'wconvert'), n),
    };
  }
  return action === 'publish'
    ? {
      title: sprintf(/* translators: %d: how many campaigns. */ _n('Publish %d campaign?', 'Publish %d campaigns?', n, 'wconvert'), n),
      description: __('Each latest saved draft becomes what visitors see, subject to its display rules.', 'wconvert') + skipped,
      confirmLabel: sprintf(/* translators: %d: how many campaigns. */ _n('Publish %d campaign', 'Publish %d campaigns', n, 'wconvert'), n),
    }
    : {
      title: sprintf(/* translators: %d: how many campaigns. */ _n('Unpublish %d campaign?', 'Unpublish %d campaigns?', n, 'wconvert'), n),
      description: __('They stop showing and return to Draft. Their saved drafts, leads and results are kept.', 'wconvert') + skipped,
      confirmLabel: sprintf(/* translators: %d: how many campaigns. */ _n('Unpublish %d campaign', 'Unpublish %d campaigns', n, 'wconvert'), n),
    };
}

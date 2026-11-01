import { statusOf, type OptinSummary } from './api';

/**
 * **The getting-started checklist, worked out from what the site already
 * records** (ADR 0176).
 *
 * Three steps whose goal is the first published campaign:
 * 1. Create a campaign: any campaign exists.
 * 2. Publish it: the `first_publish` milestone.
 * 3. Get your first lead: the `first_conversion` milestone.
 *
 * Progress is read from `GET /milestones` and the campaign list this screen
 * already loads, so it needs no storage of its own. The one stored fact is
 * whether this user put the card away (`checklistHidden`).
 *
 * **A site whose campaigns only show a message counts views instead.** A
 * "Show a message" campaign converts on nothing (ADR 0163), so its third step
 * would never finish. On such a site step 3 is "Get your first view" and reads
 * `first_impression`.
 */
export interface Milestones {
  first_publish: string | null;
  first_impression: string | null;
  first_conversion: string | null;
}

export type StepId = 'create' | 'publish' | 'result';
export type StepState = 'done' | 'current' | 'todo';

export interface Checklist {
  steps: { id: StepId; state: StepState }[];
  done: number;
  allSet: boolean;
  /** What step 3 waits for. */
  result: 'lead' | 'view';
  /** The newest draft: what "Review & publish" opens. */
  draft: { id: string; name: string } | null;
  /** The campaign step 1 names once it is done. */
  campaign: string | null;
  /** The site day each milestone was reached, for the done lines. */
  publishedOn: string | null;
  resultOn: string | null;
}

/**
 * @param countsNothing Whether a Goal converts on nothing (`outcome.action === 'none'`).
 */
export function checklistOf(rows: readonly OptinSummary[], milestones: Milestones, countsNothing: (goal: string) => boolean): Checklist {
  const live = rows.filter((row) => row.parent_id === null && statusOf(row) !== 'deleted');
  // ULIDs sort by creation time, so the largest id is the newest.
  const newest = (list: readonly OptinSummary[]) => list.reduce<OptinSummary | null>((best, row) => (best === null || row.id > best.id ? row : best), null);
  const draft = newest(live.filter((row) => statusOf(row) === 'draft'));
  const result = live.length > 0 && live.every((row) => countsNothing(row.goal)) ? 'view' : 'lead';
  const resultOn = result === 'view' ? milestones.first_impression : milestones.first_conversion;

  const reached: Record<StepId, boolean> = {
    create: live.length > 0 || milestones.first_publish !== null,
    publish: milestones.first_publish !== null,
    result: resultOn !== null,
  };
  const order: StepId[] = ['create', 'publish', 'result'];
  const current = order.find((id) => !reached[id]) ?? null;
  const steps = order.map((id) => ({ id, state: (reached[id] ? 'done' : id === current ? 'current' : 'todo') as StepState }));
  const done = steps.filter((step) => step.state === 'done').length;

  return {
    steps,
    done,
    allSet: done === order.length,
    result,
    draft: draft ? { id: draft.id, name: draft.name } : null,
    campaign: (draft ?? newest(live))?.name ?? null,
    publishedOn: milestones.first_publish,
    resultOn,
  };
}

export type StepAction =
  | { kind: 'create' }
  | { kind: 'edit'; id: string }
  | { kind: 'site'; url: string };

/**
 * The one button an open step has, or null when it has none yet.
 *
 * Only the current step acts. Publish needs a draft to open, and "View your
 * site" needs the site's address; without them the step says what happens
 * next and offers no button (hide, don't disable).
 */
export function actionFor(checklist: Checklist, id: StepId, homeUrl: string | undefined): StepAction | null {
  if (checklist.steps.find((step) => step.id === id)?.state !== 'current') return null;
  if (id === 'create') return { kind: 'create' };
  if (id === 'publish') return checklist.draft ? { kind: 'edit', id: checklist.draft.id } : null;

  try {
    const url = new URL(homeUrl ?? '');
    return ['http:', 'https:'].includes(url.protocol) ? { kind: 'site', url: url.toString() } : null;
  } catch {
    return null;
  }
}

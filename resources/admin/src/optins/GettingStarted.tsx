import { useEffect, useRef, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowUpRight, Check, CirclePlay, Plus, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { adminSettings } from '../settings';
import { WALKTHROUGH_VIDEO, GUIDES, docsUrl } from '../shell/docs';
import { formatDay } from '../lib/format';
import type { GoalEntry } from '../goals/api';
import type { OptinSummary } from './api';
import { actionFor, checklistOf, type Checklist, type Milestones, type StepId } from './checklist';
import { hideChecklist, readMilestones } from './gettingStartedApi';

export type ChecklistView =
  | { status: 'pending' }
  | { status: 'hidden' }
  | { status: 'shown'; checklist: Checklist; hide: () => void };

/**
 * Whether the getting-started card shows, and what it says (ADR 0176).
 *
 * `pending` until the campaign list and the milestones are both in, so an
 * empty site never flashes the plain empty state before the card. A failed
 * milestone read hides the card: the list underneath still works.
 *
 * "You're all set" shows once. Showing it writes the same per-user flag the ×
 * writes, because the milestones alone can't tell this visit from the next.
 */
/**
 * Hidden with × during this page load. The boot data is read once per load,
 * and Campaigns unmounts whenever the hash moves to another section, so the
 * list remembers it here rather than in a component.
 */
let hiddenThisLoad = false;

/** For tests: forget a × from an earlier render. */
export function resetChecklistForTests(): void {
  hiddenThisLoad = false;
}

export function useChecklist(rows: readonly OptinSummary[] | null, goals: readonly GoalEntry[] | null): ChecklistView {
  const [hidden, setHidden] = useState(() => hiddenThisLoad || adminSettings()?.checklistHidden === true);
  const [milestones, setMilestones] = useState<Milestones | null | 'failed'>(null);
  const wroteAllSet = useRef(false);

  useEffect(() => {
    if (hidden || rows === null) return;
    let active = true;
    // Again whenever the list reloads: a publish from a row moves step 2.
    void readMilestones().then(
      (data) => { if (active) setMilestones(data); },
      () => { if (active) setMilestones((current) => (current === null ? 'failed' : current)); },
    );
    return () => { active = false; };
  }, [hidden, rows]);

  const checklist = hidden || rows === null || milestones === null || milestones === 'failed'
    ? null
    : checklistOf(rows, milestones, (goal) => goals?.find((entry) => entry.id === goal)?.outcome.action === 'none');

  useEffect(() => {
    if (checklist?.allSet && !wroteAllSet.current) {
      wroteAllSet.current = true;
      void hideChecklist().catch(() => undefined);
    }
  }, [checklist?.allSet]);

  if (hidden || milestones === 'failed') return { status: 'hidden' };
  if (checklist === null) return { status: 'pending' };

  return {
    status: 'shown',
    checklist,
    hide: () => {
      hiddenThisLoad = true;
      setHidden(true);
      // If this fails the card comes back next visit, which is the safe way round.
      void hideChecklist().catch(() => undefined);
    },
  };
}

const TITLES: Record<StepId, () => string> = {
  create: () => __('Create a campaign', 'wconvert'),
  publish: () => __('Publish it', 'wconvert'),
  result: () => __('Get your first lead', 'wconvert'),
};

function stepTitle(id: StepId, checklist: Checklist): string {
  return id === 'result' && checklist.result === 'view' ? __('Get your first view', 'wconvert') : TITLES[id]();
}

function stepText(id: StepId, checklist: Checklist): ReactNode {
  const state = checklist.steps.find((step) => step.id === id)?.state;
  const view = checklist.result === 'view';

  if (id === 'create') {
    return state === 'done' && checklist.campaign
      ? sprintf(/* translators: %s: a campaign's name. */ __('%s is saved.', 'wconvert'), checklist.campaign)
      : __('Pick a goal, then a template. It starts as a draft.', 'wconvert');
  }

  if (id === 'publish') {
    return state === 'done' && checklist.publishedOn
      ? sprintf(/* translators: %s: a date, e.g. “Oct 31, 2026”. */ __('Live on your site since %s.', 'wconvert'), formatDay(checklist.publishedOn))
      : __('Check who sees it and when, then publish. Nobody sees a draft.', 'wconvert');
  }

  if (state === 'done' && checklist.resultOn) {
    const day = formatDay(checklist.resultOn);
    return view
      ? sprintf(/* translators: %s: a date, e.g. “Nov 1, 2026”. */ __('First view on %s.', 'wconvert'), day)
      : <>{sprintf(/* translators: %s: a date, e.g. “Nov 1, 2026”. */ __('First lead on %s.', 'wconvert'), day)} <a href="#leads">{__('See it in Leads', 'wconvert')}</a></>;
  }

  if (state === 'current') {
    return view
      ? __('Visit your site to see it in place. Every time a visitor sees it counts.', 'wconvert')
      : __('Visit your site to see it in place. Leads show up in Leads as they arrive.', 'wconvert');
  }

  return view
    ? __('Once it’s live, every time a visitor sees it counts.', 'wconvert')
    : __('When a visitor fills in the form, the lead shows up in Leads.', 'wconvert');
}

/**
 * The getting-started card at the top of Campaigns (ADR 0176; approved
 * prototype claude.ai/artifact/7kfMUDZUzGU3rbrxADFEcs).
 */
export function GettingStarted({
  checklist,
  onCreate,
  onEdit,
  onHide,
}: {
  checklist: Checklist;
  onCreate?: () => void;
  onEdit: (id: string) => void;
  onHide: () => void;
}) {
  const homeUrl = adminSettings()?.homeUrl;
  const view = checklist.result === 'view';
  const external = <><ArrowUpRight aria-hidden="true" className="wconvert-checklist__ext" /><span className="sr-only">{__('(opens in a new tab)', 'wconvert')}</span></>;

  const hide = () => {
    onHide();
    // The card is gone; give focus somewhere that still exists.
    const title = document.querySelector<HTMLElement>('#wconvert-admin .wconvert-page-title');
    if (title) {
      title.tabIndex = -1;
      title.focus();
    }
  };

  return (
    <section className="wconvert-checklist" aria-labelledby="wconvert-checklist-title" data-done={checklist.done}>
      <div className="wconvert-checklist__head">
        <div className="min-w-0">
          <h2 id="wconvert-checklist-title" className="wconvert-checklist__title">
            {checklist.allSet && <span className="wconvert-checklist__badge" aria-hidden="true"><Check /></span>}
            {checklist.allSet ? __('You’re all set', 'wconvert') : __('Get your first campaign live', 'wconvert')}
          </h2>
          <p className="wconvert-checklist__lede">
            {checklist.allSet
              ? (view
                ? sprintf(/* translators: %s: a campaign's name. */ __('%s is live and has its first view. This checklist won’t show next time.', 'wconvert'), checklist.campaign ?? __('Your campaign', 'wconvert'))
                : sprintf(/* translators: %s: a campaign's name. */ __('%s is live and has its first lead. This checklist won’t show next time.', 'wconvert'), checklist.campaign ?? __('Your campaign', 'wconvert')))
              : view
                ? __('Three steps from here to your first view.', 'wconvert')
                : __('Three steps from here to your first lead.', 'wconvert')}
          </p>
        </div>
        <div className="wconvert-checklist__meter">
          <span className="wconvert-checklist__count">
            {sprintf(/* translators: %d: how many of the three steps are done. */ __('%d of 3 done', 'wconvert'), checklist.done)}
          </span>
          <span className="wconvert-checklist__bar" aria-hidden="true">
            {checklist.steps.map((step) => <i key={step.id} data-on={step.state === 'done' || undefined} />)}
          </span>
        </div>
        <Button type="button" variant="ghost" size="icon" className="wconvert-checklist__close"
          aria-label={__('Hide this checklist', 'wconvert')} title={__('Hide this checklist', 'wconvert')} onClick={hide}>
          <X aria-hidden="true" />
        </Button>
      </div>
      <ol className="wconvert-checklist__steps">
        {checklist.steps.map((step, index) => {
          const action = actionFor(checklist, step.id, homeUrl);
          return (
            <li key={step.id} className="wconvert-checklist__step" data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
              <span className="wconvert-checklist__mark" aria-hidden="true">{step.state === 'done' ? <Check /> : index + 1}</span>
              <div className="min-w-0">
                <h3 className="wconvert-checklist__step-title">
                  {stepTitle(step.id, checklist)}
                  {step.state === 'done' && <span className="sr-only"> {__('(done)', 'wconvert')}</span>}
                </h3>
                <p className="wconvert-checklist__text">{stepText(step.id, checklist)}</p>
                {action?.kind === 'create' && onCreate && (
                  <div className="wconvert-checklist__action">
                    <Button type="button" onClick={onCreate}><Plus aria-hidden="true" />{__('Create campaign', 'wconvert')}</Button>
                  </div>
                )}
                {action?.kind === 'edit' && (
                  <div className="wconvert-checklist__action">
                    <Button type="button" onClick={() => onEdit(action.id)}>{__('Review & publish', 'wconvert')}</Button>
                  </div>
                )}
                {action?.kind === 'site' && (
                  <div className="wconvert-checklist__action">
                    <Button asChild variant="outline">
                      <a href={action.url} target="_blank" rel="noreferrer">{__('View your site', 'wconvert')}{external}</a>
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="wconvert-checklist__foot">
        <a href={docsUrl(WALKTHROUGH_VIDEO.guide, WALKTHROUGH_VIDEO.section)} target="_blank" rel="noreferrer">
          <CirclePlay aria-hidden="true" className="wconvert-checklist__play" />{__('Watch: 3-min walkthrough', 'wconvert')}{external}
        </a>
        <span aria-hidden="true">·</span>
        <a href={docsUrl(GUIDES.firstCampaign)} target="_blank" rel="noreferrer">{__('Read the guide', 'wconvert')}{external}</a>
      </div>
    </section>
  );
}

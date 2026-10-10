import { useId, type ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Target } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';
import { TryAgain } from '../shell/Region';
import { formatCount, formatRange, formatRate } from '../lib/format';
import type { GoalEntry } from '../goals/api';
import type { Loadable } from '../shell/loadable';
import { goalSaid } from '../goals/said';
import { FactList, type Fact } from '../shell/FactList';
import type { OptinStatus } from './api';

/** One campaign's numbers for a period, as its host already read them. */
export type CampaignResults =
  | { status: 'loading' }
  | { status: 'failed'; onRetry?: () => void }
  | { status: 'ready'; days: number; from?: string; to?: string; result?: { count: number; shown: number; rate: number | null; label: string } };

/**
 * **Campaign details' one body** (ADR 0138), for the list's Details and the
 * editor's alike: anything that needs attention, what it looks like, the Goal
 * and what counts as success, how it did, how it runs, whether its products
 * still exist — then whatever only its host has, then the developer ID.
 *
 * Two dialogs under one name used to show different halves of a campaign:
 * the editor's had the Goal, the list's had How it runs. Each host still owns
 * its header and footer; neither owns these sections.
 */
export function CampaignSummary({ notes = [], thumbnail, goal, goalId, goalAction, results, status, howItRuns, productCheck, children, developers }: {
  readonly notes?: readonly string[];
  readonly thumbnail?: ReactNode;
  readonly goal: Loadable<GoalEntry | null>;
  readonly goalId: string;
  /** The editor's Change goal; the list has none. */
  readonly goalAction?: ReactNode;
  readonly results: CampaignResults;
  readonly status: OptinStatus;
  readonly howItRuns: ReactNode;
  readonly productCheck?: ReactNode;
  /** The host's own sections, below the shared ones. */
  readonly children?: ReactNode;
  readonly developers: ReactNode;
}) {
  const entry = goal.status === 'ready' ? goal.data : null;
  return <>
    {notes.length > 0 && (
      <div role="note" className="wconvert-campaign-detail__notice">
        {notes.map((note) => <p key={note}>{note}</p>)}
      </div>
    )}
    {thumbnail}
    <GoalSection goal={goal} goalId={goalId} action={goalAction} />
    <Results results={results} status={status} rateLabel={entry?.rate_label} />
    {howItRuns}
    {productCheck}
    {children}
    {developers}
  </>;
}

/** The Goal, what counts as success, and how that number is measured. */
function GoalSection({ goal, goalId, action }: { goal: Loadable<GoalEntry | null>; goalId: string; action?: ReactNode }) {
  const heading = useId();
  const entry = goal.status === 'ready' ? goal.data : null;
  return (
    <section className="wconvert-campaign-facts wconvert-campaign-goal" aria-labelledby={heading}>
      <h3 id={heading}>{__('Goal', 'wconvert')}</h3>
      <div className="wconvert-campaign-goal__body">
        <Target aria-hidden="true" size={18} />
        <div>
          {/* Unread, it says nothing rather than flashing a placeholder (goals/said.ts). */}
          {/* Its line is held while the registry answers, so nothing below it moves (ADR 0039). */}
          <strong className="min-h-[1lh]">{entry ? entry.label : goalSaid(goal, goalId)}</strong>
          {entry && <p>{sprintf(
            /* translators: %s: what the Goal's number is called, e.g. “Quiz completions”. */
            __('Counts as success: %s', 'wconvert'), entry.headline_label)}</p>}
          {entry?.outcome && <p>{entry.outcome.measurement}</p>}
        </div>
        {action}
      </div>
    </section>
  );
}

/** The host's numbers for this campaign, never a second read. */
function Results({ results, status, rateLabel }: { results: CampaignResults; status: OptinStatus; rateLabel?: string }) {
  const heading = useId();
  // No period to name: a draft, or a read that recorded nothing.
  const title =
    results.status === 'ready' && results.days > 0
      ? results.from && results.to
        ? sprintf(
            /* translators: 1: the period, e.g. “Last 30 days”. 2: its dates, e.g. “Sep 10 – Oct 9”. */
            __('%1$s · %2$s', 'wconvert'),
            /* translators: %d: how many days the period covers. */
            sprintf(_n('Last %d day', 'Last %d days', results.days, 'wconvert'), results.days),
            formatRange(results.from, results.to),
          )
        /* translators: %d: how many days the period covers. */
        : sprintf(_n('Last %d day', 'Last %d days', results.days, 'wconvert'), results.days)
      : __('Results', 'wconvert');
  const result = results.status === 'ready' ? results.result : undefined;
  return (
    <section className="wconvert-campaign-facts" aria-labelledby={heading}>
      <h3 id={heading}>{title}</h3>
      {results.status === 'loading' ? (
        <div className="wconvert-campaign-detail-stats" aria-hidden="true">
          {[0, 1, 2].map((key) => (
            <div key={key}>
              <Skeleton className="w-12" style={{ blockSize: '1lh' }} />
              <Skeleton className="mt-1 w-20" style={{ blockSize: '1lh' }} />
            </div>
          ))}
        </div>
      ) : results.status === 'failed' ? (
        <div className="grid justify-items-start gap-2">
          <p role="alert">{__('Results couldn’t load.', 'wconvert')}</p>
          {results.onRetry && <TryAgain onClick={results.onRetry} />}
        </div>
      ) : result ? (
        <div className="wconvert-campaign-detail-stats">
          <p>
            <strong>{formatCount(result.count)}</strong>
            <span>{result.label}</span>
          </p>
          <p>
            <strong>{formatCount(result.shown)}</strong>
            <span>{__('Shown', 'wconvert')}</span>
            {/* Submissions with no views read as a fault unless something says why. */}
            {result.shown === 0 && result.count > 0 && (
              <small>{__('Views are counted only from the published version.', 'wconvert')}</small>
            )}
          </p>
          <p>
            <strong>{formatRate(result.rate)}</strong>
            {/* The Goal's own word for its rate, e.g. “Quiz completion rate” (ADR 0138). */}
            <span>{rateLabel ?? __('Conversion rate', 'wconvert')}</span>
            {result.rate === null && <small>{__('Shows once it has been shown', 'wconvert')}</small>}
          </p>
        </div>
      ) : (
        <p>{status === 'draft' ? __('No results yet.', 'wconvert') : __('No results in this period.', 'wconvert')}</p>
      )}
    </section>
  );
}

/** How it runs, as both Details hosts and nothing else draw it (ADR 0138). */
export function HowItRuns({ facts }: { facts: readonly Fact[] }) {
  const heading = useId();
  return (
    <section className="wconvert-campaign-facts" aria-labelledby={heading}>
      <h3 id={heading}>{__('How it runs', 'wconvert')}</h3>
      <FactList facts={facts} />
    </section>
  );
}

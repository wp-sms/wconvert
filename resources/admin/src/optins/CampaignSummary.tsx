import { useId, type ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Target } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';
import { TryAgain } from '../shell/Region';
import { formatCount, formatRange, formatRate } from '../lib/format';
import type { GoalEntry } from '../goals/api';
import type { Loadable } from '../shell/loadable';
import { FactList, type Fact } from '../shell/FactList';
import { InfoTip } from '../shell/InfoTip';
import { LineSkeleton } from '../shell/LineSkeleton';
import type { OptinStatus } from './api';

/** One campaign's numbers for a period, as its host already read them. */
export type CampaignResults =
  | { status: 'loading' }
  | { status: 'failed'; onRetry?: () => void }
  | { status: 'ready'; days: number; from?: string; to?: string; custom?: boolean; result?: { count: number; shown: number; rate: number | null; label: string; counted?: boolean } };

/**
 * **The top of a campaign's dialog** (ADR 0183): its preview at the start, and
 * beside it the answer that dialog opens to give. Review & publish puts what
 * counts as success there; Details puts how it did. A campaign with no design
 * has no preview to sit beside, so the answer takes the whole row.
 */
export function CampaignOverview({ thumbnail, children }: { readonly thumbnail?: ReactNode; readonly children?: ReactNode }) {
  return (
    <div className="wconvert-campaign-overview" data-preview={thumbnail ? undefined : 'none'}>
      {thumbnail}
      <div className="wconvert-campaign-overview__side">{children}</div>
    </div>
  );
}

/** The sentence saying how a Goal's number is counted, folded into ⓘ (ADR 0183). */
function MeasurementTip({ entry }: { entry: GoalEntry | null }) {
  if (!entry?.outcome) return null;
  return (
    <InfoTip label={sprintf(
      /* translators: %s: what the Goal's number is called, e.g. “Quiz completions”. */
      __('How %s are counted', 'wconvert'), entry.headline_label)}>
      {entry.outcome.measurement}
    </InfoTip>
  );
}

/**
 * What counts as success, for a dialog with no number to put that on: the
 * number's name and ⓘ. The Goal itself is the header's (ADR 0183). While the
 * registry answers it holds its lines; a registry that answered nothing leaves
 * the header to say so.
 */
export function GoalMeasure({ goal }: { readonly goal: Loadable<GoalEntry | null> }) {
  if (goal.status === 'loading') {
    return <div className="wconvert-goal-measure__loading"><LineSkeleton lines={2} status={__('Loading what counts as success…', 'wconvert')} /></div>;
  }
  const entry = goal.status === 'ready' ? goal.data : null;
  if (!entry) return null;
  return (
    <div className="wconvert-goal-measure">
      <Target aria-hidden="true" size={18} />
      <div>
        <span>{__('Counts as success', 'wconvert')}</span>
        <div className="wconvert-goal-measure__name">
          <strong>{entry.headline_label}</strong>
          <MeasurementTip entry={entry} />
        </div>
      </div>
    </div>
  );
}

/**
 * **Campaign details' one body** (ADR 0138), for the list's Details and the
 * editor's alike: anything that needs attention, then the preview with how it
 * did beside it, how it runs, whether its products still exist — then whatever
 * only its host has, then the developer ID.
 *
 * Two dialogs under one name used to show different halves of a campaign:
 * the editor's had the Goal, the list's had How it runs. Each host still owns
 * its header and footer; neither owns these sections.
 */
export function CampaignSummary({ notes = [], thumbnail, goal, goalAction, results, status, howItRuns, productCheck, children, developers }: {
  readonly notes?: readonly string[];
  readonly thumbnail?: ReactNode;
  readonly goal: Loadable<GoalEntry | null>;
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
  // The number the Goal counts says what counts as success; without one to
  // read (a draft, a quiet period, a message) the sentence is said on its own.
  const result = results.status === 'ready' ? results.result : undefined;
  const numberSaysIt = results.status === 'loading' || (result !== undefined && result.counted !== false);
  return <>
    {notes.length > 0 && (
      <div role="note" className="wconvert-campaign-detail__notice">
        {notes.map((note) => <p key={note}>{note}</p>)}
      </div>
    )}
    <CampaignOverview thumbnail={thumbnail}>
      {!numberSaysIt && <GoalMeasure goal={goal} />}
      <Results results={results} status={status} entry={entry} />
      {goalAction}
    </CampaignOverview>
    {howItRuns}
    {productCheck}
    {children}
    {developers}
  </>;
}

/** The host's numbers for this campaign, never a second read. */
function Results({ results, status, entry }: { results: CampaignResults; status: OptinStatus; entry: GoalEntry | null }) {
  const heading = useId();
  // A draft, or a read that recorded nothing, has no period to name.
  const hasPeriod = results.status === 'ready' && results.days > 0;
  const title = results.status === 'ready' && results.days > 0
    ? results.from && results.to
      // Dates someone chose need not end today, so they are not the "last" of anything.
      ? results.custom ? formatRange(results.from, results.to) : sprintf(
          /* translators: 1: the period, e.g. “Last 30 days”. 2: its dates, e.g. “Sep 10 – Oct 9”. */
          __('%1$s · %2$s', 'wconvert'),
          /* translators: %s: how many days the period covers. */
          sprintf(_n('Last %s day', 'Last %s days', results.days, 'wconvert'), formatCount(results.days)),
          formatRange(results.from, results.to),
        )
      : sprintf(/* translators: %s: how many days the period covers. */ _n('Last %s day', 'Last %s days', results.days, 'wconvert'), formatCount(results.days))
    : __('Results', 'wconvert');
  const result = results.status === 'ready' ? results.result : undefined;
  return (
    <section className="wconvert-campaign-overview__results" aria-labelledby={hasPeriod || results.status === 'loading' ? heading : undefined}>
      {(hasPeriod || results.status === 'loading') && <h3 id={heading}>{title}</h3>}
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
          <p role="alert">{__('Results could not load.', 'wconvert')}</p>
          {results.onRetry && <TryAgain onClick={results.onRetry} />}
        </div>
      ) : result ? (
        <div className="wconvert-campaign-detail-stats">
          {/* A message's headline is its appearances, already the Shown tile (ADR 0163). */}
          {/* The first number is what counts as success, so it carries the mark and ⓘ (ADR 0183). */}
          {result.counted !== false && <div>
            <strong>{formatCount(result.count)}</strong>
            <span className="wconvert-campaign-detail-stats__goal">
              <Target aria-hidden="true" size={14} />
              {result.label}
              <MeasurementTip entry={entry} />
            </span>
          </div>}
          <div>
            <strong>{formatCount(result.shown)}</strong>
            <span>{__('Shown', 'wconvert')}</span>
            {/* Submissions with no views read as a fault unless something says why. */}
            {result.shown === 0 && result.count > 0 && (
              <small>{__('Shown counts only the published version.', 'wconvert')}</small>
            )}
          </div>
          {result.counted === false ? <div>
            <strong>—</strong>
            <span>{__('Rate not counted', 'wconvert')}</span>
            <small>{__('A message has nothing to click or submit.', 'wconvert')}</small>
          </div> : <div>
            <strong>{formatRate(result.rate)}</strong>
            {/* The Goal's own word for its rate, e.g. “Quiz completion rate” (ADR 0138). */}
            <span>{entry?.rate_label ?? __('Conversion rate', 'wconvert')}</span>
            {result.rate === null && <small>{__('Shows once it has been shown', 'wconvert')}</small>}
          </div>}
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

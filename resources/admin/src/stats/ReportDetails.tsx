import { useId, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowDown, ArrowUp, Eye, EyeOff, Search, Split } from 'lucide-react';
import { Button } from '../components/ui/button';
import { PickerSearch } from '../discovery/PickerSearch';
import { ListFoot } from '../shell/ListFoot';
import { OptionStrip } from '../shell/OptionStrip';
import { Region, RegionBody, RegionError, TryAgain } from '../shell/Region';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { DataTable, DataTableActions, DataTableActionsColumn, DataTableBody, DataTableCell, DataTableColumn, DataTableHead, DataTableRow } from '../shell/DataTable';
import { EmptyState } from '../shell/EmptyState';
import { Toolbar } from '../shell/Toolbar';
import { messageOf } from '../shell/loadable';
import { StatusBadge } from '../optins/StatusBadge';
import { decisionCopy } from '../optins/decisionCopy';
import type { OptinStatus } from '../optins/api';
import {
  destinationHref,
  editorHref,
  leadsHref,
  reportHref,
  type ReportQuery,
} from '../nav';
import { publishOptin, unpublishOptin, declareWinner } from '../optins/api';
import { adminSettings } from '../settings';
import { periodOf, type DashboardPayload, type GoalReport, type Numbers, type OptinReport } from './api';
import { formatCount, formatRate } from './format';
import { countsNothing } from '../goals/countsNothing';
import { formatDecimal } from '../lib/format';
import { families, rangeLabel } from './reporting';
import { ActivityChart } from './ActivityChart';
import { withValue } from './Insights';
import { ReportTarget } from './ReportNavigation';

/**
 * The report's three states in the campaign list's words (GUIDELINES §20): a
 * campaign that is no longer published is a Draft, and one kept only for its
 * results is Deleted. The report's own keys never reach the screen.
 */
const STATUS: Record<OptinReport['status'], OptinStatus> = {
  published: 'published',
  paused: 'draft',
  historical: 'deleted',
};

/** A figure's move against the previous period, and the words to write it in. */
export type PeriodChange = { text: string; direction: 'up' | 'down' | 'flat' | 'new' };

const directionOf = (move: number): PeriodChange['direction'] => (move === 0 ? 'flat' : move > 0 ? 'up' : 'down');

/**
 * A change against the previous period, as a percentage and a direction — or
 * "New this period" from nothing, and nothing at all for nothing → nothing,
 * because "No change" under a zero says nothing a merchant can use (ADR 0132).
 * A change that rounds to 0% is flat: an arrow on it would claim a move the
 * figure denies.
 */
export function changeOf(current: number, previous: number): PeriodChange | null {
  if (previous === 0)
    return current === 0 ? null : { text: __('New this period', 'wconvert'), direction: 'new' };
  const delta = (current - previous) / previous;
  return { text: formatRate(Math.abs(delta)), direction: directionOf(Math.round(delta * 1000)) };
}

/**
 * The rate's change in percentage points, because a percentage of a percentage
 * reads as nonsense, or nothing when either rate is missing: nothing shown is
 * no rate at all, not 0% (ADR 0185).
 */
export function rateChange(current: number | null, previous: number | null): PeriodChange | null {
  if (current === null || previous === null) return null;
  const points = Math.round((current - previous) * 1000) / 10;
  return {
    text: sprintf(
      /* translators: %s: a difference between two rates in percentage points, e.g. “0.6”. */
      __('%s pts', 'wconvert'),
      formatDecimal(Math.abs(points)),
    ),
    direction: directionOf(points),
  };
}

/**
 * The one way a change is drawn: green up, red down, always with an arrow and
 * the number, so colour is never the only signal, and words for a screen reader
 * (ADR 0185, §5). No change and a first period have no direction, so they stay
 * neutral with no arrow.
 */
export function ChangeValue({ change }: { change: PeriodChange }) {
  const { direction, text } = change;
  if (direction !== 'up' && direction !== 'down') return <span className="wa-change-value">{text}</span>;
  const Arrow = direction === 'up' ? ArrowUp : ArrowDown;
  return (
    <span className={`wa-change-value wa-change-${direction}`}>
      <Arrow aria-hidden="true" />
      <span className="sr-only">{direction === 'up' ? __('Up', 'wconvert') : __('Down', 'wconvert')}</span>
      {text}
    </span>
  );
}

function ChangeLine({ change }: { change: PeriodChange }) {
  return (
    <span className="wa-change">
      {change.direction === 'new'
        ? <ChangeValue change={change} />
        : withValue(/* translators: %s: a change against the previous period, e.g. “12%”. */ __('%s vs previous period', 'wconvert'), <ChangeValue change={change} />)}
    </span>
  );
}

/** A count's change against the previous period, or why there is none. */
export function Change({
  current,
  previous,
}: {
  current: number;
  previous?: number;
}) {
  if (previous === undefined)
    return (
      <span className="wa-change">
        {__('Comparison unavailable', 'wconvert')}
      </span>
    );
  const change = changeOf(current, previous);
  return change && <ChangeLine change={change} />;
}

/**
 * Below this many times shown per variant, a difference in rate is mostly
 * noise. A plain threshold, not a significance test: the line it guards never
 * names a winner (ADR 0089), it says whether there is enough to look at.
 */
export const ENOUGH_SHOWN_PER_VARIANT = 1000;

/** Best rate first; a variant never shown in these dates has no rate and goes last. */
export const bestFirst = (arms: OptinReport[]): OptinReport[] =>
  [...arms].sort((a, b) => (b.conversion_rate ?? -1) - (a.conversion_rate ?? -1));

/** One sentence that reads two variants against each other, with how far to trust it. */
function VariantDifference({ arms }: { arms: OptinReport[] }) {
  const [lead, next] = arms.filter((arm) => arm.conversion_rate !== null);
  if (!lead || !next)
    return (
      <p className="wa-variant-difference">
        {__('Too early to call: a variant has not been shown in these dates.', 'wconvert')}
      </p>
    );
  const points = (lead.conversion_rate! - next.conversion_rate!) * 100;
  const difference =
    points === 0
      ? sprintf(
          /* translators: 1, 2: variant names, 3: their shared rate. */
          __('%1$s and %2$s both convert %3$s', 'wconvert'),
          lead.name,
          next.name,
          formatRate(lead.conversion_rate),
        )
      : sprintf(
          /* translators: 1: leading variant, 2: its rate, 3: next variant, 4: its rate, 5: the difference in percentage points. */
          __('%1$s converts %2$s vs %3$s %4$s (+%5$s pts)', 'wconvert'),
          lead.name,
          formatRate(lead.conversion_rate),
          next.name,
          formatRate(next.conversion_rate),
          formatDecimal(points),
        );
  const enough =
    lead.impressions >= ENOUGH_SHOWN_PER_VARIANT && next.impressions >= ENOUGH_SHOWN_PER_VARIANT;
  return (
    <p className="wa-variant-difference">
      {sprintf(
        /* translators: 1: the difference between two variants, 2: how far to trust it. */
        __('%1$s — %2$s', 'wconvert'),
        difference,
        enough
          ? __('enough traffic to compare; this is still not proof.', 'wconvert')
          : sprintf(
              /* translators: %s: a number of times shown, e.g. “1,000”. */
              __('too early to call: fewer than %s shown per variant', 'wconvert'),
              formatCount(ENOUGH_SHOWN_PER_VARIANT),
            ),
      )}
    </p>
  );
}
function Status({ value }: { value: OptinReport['status'] }) {
  return <StatusBadge status={STATUS[value]} />;
}
function Totals({
  card,
  numbers,
  previous,
}: {
  card: GoalReport;
  numbers: Numbers;
  previous?: Numbers;
}) {
  // A message's result is its Impressions, already the Shown tile (ADR 0163).
  const message = countsNothing(card);
  const rateMove = previous && !message ? rateChange(numbers.conversion_rate, previous.conversion_rate) : null;
  return (
    <dl className="wa-numbers">
      {!message && <div>
        <dt>{card.result_label}</dt>
        <dd>{formatCount(numbers.conversions)}</dd>
        {previous && (
          <Change
            current={numbers.conversions}
            previous={previous.conversions}
          />
        )}
      </div>}
      <div>
        <dt>{__('Shown', 'wconvert')}</dt>
        <dd>{formatCount(numbers.impressions)}</dd>
        {previous && (
          <Change
            current={numbers.impressions}
            previous={previous.impressions}
          />
        )}
      </div>
      <div>
        <dt>
          {card.rate_label}
        </dt>
        <dd>{formatRate(numbers.conversion_rate)}</dd>
        {rateMove && <ChangeLine change={rateMove} />}
      </div>
    </dl>
  );
}
type DetailProps = {
  card: GoalReport;
  optin?: OptinReport;
  previous?: GoalReport;
  payload: DashboardPayload;
  query: ReportQuery;
  disabled: boolean;
  onRefresh: () => void;
};
export function GoalDetail({
  card,
  optin,
  previous,
  payload,
  query,
  disabled,
  onRefresh,
}: DetailProps) {
  const numbers = optin ?? card;
  const prior = optin
    ? previous?.optins.find((o) => o.id === optin.id)
    : previous;
  const family = optin
    ? families(card).find((f) => f.arms.some((a) => a.id === optin.id))
    : undefined;
  return (
    <section aria-label={optin?.name ?? card.label}>
      <div className="wa-detail-heading">
        <div>
          <p className="wa-eyebrow">
            {optin ? card.label : __('Goal report', 'wconvert')}
          </p>
          <h2><bdi>{optin?.name ?? card.label}</bdi></h2>
        </div>
        {optin && <Status value={optin.status} />}
      </div>
      <p className="wa-muted">
        {numbers.deliveries === null
          ? card.measurement
          : __(
              'Resource requests count submitted forms. Email handoffs are reported separately below; neither count proves inbox arrival.',
              'wconvert',
            )}
      </p>
      {optin?.status === 'published' && optin.published_at && optin.published_at.slice(0, 10) > payload.to && numbers.impressions === 0 && (
        <p className="wa-notice">{__('Published after these report dates. New activity appears after each day ends.', 'wconvert')}</p>
      )}
      {optin?.status === 'paused' && (
        <p className="wa-notice">
          {__(
            'This campaign is a draft, so it is not shown. Its earlier results are below.',
            'wconvert',
          )}
        </p>
      )}
      {optin?.status === 'historical' && (
        <p className="wa-notice">
          {__(
            'This campaign was deleted. Its results stay here, and it can no longer be edited.',
            'wconvert',
          )}
        </p>
      )}
      <ReportTarget name="performance" label={__('Performance', 'wconvert')}>
      <div className="wa-panel">
        <Totals card={card} numbers={numbers} previous={prior} />
        <ActivityChart
          key={optin?.id ?? card.goal}
          label={card.result_label}
          numbers={numbers}
          previous={prior}
          partialDay={payload.complete_days === false ? payload.today : undefined}
          today={payload.today}
        />
        {!optin && <Reconciliation card={card} />}
      </div>
      </ReportTarget>
      {card.action === 'add_to_cart' && <div className="wa-panel wa-handoff">
        <div><h3>{__('Items added to basket', 'wconvert')}</h3><p className="wa-muted">{__('All confirmed additions. Adding two extras counts twice here and once in Basket additions. These are not purchases.', 'wconvert')}</p></div>
        <strong>{formatCount(numbers.items_added ?? 0)}</strong>
      </div>}
      {numbers.deliveries !== null && (
        <div className="wa-panel wa-handoff">
          <div>
            <p className="wa-eyebrow">{__('After submission', 'wconvert')}</p>
            <h3>{__('Email handoffs', 'wconvert')}</h3>
            <p className="wa-muted">
              {__(
                'Sends can land on a later day and resends count again, so a difference is not a queue or failure count.',
                'wconvert',
              )}
            </p>
          </div>
          <div>
            <strong>{formatCount(numbers.deliveries)}</strong>
            <span>{__('Emails accepted for sending', 'wconvert')}</span>
          </div>
          <Button asChild variant="outline">
            <a href={destinationHref()}>
              {__('Review destinations', 'wconvert')}
            </a>
          </Button>
        </div>
      )}
      {family && family.arms.length > 1 && (
        <div className="wa-notice wa-experiment-link">
          <div>
            <b>{__('A/B comparison and variant history', 'wconvert')}</b>
            <p>
              {__(
                'Each variant has its own results, counted once in these totals.',
                'wconvert',
              )}
            </p>
          </div>
          <Button asChild variant="outline">
            <a
              href={reportHref({
                ...periodOf(payload),
                goal: card.goal,
                experiment: family.root.id,
                compare: query.compare,
              })}
            >
              <Split aria-hidden="true" />
              {__('Compare variants', 'wconvert')}
            </a>
          </Button>
        </div>
      )}
      {optin ? (
        <CampaignActions
          optin={optin}
          card={card}
          payload={payload}
          query={query}
          disabled={disabled}
          onRefresh={onRefresh}
        />
      ) : (
        <ReportTarget name="campaigns" label={__('Campaigns', 'wconvert')}>
          <div className="wa-section-heading">
            <h3>{__('Campaign contributions', 'wconvert')}</h3>
          </div>
          <CampaignTable cards={[card]} payload={payload} query={query} />
        </ReportTarget>
      )}
    </section>
  );
}
function Reconciliation({ card }: { card: GoalReport }) {
  return (
    <div className="wa-reconciliation">
      {(['published', 'paused', 'historical'] as const).map((status) => {
        const rows = card.optins.filter((o) => o.status === status);
        return (
          rows.length > 0 && (
            <span key={status}>
              <b>{formatCount(rows.reduce((n, o) => n + o.conversions, 0))}</b>{' '}
              {status === 'published'
                ? __('from published campaigns', 'wconvert')
                : status === 'paused'
                  ? __('from draft campaigns', 'wconvert')
                  : __('from deleted campaigns', 'wconvert')}
            </span>
          )
        );
      })}
      <small>
        {__(
          'Includes each variant once. Status describes the campaign now, not when the action happened.',
          'wconvert',
        )}
      </small>
    </div>
  );
}
export function CampaignTable({
  cards,
  payload,
  query,
}: {
  cards: GoalReport[];
  payload: DashboardPayload;
  query: ReportQuery;
}) {
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState<'all' | OptinReport['status']>('all');
  const all = cards.flatMap((card) => families(card).map((family) => ({ card, ...family })));
  const groups = all.filter((f) =>
    f.arms.some(
      (a) =>
        a.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
        (status === 'all' || a.status === status),
    ),
  );
  const filters = [
    ['all', __('All', 'wconvert')],
    ['published', __('Published', 'wconvert')],
    ['paused', __('Drafts', 'wconvert')],
    ['historical', __('Deleted', 'wconvert')],
  ] as const;
  return (
    <Region label={__('Campaign contributions', 'wconvert')} className="wa-campaigns">
      <Toolbar>
        <PickerSearch label={__('Search campaigns', 'wconvert')} value={search} onChange={setSearch} />
        <OptionStrip
          label={__('Filter campaigns by status', 'wconvert')}
          value={status}
          onChange={(value) => setStatus(value as typeof status)}
          // As on Campaigns: a status nothing is in filters nothing, so only All
          // and the statuses in use are offered, and the selected one (§20).
          options={filters
            .map(([id, label]) => ({
              value: id,
              label,
              count: all.filter((f) => id === 'all' || f.arms.some((a) => a.status === id)).length,
            }))
            .filter((option) => option.value === 'all' || option.value === status || option.count !== 0)}
        />
      </Toolbar>
      {groups.length === 0 ? (
        <EmptyState
          icon={Search}
          title={__('No campaigns found', 'wconvert')}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setStatus('all');
              }}
            >
              {__('Clear filters', 'wconvert')}
            </Button>
          }
        >
          {__('Try another name or clear your filters.', 'wconvert')}
        </EmptyState>
      ) : (
        <>
        <DataTable label={__('Campaign contributions', 'wconvert')}>
          <DataTableHead>
            <DataTableColumn>{__('Campaign', 'wconvert')}</DataTableColumn>
            {cards.length > 1 && <DataTableColumn>{__('Goal', 'wconvert')}</DataTableColumn>}
            <DataTableColumn>{__('Status', 'wconvert')}</DataTableColumn>
            <DataTableColumn numeric>{__('Results', 'wconvert')}</DataTableColumn>
            <DataTableColumn numeric>{__('Shown', 'wconvert')}</DataTableColumn>
            <DataTableColumn numeric>{__('Rate', 'wconvert')}</DataTableColumn>
            <DataTableActionsColumn>{__('Actions', 'wconvert')}</DataTableActionsColumn>
          </DataTableHead>
          <DataTableBody>
            {groups.map(({ card, root, arms, numbers }) => (
              <DataTableRow key={root.id}>
                <DataTableCell label={__('Campaign', 'wconvert')}>
                  <a
                    className="wa-campaign-name"
                    href={reportHref({
                      ...periodOf(payload),
                      goal: card.goal,
                      ...(arms.length > 1
                        ? { experiment: root.id }
                        : { optinId: root.id }),
                      compare: query.compare,
                    })}
                  >
                    <bdi>{root.name}</bdi>
                  </a>
                  {arms.length > 1 && (
                    <small className="wa-cell-note">
                      {__('Includes variant history', 'wconvert')}
                    </small>
                  )}
                </DataTableCell>
                {cards.length > 1 && (
                  <DataTableCell label={__('Goal', 'wconvert')}>{card.label}</DataTableCell>
                )}
                <DataTableCell label={__('Status', 'wconvert')}>
                  <Status value={root.status} />
                </DataTableCell>
                <DataTableCell label={__('Results', 'wconvert')} numeric>
                  {formatCount(countsNothing(card) ? numbers.impressions : numbers.conversions)}
                  <small className="wa-cell-note">{card.result_label}</small>
                </DataTableCell>
                <DataTableCell label={__('Shown', 'wconvert')} numeric>
                  {formatCount(numbers.impressions)}
                </DataTableCell>
                <DataTableCell label={__('Rate', 'wconvert')} numeric>
                  {formatRate(numbers.conversion_rate)}
                </DataTableCell>
                <DataTableActions>
                  {arms.length > 1 && (
                    <Button asChild variant="ghost" size="icon-sm">
                      <a
                        aria-label={sprintf(/* translators: %s: a campaign's name. */ __('Compare variants of %s', 'wconvert'), root.name)}
                        title={sprintf(/* translators: %s: a campaign's name. */ __('Compare variants of %s', 'wconvert'), root.name)}
                        href={reportHref({
                          ...periodOf(payload),
                          experiment: root.id,
                          compare: query.compare,
                        })}
                      >
                        <Split aria-hidden="true" />
                      </a>
                    </Button>
                  )}
                </DataTableActions>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
        <ListFoot
          count={sprintf(
            /* translators: %s: how many campaigns are listed. */
            _n('%s campaign', '%s campaigns', groups.length, 'wconvert'),
            formatCount(groups.length),
          )}
          dates={rangeLabel(payload.from, payload.to)}
        />
        </>
      )}
    </Region>
  );
}
function CampaignActions({
  optin,
  card,
  payload,
  query,
  disabled,
  onRefresh,
}: DetailProps & { optin: OptinReport }) {
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const reason = useId();
  const draft = optin.status === 'paused';
  // One decision, one wording: the campaign list asks this question too (ADR 0137).
  const words = decisionCopy(draft ? 'publish' : 'pause', optin.parent_id !== null, optin.name, 0);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (draft) await publishOptin(optin.id);
      else await unpublishOptin(optin.id);
      onRefresh();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };
  // A deleted campaign with no submissions to open has nothing to act on, and an empty card says nothing.
  if (card.action !== 'submit' && optin.status === 'historical') return null;
  return (
    <>
      <Region label={__('Campaign actions', 'wconvert')} className="wa-panel wa-campaign-actions">
      {error && <RegionError message={error} action={<TryAgain busy={busy} onClick={() => void run()} />} />}
      <RegionBody>
      <div className="wa-actions">
        {card.action === 'submit' &&
          (payload.days === 0 ? (
            // Refused, not busy: it keeps focus so the reason is reachable (§14).
            <Button variant="outline" aria-disabled="true" aria-describedby={reason}>
              {__('View submissions', 'wconvert')}
            </Button>
          ) : (
            <Button asChild variant="outline">
              <a
                href={leadsHref({
                  optinId: optin.id,
                  from: payload.from,
                  to: payload.to,
                })}
              >
                {__('View submissions', 'wconvert')}
              </a>
            </Button>
          ))}
        {optin.status !== 'historical' && (
          <>
            <Button asChild variant="outline">
              <a href={editorHref(optin.id, reportHref(query))}>
                {__('Open editor', 'wconvert')}
              </a>
            </Button>
            <Button
              ref={trigger}
              variant="outline"
              disabled={busy || disabled}
              onClick={() => setConfirm(true)}
            >
              {/* Publish state, not a pause: the badge then reads Draft (ADR 0132). */}
              {draft ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
              {busy
                ? draft
                  ? __('Publishing…', 'wconvert')
                  : __('Unpublishing…', 'wconvert')
                : words.confirmLabel}
            </Button>
          </>
        )}
      </div>
      {card.action === 'submit' && payload.days === 0 && (
        <p id={reason} className="wa-muted mb-0 mt-3">
          {__('Submissions open once this month has a complete day.', 'wconvert')}
        </p>
      )}
      </RegionBody>
      </Region>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={words.title}
        description={words.description}
        confirmLabel={words.confirmLabel}
        onConfirm={() => {
          void run();
        }}
        returnFocusTo={trigger}
      />
    </>
  );
}
export function Experiment({
  card,
  optin,
  previous,
  payload,
  query,
  disabled,
  onRefresh,
}: DetailProps & { optin: OptinReport }) {
  const family = families(card).find((f) =>
    f.arms.some((a) => a.id === optin.id),
  );
  const [chosen, setChosen] = useState<OptinReport | null>(null),
    [busy, setBusy] = useState(false),
    // Which variant's choice failed: the failure is drawn on that variant's card.
    [failure, setFailure] = useState<{ arm: OptinReport; message: string } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  if (!family || family.arms.length < 2)
    return (
      <p className="wa-notice">
        {__(
          'No variant comparison is available for this campaign.',
          'wconvert',
        )}
      </p>
    );
  const arms = bestFirst(family.arms);
  const live = family.arms.filter((a) => a.status !== 'historical');
  const canChoose =
    adminSettings()?.variants?.availability === 'ready' &&
    live.length > 1 &&
    family.root.status !== 'historical';
  const words = decisionCopy('winner', true, chosen?.name ?? '', 0);
  const choose = async (arm: OptinReport) => {
    setBusy(true);
    setFailure(null);
    try {
      await declareWinner(family.root.id, arm.id);
      onRefresh();
    } catch (cause) {
      setFailure({ arm, message: messageOf(cause) });
    } finally {
      setBusy(false);
      setChosen(null);
    }
  };
  return (
    <section>
      <div className="wa-intro">
        <p className="wa-eyebrow">
          {__('A/B comparison and variant history', 'wconvert')}
        </p>
        <h2><bdi>{family.root.name}</bdi></h2>
        <p className="wa-muted">
          {__(
            'Results cover the selected dates, including past uses of each design. They do not prove a winner.',
            'wconvert',
          )}
        </p>
      </div>
      <VariantDifference arms={arms} />
      <div className="wa-experiment-grid">
        {arms.map((arm) => (
          <div className="wa-panel wa-arm" key={arm.id}>
            {failure?.arm.id === arm.id && <RegionError message={failure.message} action={<TryAgain busy={busy} onClick={() => void choose(arm)} />} />}
            <div className="wa-detail-heading">
              <h3><bdi>{arm.name}</bdi></h3>
              <Status value={arm.status} />
            </div>
            <Totals
              card={card}
              numbers={arm}
              previous={previous?.optins.find((row) => row.id === arm.id)}
            />
            <div className="wa-actions">
              <Button asChild variant="outline">
                <a
                  href={reportHref({
                    ...periodOf(payload),
                    goal: card.goal,
                    optinId: arm.id,
                    compare: query.compare,
                  })}
                >
                  {__('View report', 'wconvert')}
                </a>
              </Button>
              {canChoose && arm.status !== 'historical' && (
                <Button
                  variant="outline"
                  disabled={busy || disabled}
                  onClick={(e) => {
                    trigger.current = e.currentTarget;
                    setChosen(arm);
                  }}
                >
                  {__('Use this variant', 'wconvert')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="wa-notice">
        {__(
          'Each variant counts once in goal totals. Visitors are assigned per browser, not per person.',
          'wconvert',
        )}
      </p>
      <ConfirmDialog
        open={chosen !== null}
        onOpenChange={(open) => {
          if (!open) setChosen(null);
        }}
        title={words.title}
        description={words.description}
        confirmLabel={words.confirmLabel}
        onConfirm={() => {
          if (chosen) void choose(chosen);
        }}
        returnFocusTo={trigger}
      />
    </section>
  );
}

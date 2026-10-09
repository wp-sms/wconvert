import { ReportNavigationProvider, ReportShortcuts, useReportJump } from './ReportNavigation';
import { DeliveryAttention } from './DeliveryAttention';
import { CommerceReport, type CommerceSummary } from './extensions';
import { Interests } from './Interests';
import { Insights } from './Insights';
import { ProductActivityReport } from './ProductActivityReport';
import { JourneyReport } from './JourneyReport';
import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  Download,
  Mail,
  MousePointerClick,
  ChartColumn,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { PageAction } from '../shell/PageActions';
import { PageError, Region, RegionErrorState } from '../shell/Region';
import { Disclosure } from '../shell/Disclosure';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { StatRowSkeleton } from '../shell/Stat';
import { EmptyState } from '../shell/EmptyState';
import { CheckRow } from '../shell/CheckRow';
import { DateRangePicker, type DatePreset, type DateRange } from '../shell/DateRangePicker';
import {
  LOADING,
  failed,
  messageOf,
  ready,
  type Loadable,
} from '../shell/loadable';
import { createHref, reportHref, type ReportQuery } from '../nav';
import { siteToday } from '../leads/calendar';
import { formatMoney } from '../lib/format';
import { periodOf, readReport, type DashboardPayload, type PeriodQuery } from './api';
import { formatCount, formatRate } from './format';
import { chooseToday, families, rangeLabel, reportCSV, todayAppearsTomorrow } from './reporting';
import { CampaignTable, Change, changeOf, Experiment, GoalDetail } from './ReportDetails';
import './analytics.css';
import {
  MonthlyTargets,
  useMonthlyTargets,
  type TargetReference,
} from './MonthlyTargets';

/**
 * Analytics opens on the last 30 complete days, and asks for them by name: the
 * picker shows the window being read, so the bundle cannot leave the length
 * to a server default it would then have to guess (ADR 0132).
 */
const DEFAULT_DAYS = 30;
/** `StatRange::MAX_DAYS`, the longest custom range the server reads. */
const MAX_DAYS = 366;
const PRESETS: readonly DatePreset[] = ['today', 'yesterday', '7', '30', '90', 'this_month', 'last_month'];
/** Every preset but Today, This month and Last month is a count of complete days. */
const ROLLING: Partial<Record<DatePreset, number>> = { yesterday: 1, '7': 7, '30': 30, '90': 90 };

const monthOf = (day: string) => day.slice(0, 7);
const monthBefore = (day: string) => {
  const first = new Date(`${monthOf(day)}-01T12:00:00Z`);
  first.setUTCMonth(first.getUTCMonth() - 1);
  return first.toISOString().slice(0, 7);
};
const monthEnd = (month: string) => {
  const last = new Date(`${month}-01T12:00:00Z`);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
};

/** The window a route names, in the precedence `ReportQuery` documents. */
function windowOf(query: ReportQuery): PeriodQuery {
  if (query.today) return { today: true };
  if (query.from !== undefined && query.to !== undefined) return { from: query.from, to: query.to };
  if (query.month) return { month: query.month };
  return { days: query.days ?? DEFAULT_DAYS };
}

const withoutWindow = (query: ReportQuery): ReportQuery => ({
  ...query, today: undefined, from: undefined, to: undefined, month: undefined, days: undefined,
});

/**
 * How the picker reads a window. A bookmarked month that is neither this nor
 * last month, or a length no preset names, reads as its dates.
 */
function rangeOf(query: PeriodQuery, today: string | null, payload: DashboardPayload | null): DateRange {
  if (query.today) return { preset: 'today' };
  if (query.from !== undefined && query.to !== undefined) return { preset: 'custom', from: query.from, to: query.to };
  if (query.month) {
    if (today && query.month === monthOf(today)) return { preset: 'this_month' };
    if (today && query.month === monthBefore(today)) return { preset: 'last_month' };
    return { preset: 'custom', from: `${query.month}-01`, to: monthEnd(query.month) };
  }
  const days = query.days ?? DEFAULT_DAYS;
  const preset = (Object.keys(ROLLING) as DatePreset[]).find((key) => ROLLING[key] === days);
  return preset ? { preset } : { preset: 'custom', from: payload?.from ?? '', to: payload?.to ?? '' };
}

/**
 * A choice as a route names it. Months come from the server's `today` when a
 * report has loaded, and the site's timezone otherwise — never the browser's.
 */
function queryOf(range: DateRange, today: string | null): PeriodQuery {
  switch (range.preset) {
    case 'today': return { today: true };
    case 'custom': return { from: range.from, to: range.to };
    case 'this_month': return today ? { month: monthOf(today) } : { days: DEFAULT_DAYS };
    case 'last_month': return today ? { month: monthBefore(today) } : { days: DEFAULT_DAYS };
    default: return { days: ROLLING[range.preset] ?? DEFAULT_DAYS };
  }
}

const periodLabel = (days: number) =>
  days === 1
    ? __('Yesterday', 'wconvert')
    : sprintf(
        _n('Last %s complete day', 'Last %s complete days', days, 'wconvert'),
        formatCount(days),
      );

/** What the targets editor reads a field against: the window this report counted. */
function referenceOf(payload: DashboardPayload): TargetReference | undefined {
  if (payload.days === 0) return undefined;
  const window = periodOf(payload);
  const label = window.today
    ? __('Today so far', 'wconvert')
    : window.days !== undefined
      ? periodLabel(window.days)
      : rangeLabel(payload.from, payload.to);
  return { label, counts: Object.fromEntries(payload.impact.map((item) => [item.id, item.count])) };
}

export function Dashboard(props: { query?: ReportQuery; onQueryChange?: (query: ReportQuery) => void } = {}) {
  return <ReportNavigationProvider><DashboardContent {...props} /></ReportNavigationProvider>;
}

function DashboardContent({
  query,
  onQueryChange,
}: { query?: ReportQuery; onQueryChange?: (query: ReportQuery) => void } = {}) {
  const [localQuery, setLocalQuery] = useState<ReportQuery>({});
  const selection = query ?? localQuery;
  const change = (next: ReportQuery) =>
    onQueryChange ? onQueryChange(next) : setLocalQuery(next);
  const [report, setReport] = useState<Loadable<DashboardPayload>>(LOADING);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [retry, setRetry] = useState(0);
  const [sales, setSales] = useState<CommerceSummary | null>(null);
  useEffect(() => {
    let active = true;
    setUpdating(true);
    readReport(windowOf({ today: selection.today, from: selection.from, to: selection.to, month: selection.month, days: selection.days }))
      .then((data) => {
        if (active) {
          setReport(ready(data));
          setRefreshError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setReport((current) =>
            current.status === 'ready' ? current : failed(cause),
          );
          setRefreshError(messageOf(cause));
        }
      })
      .finally(() => {
        if (active) setUpdating(false);
      });
    return () => {
      active = false;
    };
  }, [selection.today, selection.from, selection.to, selection.month, selection.days, retry]);
  const payload = report.status === 'ready' ? report.data : null;
  // Links, insights and per-campaign reports follow the window that LOADED.
  const accepted: ReportQuery = payload
    ? { ...withoutWindow(selection), ...periodOf(payload) }
    : selection;
  const live = payload ? periodOf(payload).today === true : selection.today === true;
  const compare = selection.compare !== false && !live;
  // Nothing earlier anywhere is one note, not a "New this period" on every card.
  const comparable = payload?.previous?.impact.some((item) => item.count > 0) ?? false;
  const focusedId = selection.optinId ?? selection.experiment;
  const card = payload?.goals.find((g) =>
    focusedId
      ? g.optins.some((o) => o.id === focusedId)
      : g.goal === selection.goal,
  );
  const optin = card?.optins.find((o) => o.id === focusedId);
  const impact = payload?.impact.find((i) => i.id === selection.impact);
  const overview = !focusedId && !selection.goal && !selection.impact;
  const targets = useMonthlyTargets(overview);
  const scopedCards = card
    ? [card]
    : impact
      ? (payload?.goals.filter((g) => impact.goals.includes(g.goal)) ?? [])
      : (payload?.goals ?? []);
  const previous = compare && comparable ? payload?.previous : undefined;
  const insightIds = new Set(scopedCards.flatMap(g => g.optins.filter(o => !focusedId || (selection.experiment ? families(g).find(f => f.arms.some(a => a.id === focusedId))?.arms.some(a => a.id === o.id) : o.id === focusedId)).map(o => o.id)));
  const insights = (payload?.insights ?? []).filter(item => (overview || insightIds.has(item.optin_id)) && (compare || item.rule_id === 'no_appearances'));
  const priorCard = previous?.goals.find((g) => g.goal === card?.goal);
  const hasGoals = !payload || payload.goals.length > 0;
  // The picker never shows a window that is not on screen (ADR 0132): while a
  // choice loads it names the choice without dates; after a failed change it
  // names the window still shown, with that window's dates.
  const today = payload?.today ?? siteToday();
  const showingAccepted = payload !== null && refreshError !== null && !updating;
  const pickerValue = rangeOf(showingAccepted ? periodOf(payload) : windowOf(selection), today, payload);
  const pickerLive = pickerValue.preset === 'today';
  const summary =
    !payload || updating
      ? null
      : payload.days === 0
        ? __('No complete days yet this month', 'wconvert')
        : live
          ? sprintf(__('%s so far', 'wconvert'), rangeLabel(payload.from, payload.to))
          : rangeLabel(payload.from, payload.to);
  const exportReport = () => {
    if (!payload) return;
    const exportCards =
      selection.experiment && card && optin
        ? [
            {
              ...card,
              optins:
                families(card).find((family) =>
                  family.arms.some((arm) => arm.id === optin.id),
                )?.arms ?? [],
            },
          ]
        : scopedCards;
    const csv = reportCSV(
      compare ? payload : { ...payload, previous: undefined },
      exportCards,
      selection.optinId,
    );
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `wconvert-${payload.from}-${payload.to}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const priorCount = (id: string) => payload?.previous?.impact.find((p) => p.id === id)?.count ?? 0;
  return (
    <div className="wconvert-analytics">
      <PageAction>
        <div className="wa-header-actions">
          <DateRangePicker
            key={pickerValue.preset === 'custom' ? `${pickerValue.from}:${pickerValue.to}` : 'preset'}
            label={__('Report period', 'wconvert')}
            value={pickerValue}
            presets={today ? PRESETS : PRESETS.filter((preset) => preset !== 'this_month' && preset !== 'last_month')}
            summary={summary}
            today={today}
            maxDays={MAX_DAYS}
            onChange={(range) => change({ ...withoutWindow(selection), ...queryOf(range, today) })}
            footer={
              hasGoals && (
                // Refused, not hidden, for Today: it keeps focus so the reason is reachable (§14).
                <CheckRow
                  className="wa-compare-row"
                  label={__('Compare with the previous period', 'wconvert')}
                  hint={
                    pickerLive
                      ? __('Today is still in progress.', 'wconvert')
                      : payload?.previous && !updating
                        ? rangeLabel(payload.previous.from, payload.previous.to)
                        : undefined
                  }
                  checked={selection.compare !== false && !pickerLive}
                  aria-disabled={pickerLive || undefined}
                  // The handler declines; React puts the controlled box back.
                  onChange={(event) => {
                    if (!pickerLive) change({ ...selection, compare: event.target.checked });
                  }}
                />
              )
            }
          />
          {hasGoals && (
            <Button
              variant="outline"
              disabled={!payload || updating || payload.days === 0}
              onClick={exportReport}
            >
              <Download aria-hidden="true" />
              {__('Export CSV', 'wconvert')}
            </Button>
          )}
        </div>
      </PageAction>
      {payload && <ReportShortcuts />}
      {updating && payload && (
        <p className="wa-muted" role="status">
          {__('Updating report…', 'wconvert')}
        </p>
      )}
      {refreshError && payload && (
        <PageError
          message={sprintf(
            __(
              'Could not load that period. Showing the last report and its dates. %s',
              'wconvert',
            ),
            refreshError,
          )}
          onRetry={() => setRetry((n) => n + 1)}
        />
      )}
      {report.status === 'failed' && (
        <Region label={__('Analytics', 'wconvert')}>
          <RegionErrorState
            message={report.message}
            onRetry={() => setRetry((n) => n + 1)}
          />
        </Region>
      )}
      {report.status === 'loading' && (
        <RegionSkeleton label={__('Analytics', 'wconvert')}>
          <StatRowSkeleton stats={4} />
        </RegionSkeleton>
      )}
      {payload && compare && payload.previous && !comparable && payload.goals.length > 0 && (
        <p className="wa-muted wa-compare-note">
          {sprintf(
            __('Nothing to compare in %s.', 'wconvert'),
            rangeLabel(payload.previous.from, payload.previous.to),
          )}
        </p>
      )}
      {payload && !overview && (
        <a
          className="wa-back"
          href={reportHref({
            ...periodOf(payload),
            compare: selection.compare,
          })}
        >
          <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
          {__('Overall impact', 'wconvert')}
        </a>
      )}
      {payload && payload.goals.length === 0 && overview ? (
        // Nothing to target, sell or compare yet: the one way forward is a campaign (ADR 0132).
        <Region>
          <EmptyState
            icon={ChartColumn}
            title={__(
              'Your first results start with a live campaign',
              'wconvert',
            )}
            action={
              <Button asChild>
                <a href={createHref()}>{__('Create campaign', 'wconvert')}</a>
              </Button>
            }
          >
            {__(
              'Publish a campaign and its results appear here.',
              'wconvert',
            )}
          </EmptyState>
        </Region>
      ) : payload && overview ? (
        <>
          {/* Current sending status comes before the window's numbers: "is anything broken" is asked first. */}
          <DeliveryAttention />
          <section className="wa-impact-grid" aria-label={__('Overall impact', 'wconvert')}>
            {/* One rule for every impact: no goal, no count and nothing earlier is no card (ADR 0116). */}
            {payload.impact.filter((item) => item.goals.length > 0 || item.count > 0 || priorCount(item.id) > 0).map((item, index) => (
              <a
                key={item.id}
                className={`wa-impact ${index === 0 ? 'wa-impact-primary' : ''}`}
                href={reportHref({
                  ...periodOf(payload),
                  impact: item.id,
                  compare: selection.compare,
                })}
              >
                <span className="wa-impact-label">
                  {item.label}
                  <ArrowUpRight aria-hidden="true" className="rtl:-scale-x-100" />
                </span>
                <strong>{formatCount(item.count)}</strong>
                {previous && (
                  <Change
                    current={item.count}
                    previous={
                      previous.impact.find((p) => p.id === item.id)?.count
                    }
                  />
                )}
                <small>{item.note}</small>
              </a>
            ))}
            {sales && <SalesCard summary={sales} />}
          </section>
          {payload.impact.find((i) => i.id === 'impressions')?.count === 0 && (
            <p className="wa-notice">
              {live
                ? __('Nothing has been shown yet today.', 'wconvert')
                : payload.complete_days === false
                  ? __('Nothing was shown in this period.', 'wconvert')
                  : `${__('Nothing was shown in this period.', 'wconvert')} ${todayAppearsTomorrow()} ${chooseToday()}`}
            </p>
          )}
          <Insights items={insights} query={accepted} />
          <div className="wa-section-heading">
            <h3>{__('Results by goal', 'wconvert')}</h3>
          </div>
          <div className="wa-goal-grid">
            {payload.goals.map((g) => {
              // Per goal only: two goals' rates measure different acts, so there is no site-wide rate (CONTEXT).
              const goalChange = previous
                ? changeOf(g.conversions, previous.goals.find((p) => p.goal === g.goal)?.conversions ?? 0)
                : null;
              return (
                <a
                  className="wa-goal-card"
                  key={g.goal}
                  href={reportHref({
                    ...periodOf(payload),
                    goal: g.goal,
                    compare: selection.compare,
                  })}
                >
                  <span className="wa-goal-icon">
                    {g.action === 'submit' ? (
                      <Mail aria-hidden="true" />
                    ) : (
                      <MousePointerClick aria-hidden="true" />
                    )}
                  </span>
                  <span>
                    <b>{g.label}</b>
                    <span>
                      <strong>{formatCount(g.conversions)}</strong>{' '}
                      {g.result_label}
                    </span>
                    <small>
                      {g.impressions === 0
                        ? __('Not shown in these dates', 'wconvert')
                        : sprintf(
                            /* translators: 1: the goal's rate, 2: times shown. */
                            __('%1$s of %2$s shown', 'wconvert'),
                            formatRate(g.conversion_rate),
                            formatCount(g.impressions),
                          )}
                      {goalChange && (
                        <>
                          {' · '}
                          <span className={`wa-change ${goalChange.up ? 'wa-change-up' : ''}`}>{goalChange.text}</span>
                        </>
                      )}
                      {' · '}
                      {sprintf(
                        _n(
                          '%s campaign',
                          '%s campaigns',
                          families(g).length,
                          'wconvert',
                        ),
                        formatCount(families(g).length),
                      )}
                    </small>
                  </span>
                  <ArrowUpRight className="wa-goal-arrow rtl:-scale-x-100" aria-hidden="true" />
                </a>
              );
            })}
          </div>
        </>
      ) : payload && selection.experiment && card && optin ? (
        <Experiment
          key={optin.id}
          card={card}
          optin={optin}
          previous={priorCard}
          payload={payload}
          query={accepted}
          disabled={updating}
          onRefresh={() => setRetry((n) => n + 1)}
        />
      ) : payload && card ? (
        <GoalDetail
          key={optin?.id ?? card.goal}
          card={card}
          optin={optin}
          previous={priorCard}
          payload={payload}
          query={accepted}
          disabled={updating}
          onRefresh={() => setRetry((n) => n + 1)}
        />
      ) : payload && impact ? (
        <>
          <div className="wa-intro">
            <h2>{impact.label}</h2>
            <p className="wa-muted">{impact.note}</p>
          </div>
          <CampaignTable
            cards={scopedCards}
            payload={payload}
            query={accepted}
          />
        </>
      ) : payload && !overview ? (
        <Region>
          <EmptyState
            icon={ChartColumn}
            title={__('This report is not available', 'wconvert')}
          >
            {__(
              'Go back to Overall impact to choose a goal or campaign. A campaign that was never published has no report.',
              'wconvert',
            )}
          </EmptyState>
        </Region>
      ) : null}
      {payload && !overview && <Insights items={insights} query={accepted} />}
      {payload && optin && !selection.experiment && <ProductActivityReport id={optin.id} period={payload} />}
      {/* No campaign yet is no sales to link, so no placeholder for them either. */}
      {payload && payload.goals.length > 0 && (overview || (optin && !selection.experiment)) && <CommerceReport period={payload} campaignNames={Object.fromEntries(payload.goals.flatMap(goal => goal.optins.map(campaign => [campaign.id, campaign.name])))} optinId={overview ? undefined : optin?.id} onSummary={overview ? setSales : undefined} />}
      {payload && optin && !selection.experiment && <><JourneyReport id={optin.id} period={payload} /><Interests id={optin.id} period={payload} /></>}
      {payload && overview && payload.goals.length > 0 && <MonthlyTargets report={targets} reference={referenceOf(payload)} />}
      {payload && payload.goals.length > 0 && (
        <Disclosure variant="inline" title={__('How these numbers work', 'wconvert')} className="wa-help">
          <p>
            <strong>{__('Submissions:', 'wconvert')}</strong>{' '}
            {__('One per form fill, even with several destinations. Repeat submissions count again, so they are not unique people or confirmed subscribers.', 'wconvert')}
          </p>
          <p>
            <strong>{__('Clicks:', 'wconvert')}</strong>{' '}
            {__('Offer and cart clicks show interest, not confirmed purchases or recovered revenue.', 'wconvert')}
          </p>
          <p>
            <strong>{__('Rates:', 'wconvert')}</strong>{' '}
            {__('Submissions or clicks ÷ shown. For example, 5 submissions from 100 shown = 5%. A dash means the campaign was not shown; embedded forms count when they come into view.', 'wconvert')}
          </p>
          <p>
            <strong>{__('Email handoffs:', 'wconvert')}</strong>{' '}
            {__('Emails accepted for sending, not confirmed inbox arrivals or downloads. Counted on the send day, which may be later than the submission. Resends can count again.', 'wconvert')}
          </p>
          <p>
            <strong>{__('History:', 'wconvert')}</strong>{' '}
            {__('Past totals stay when a campaign is unpublished or deleted, or when old submissions are removed. A campaign’s goal stays fixed after it is first published.', 'wconvert')}
          </p>
        </Disclosure>
      )}
    </div>
  );
}

/**
 * Linked sales as a fifth headline (ADR 0132), for stores whose sales report
 * is complete and has linked orders. It jumps to Campaign sales rather than
 * leaving the page, and keeps the qualifier: linked, not caused.
 */
function SalesCard({ summary }: { summary: CommerceSummary }) {
  const target = useReportJump('sales');
  const amount = summary.amount !== null && summary.currency !== null
    ? formatMoney(summary.amount, summary.currency)
    : null;
  return (
    <button type="button" className="wa-impact wa-impact-sales" aria-controls={target?.controls} onClick={() => target?.jump()}>
      <span className="wa-impact-label">
        {__('Linked sales', 'wconvert')}
        <ArrowDown aria-hidden="true" />
      </span>
      <strong>{amount ?? formatCount(summary.orders)}</strong>
      <span className="wa-change">
        {amount
          ? sprintf(_n('%s order', '%s orders', summary.orders, 'wconvert'), formatCount(summary.orders))
          : _n('Linked order; the amount is in Campaign sales', 'Linked orders; amounts are in Campaign sales', summary.orders, 'wconvert')}
      </span>
      <small>{__('Paid orders after a signup or click. Linked, not caused.', 'wconvert')}</small>
    </button>
  );
}

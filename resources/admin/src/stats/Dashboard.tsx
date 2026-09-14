import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
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
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { StatRowSkeleton } from '../shell/Stat';
import { EmptyState } from '../shell/EmptyState';
import {
  LOADING,
  failed,
  messageOf,
  ready,
  type Loadable,
} from '../shell/loadable';
import { reportHref, type ReportQuery } from '../nav';
import { readDashboard, type DashboardPayload } from './api';
import { formatCount } from './format';
import { families, rangeLabel, reportCSV } from './reporting';
import { CampaignTable, Change, Experiment, GoalDetail } from './ReportDetails';
import './analytics.css';
import {
  MonthlyTargets,
  useMonthlyTargets,
  monthLabel,
} from './MonthlyTargets';

const WINDOWS = [7, 30, 90];
const periodLabel = (days: number) =>
  sprintf(
    _n('Last %s complete day', 'Last %s complete days', days, 'wconvert'),
    String(days),
  );

export function Dashboard({
  query,
  onQueryChange,
}: { query?: ReportQuery; onQueryChange?: (query: ReportQuery) => void } = {}) {
  const [localQuery, setLocalQuery] = useState<ReportQuery>({});
  const selection = query ?? localQuery;
  const change = (next: ReportQuery) =>
    onQueryChange ? onQueryChange(next) : setLocalQuery(next);
  const days = selection.days ?? null;
  const [report, setReport] = useState<Loadable<DashboardPayload>>(LOADING);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setUpdating(true);
    (selection.month
      ? readDashboard(days, true, selection.month)
      : readDashboard(days, true)
    )
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
  }, [days, selection.month, retry]);
  const payload = report.status === 'ready' ? report.data : null;
  const accepted = {
    ...selection,
    days: payload?.days ?? selection.days,
    month: payload ? payload.month : selection.month,
  };
  const compare = selection.compare !== false;
  const periods =
    days !== null && !WINDOWS.includes(days)
      ? [...WINDOWS, days].sort((a, b) => a - b)
      : WINDOWS;
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
  const previous = compare ? payload?.previous : undefined;
  const priorCard = previous?.goals.find((g) => g.goal === card?.goal);
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
  return (
    <div className="wconvert-analytics">
      <PageAction>
        <div className="wa-header-actions">
          <label>
            <span className="sr-only">
              {updating || refreshError
                ? __('Requested period', 'wconvert')
                : __('Period', 'wconvert')}
            </span>
            <select
              aria-label={__('Report period', 'wconvert')}
              value={
                selection.month
                  ? `month:${selection.month}`
                  : (days ?? payload?.days ?? '')
              }
              onChange={(e) =>
                change({
                  ...selection,
                  month: undefined,
                  days: Number(e.target.value),
                })
              }
            >
              {selection.month && (
                <option value={`month:${selection.month}`}>
                  {monthLabel(selection.month)}
                </option>
              )}
              {periods.map((period) => (
                <option key={period} value={period}>
                  {periodLabel(period)}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            disabled={!payload || updating || payload.days === 0}
            onClick={exportReport}
            title={__(
              'Exports this report, including campaigns hidden by table search or status filters.',
              'wconvert',
            )}
          >
            <Download aria-hidden="true" />
            {__('Export report CSV', 'wconvert')}
          </Button>
        </div>
      </PageAction>
      {payload && (
        <DateScope
          payload={payload}
          compare={compare}
          onCompare={(value) => change({ ...selection, compare: value })}
        />
      )}
      {updating && payload && (
        <p className="wa-muted" role="status">
          {__('Updating report…', 'wconvert')}
        </p>
      )}
      {refreshError && payload && (
        <PageError
          message={sprintf(
            __(
              'Could not load the requested period. Showing the previous report and its dates. %s',
              'wconvert',
            ),
            refreshError,
          )}
        />
      )}
      {report.status === 'failed' && (
        <Region label={__('Analytics', 'wconvert')}>
          <RegionErrorState message={report.message} />
        </Region>
      )}
      {refreshError && (
        <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
          {__('Retry loading report', 'wconvert')}
        </Button>
      )}
      {report.status === 'loading' && (
        <RegionSkeleton label={__('Analytics', 'wconvert')}>
          <StatRowSkeleton stats={4} />
        </RegionSkeleton>
      )}
      {payload && !overview && (
        <a
          className="wa-back"
          href={reportHref({
            month: payload.month,
            days: payload.days,
            compare: selection.compare,
          })}
        >
          <ArrowLeft aria-hidden="true" />
          {__('Overall impact', 'wconvert')}
        </a>
      )}
      {payload && payload.goals.length === 0 && overview ? (
        <>
          <Region>
            <EmptyState
              icon={ChartColumn}
              title={__(
                'Your first results start with a live campaign',
                'wconvert',
              )}
              action={
                <Button asChild>
                  <a href="#optins">{__('Go to Campaigns', 'wconvert')}</a>
                </Button>
              }
            >
              {__(
                'Publish a campaign to start seeing its reach and results. Never-published drafts stay on the Campaigns page.',
                'wconvert',
              )}
            </EmptyState>
          </Region>
          <MonthlyTargets report={targets} />
        </>
      ) : payload && overview ? (
        <>
          <div className="wa-intro">
            <p className="wa-eyebrow">
              {__('Your impact at a glance', 'wconvert')}
            </p>
            <h2>{__('What WConvert brought to your site', 'wconvert')}</h2>
            <p className="wa-muted">
              {__(
                'See the results, then explore the campaigns behind them.',
                'wconvert',
              )}
            </p>
          </div>
          <div className="wa-impact-grid">
            {payload.impact.map((item, index) => (
              <a
                key={item.id}
                className={`wa-impact ${index === 0 ? 'wa-impact-primary' : ''}`}
                href={reportHref({
                  month: payload.month,
                  days: payload.days,
                  impact: item.id,
                  compare: selection.compare,
                })}
              >
                <span className="wa-impact-label">
                  {item.label}
                  <ArrowUpRight aria-hidden="true" />
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
          </div>
          {payload.impact.find((i) => i.id === 'impressions')?.count === 0 && (
            <p className="wa-notice">
              {__(
                'No appearances recorded in this period. Check when and where your published campaigns are set to appear.',
                'wconvert',
              )}
            </p>
          )}
          <MonthlyTargets report={targets} />
          <div className="wa-section-heading">
            <h3>{__('Results by goal', 'wconvert')}</h3>
            <span>
              {__('Choose a goal to explore its performance', 'wconvert')}
            </span>
          </div>
          <div className="wa-goal-grid">
            {payload.goals.map((g) => (
              <a
                className="wa-goal-card"
                key={g.goal}
                href={reportHref({
                  month: payload.month,
                  days: payload.days,
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
                    {sprintf(
                      _n(
                        '%d campaign',
                        '%d campaigns',
                        families(g).length,
                        'wconvert',
                      ),
                      families(g).length,
                    )}{' '}
                    · {__('History included', 'wconvert')}
                  </small>
                </span>
                <ArrowUpRight className="wa-goal-arrow" aria-hidden="true" />
              </a>
            ))}
          </div>
          <p className="wa-muted wa-footnote">
            {__(
              'Paused and deleted campaigns keep their contribution. Published campaigns may still be limited by their schedule, rules or unavailable dependencies.',
              'wconvert',
            )}
          </p>
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
            <p className="wa-eyebrow">{__('Overall impact', 'wconvert')}</p>
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
              'Choose Overall impact to see the available goals and campaigns. Never-published drafts have no report.',
              'wconvert',
            )}
          </EmptyState>
        </Region>
      ) : null}
      {payload && payload.goals.length > 0 && (
        <details className="wa-help">
          <summary>{__('How these numbers work', 'wconvert')}</summary>
          <p>
            {__(
              'Leads count form submissions, not unique people or confirmed subscribers. Each submission counts once even when sent to multiple destinations; repeat submissions count again. Offer and cart clicks are separate, not purchases or recovered revenue.',
              'wconvert',
            )}
          </p>
          <p>
            {__(
              'Rates use visitor actions divided by campaign appearances, including repeats. A dash means no appearances were recorded. Inline forms count when they enter the visitor’s view.',
              'wconvert',
            )}
          </p>
          <p>
            {__(
              'Pausing or deleting a campaign preserves its historical counters. Goals are fixed after first publication. Lead retention can remove captured records without removing these totals.',
              'wconvert',
            )}
          </p>
          <p>
            {__(
              'Email handoffs are separate send events and can occur on a later day. Resends can count again. Acceptance for sending does not prove inbox arrival or a file download.',
              'wconvert',
            )}
          </p>
        </details>
      )}
    </div>
  );
}

function DateScope({
  payload,
  compare,
  onCompare,
}: {
  payload: DashboardPayload;
  compare: boolean;
  onCompare: (value: boolean) => void;
}) {
  return (
    <section
      className="wa-date-scope"
      aria-label={__('Report dates', 'wconvert')}
    >
      <div>
        <div className="wa-date-caption">
          {__('Reporting period', 'wconvert')}
          <details className="wa-date-help">
            <summary aria-label={__('About reporting dates', 'wconvert')}>
              i
            </summary>
            <p>
              {__(
                'Today is excluded because it is still in progress. Comparisons use the same number of complete days immediately before your selected period.',
                'wconvert',
              )}
            </p>
          </details>
        </div>
        <strong>
          {payload.days === 0
            ? __('No complete days yet this month', 'wconvert')
            : rangeLabel(payload.from, payload.to)}
        </strong>
      </div>
      <div className="wa-date-comparison">
        <label>
          <span>{__('Compare with previous period', 'wconvert')}</span>
          <input
            type="checkbox"
            role="switch"
            checked={compare}
            onChange={(e) => onCompare(e.target.checked)}
          />
        </label>
        <span>
          {compare && payload.previous
            ? rangeLabel(payload.previous.from, payload.previous.to)
            : compare
              ? __('Comparison unavailable', 'wconvert')
              : __('Comparison off', 'wconvert')}
        </span>
      </div>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ChartColumn, Megaphone } from 'lucide-react';
import { Button } from '../components/ui/button';
import { DataTable, DataTableBody, DataTableCell, DataTableColumn, DataTableHead, DataTableRow } from '../shell/DataTable';
import { EmptyState } from '../shell/EmptyState';
import { PageAction } from '../shell/PageActions';
import { PageError, Region, RegionBody, RegionErrorState, RegionHeader } from '../shell/Region';
import { Skeleton } from '../components/ui/skeleton';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { Stat, StatRow, StatRowSkeleton } from '../shell/Stat';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { Milestones } from '../milestones/Milestones';
import { readDashboard, type DashboardPayload, type GoalReport, type OptinReport } from './api';
import { formatCount, formatRate } from './format';
import { ActivityChart } from './ActivityChart';

const WINDOWS = [1, 7, 30, 90] as const;

/** Goals retain their own metrics. Different outcomes are never averaged together. */
export function Dashboard() {
  const [report, setReport] = useState<Loadable<DashboardPayload>>(LOADING);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // The server chooses the initial period in the site's timezone.
  const [days, setDays] = useState<number | null>(null);
  const [updating, setUpdating] = useState(false);
  const [retry, setRetry] = useState(0);
  const [goal, setGoal] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUpdating(true);
    readDashboard(days).then((data) => {
      if (!active) return;
      setReport(ready(data));
      setRefreshError(null);
    }).catch((cause: unknown) => {
      if (!active) return;
      // A failed refresh keeps the previous report and its actual date range.
      setReport((current) => current.status === 'ready' ? current : failed(cause));
      setRefreshError(messageOf(cause));
    }).finally(() => { if (active) setUpdating(false); });
    return () => { active = false; };
  }, [days, retry]);

  const payload = report.status === 'ready' ? report.data : null;
  const selected = payload?.goals.some((card) => card.goal === goal) ? goal : null;

  return (
    <div className="flex flex-col gap-5">
      <PageAction>
        <label className="ms-auto flex items-center gap-2 text-muted-foreground">
          {__('Showing', 'wconvert')}
          <select className="h-(--control-height) rounded-md border border-input bg-card ps-3 pe-9 text-body text-foreground"
            value={days ?? payload?.days ?? ''} onChange={(event) => setDays(Number(event.target.value))}>
            {WINDOWS.map((window) => <option key={window} value={window}>
              {window === 1 ? __('Today', 'wconvert') : sprintf(_n('The last %s day', 'The last %s days', window, 'wconvert'), String(window))}
            </option>)}
          </select>
        </label>
      </PageAction>
      {payload !== null && payload.goals.length > 1 && (
        <div className="wconvert-panel-filters" role="group" aria-label={__('Filter reports by goal', 'wconvert')}>
          <button type="button" aria-pressed={selected === null} onClick={() => setGoal(null)}>{__('All goals', 'wconvert')}</button>
          {payload.goals.map((card) => <button type="button" key={card.goal} aria-pressed={selected === card.goal} onClick={() => setGoal(card.goal)}>{card.label}</button>)}
        </div>
      )}
      {payload !== null && payload.from !== '' && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-note text-muted-foreground">
          <span>{payload.from === payload.to ? payload.from : sprintf(__('%1$s to %2$s, in your site’s timezone.', 'wconvert'), payload.from, payload.to)}</span>
          {updating && <span role="status">{__('Updating report…', 'wconvert')}</span>}
        </div>
      )}
      {refreshError !== null && payload !== null && <PageError message={sprintf(__('Showing the previous report. %s', 'wconvert'), refreshError)} />}
      {report.status === 'failed' && <Region label={__('Analytics', 'wconvert')}><RegionErrorState message={report.message} /></Region>}
      {refreshError !== null && <Button variant="outline" className="self-start" onClick={() => setRetry((value) => value + 1)}>{__('Retry loading report', 'wconvert')}</Button>}
      {report.status === 'loading' && <RegionSkeleton label={__('Analytics', 'wconvert')}>
        <StatRowSkeleton stats={4} /><Skeleton aria-hidden="true" className="h-36 w-full" />
      </RegionSkeleton>}
      {payload !== null && payload.goals.length === 0 && <Region label={__('Analytics', 'wconvert')}>
        <EmptyState icon={ChartColumn} title={__('Nothing to report yet', 'wconvert')}
          action={<Button asChild variant="outline"><a href="#optins">{__('Go to Optins', 'wconvert')}</a></Button>}>
          {__('Publish an Optin and its numbers appear here.', 'wconvert')}
        </EmptyState>
      </Region>}
      {payload?.goals.filter((card) => selected === null || card.goal === selected).map((card) => <GoalRegion key={card.goal} card={card} />)}
      <Milestones />
    </div>
  );
}

function GoalRegion({ card }: { card: GoalReport }) {
  return (
    <Region>
      <RegionHeader title={card.label} level={3} />
      <RegionBody className="flex flex-col gap-5">
        <StatRow>
          <Stat label={card.headline_label} value={formatCount(card.headline)} emphasis />
          <Stat label={__('Impressions', 'wconvert')} value={formatCount(card.impressions)} />
          <Stat label={__('Conversion rate', 'wconvert')} value={formatRate(card.conversion_rate)} />
          <Stat label={__('Dismissals', 'wconvert')} value={formatCount(card.dismissals)} />
          {card.undelivered_conversions !== null && <Stat
            label={_n('Conversion with no delivery yet', 'Conversions with no delivery yet', card.undelivered_conversions, 'wconvert')}
            value={formatCount(card.undelivered_conversions)} />}
        </StatRow>
        <ActivityChart label={card.headline_label} byDay={card.by_day} />
        {(card.undelivered_conversions ?? 0) > 0 && <a className="text-note font-medium text-primary hover:underline" href="#destinations">{__('Check delivery in Destinations', 'wconvert')}</a>}
      </RegionBody>
      <details className="wconvert-panel-details border-t border-border">
        <summary>{sprintf(_n('View %d Optin', 'View %d Optins', card.optins.length, 'wconvert'), card.optins.length)}</summary>
        <OptinTable card={card} />
      </details>
    </Region>
  );
}

function OptinTable({ card }: { card: GoalReport }) {
  if (card.optins.length === 0) {
    return (
      /*
        **{@see EmptyState} and not a muted paragraph**, which is what this
        was: a sentence in a `RegionBody`, in a screen whose every other
        nothing-here goes through the primitive. It carries no action, and
        that is the honest answer rather than an omission — the card above is
        reporting numbers, so *"go make an Optin"* is not what a merchant
        reading it came for, and the Optins section is one click away in the
        page nav either way.
      */
      <div className="border-t border-border">
        <EmptyState icon={Megaphone} title={__('Nothing is running under this Goal', 'wconvert')}>
          {__('Its numbers are what earlier ones counted.', 'wconvert')}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <DataTable label={sprintf(__('Optins for %s', 'wconvert'), card.label)}>
        <DataTableHead>
          <DataTableColumn>{__('Optin', 'wconvert')}</DataTableColumn>
          <DataTableColumn numeric>{card.headline_label}</DataTableColumn>
          <DataTableColumn numeric>{__('Impressions', 'wconvert')}</DataTableColumn>
          <DataTableColumn numeric>{__('Conversion rate', 'wconvert')}</DataTableColumn>
          <DataTableColumn numeric>{__('Dismissals', 'wconvert')}</DataTableColumn>
          <DataTableColumn>{__('Over time', 'wconvert')}</DataTableColumn>
        </DataTableHead>
        <DataTableBody>
          {card.optins.map((optin: OptinReport) => (
            <DataTableRow key={optin.id}>
              <DataTableCell label={__('Optin', 'wconvert')}>{optin.name}</DataTableCell>
              <DataTableCell label={card.headline_label} numeric>
                {formatCount(optin.headline)}
              </DataTableCell>
              <DataTableCell label={__('Impressions', 'wconvert')} numeric>
                {formatCount(optin.impressions)}
              </DataTableCell>
              <DataTableCell label={__('Conversion rate', 'wconvert')} numeric>
                {formatRate(optin.conversion_rate)}
              </DataTableCell>
              <DataTableCell label={__('Dismissals', 'wconvert')} numeric>
                {formatCount(optin.dismissals)}
              </DataTableCell>
              {/*
                Comparison within an Optin over time, which the merchant would
                otherwise only get by moving the whole screen's window and
                remembering the last number.
              */}
              <DataTableCell label={__('Over time', 'wconvert')}>
                <Sparkline label={card.headline_label} byDay={optin.by_day} />
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </div>
  );
}

/**
 * The headline number per day, as bars.
 *
 * Inline SVG and no charting library: the admin bundle is shipped to every
 * merchant and this is one series of small integers. Every day in the window
 * is present — the server seeds them — so a quiet day is a zero-height bar
 * rather than a gap, and a gap would read as missing data.
 *
 * `aria-hidden`, with the same series offered as text beside it. A bar chart
 * is decoration to a screen reader, and the numbers are already on the card.
 *
 * **It had no CSS at all until now**, which is why it rendered as a row of
 * black dashes across the top of the table: `.wconvert-sparkline` was one of
 * fourteen class names in this admin with no rule anywhere, so the `<svg>` took
 * the browser's default `fill` and no size. The bars are `--chart-1`, which is
 * the token ADR 0037 reserved for impressions and the series this draws.
 */
function Sparkline({ label, byDay }: { label: string; byDay: Record<string, number> }) {
  const days = Object.entries(byDay);

  if (days.length === 0) {
    return null;
  }

  const peak = Math.max(...days.map(([, count]) => count));

  /*
   * **A series of nothing is not a chart, it is a smudge.** Every day at zero
   * drew thirty hairlines across the card — which on a fresh install is every
   * card on the screen, and it reads as a broken rule rather than as "no data".
   * The number above it already says zero, in the largest type on the region.
   */
  if (peak === 0) {
    return null;
  }

  const width = 100 / days.length;

  return (
    <div className="wconvert-sparkline">
      <svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {days.map(([day, count], index) => {
          // A day with nothing on it still gets a hairline, so the series
          // reads as a run of days rather than as a shorter chart.
          const height = Math.max(0.5, (count / peak) * 24);

          return (
            <rect
              key={day}
              x={index * width}
              y={24 - height}
              width={Math.max(width - 0.4, 0.2)}
              height={height}
            />
          );
        })}
      </svg>
      <p className="sr-only">
        {sprintf(
          /* translators: 1: what the number counts, e.g. "Submissions". 2: the highest daily figure. 3: a number of days. */
          __('%1$s per day. Highest day: %2$s, across %3$s days.', 'wconvert'),
          label,
          formatCount(peak),
          String(days.length),
        )}
      </p>
    </div>
  );
}

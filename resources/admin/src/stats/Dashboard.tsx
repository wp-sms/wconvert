import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowLeft, ChartColumn, Megaphone } from 'lucide-react';
import { Button } from '../components/ui/button';
import { DataTable, DataTableActions, DataTableActionsColumn, DataTableBody, DataTableCell, DataTableColumn, DataTableHead, DataTableRow } from '../shell/DataTable';
import { EmptyState } from '../shell/EmptyState';
import { PageAction } from '../shell/PageActions';
import { PageError, Region, RegionBody, RegionErrorState, RegionFooter, RegionHeader } from '../shell/Region';
import { Skeleton } from '../components/ui/skeleton';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import { Stat, StatRow, StatRowSkeleton } from '../shell/Stat';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { Milestones } from '../milestones/Milestones';
import { destinationHref, editorHref, leadsHref, reportHref, type ReportQuery } from '../nav';
import { readDashboard, type DashboardPayload, type GoalReport, type OptinReport } from './api';
import { formatCount, formatRate } from './format';
import { ActivityChart } from './ActivityChart';

const WINDOWS: readonly number[] = [1, 7, 30, 90];
const periodLabel = (days: number) => days === 1 ? __('Today', 'wconvert')
  : sprintf(_n('The last %s day', 'The last %s days', days, 'wconvert'), String(days));

/** The URL records requested filters; every result and cross-link uses the accepted report's dates. */
export function Dashboard({ query, onQueryChange }: {
  query?: ReportQuery;
  onQueryChange?: (query: ReportQuery) => void;
} = {}) {
  const [localQuery, setLocalQuery] = useState<ReportQuery>({});
  const selection = query ?? localQuery;
  const change = (next: ReportQuery) => onQueryChange ? onQueryChange(next) : setLocalQuery(next);
  const days = selection.days ?? null;
  const [report, setReport] = useState<Loadable<DashboardPayload>>(LOADING);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setUpdating(true);
    readDashboard(days).then((data) => {
      if (!active) return;
      setReport(ready(data));
      setRefreshError(null);
    }).catch((cause: unknown) => {
      if (!active) return;
      setReport((current) => current.status === 'ready' ? current : failed(cause));
      setRefreshError(messageOf(cause));
    }).finally(() => { if (active) setUpdating(false); });
    return () => { active = false; };
  }, [days, retry]);

  const payload = report.status === 'ready' ? report.data : null;
  const selectedGoal = payload?.goals.some((card) => card.goal === selection.goal) ? selection.goal : undefined;
  const periods = days !== null && !WINDOWS.includes(days) ? [...WINDOWS, days].sort((a, b) => a - b) : WINDOWS;
  const selectedCard = selection.optinId ? payload?.goals.find((card) => card.optins.some((optin) => optin.id === selection.optinId)) : undefined;
  const selectedOptin = selectedCard?.optins.find((optin) => optin.id === selection.optinId);
  const cards = selection.optinId ? (selectedCard ? [selectedCard] : []) : payload?.goals.filter((card) => !selectedGoal || card.goal === selectedGoal);
  const shownQuery = { ...selection, days: payload?.days ?? selection.days };

  return (
    <div className="flex flex-col gap-5">
      <PageAction>
        <label className="ms-auto flex items-center gap-2 text-muted-foreground">
          {updating || refreshError ? __('Requested period', 'wconvert') : __('Period', 'wconvert')}
          <select aria-label={__('Report period', 'wconvert')}
            className="h-(--control-height) rounded-md border border-input bg-card ps-3 pe-9 text-body text-foreground"
            value={days ?? payload?.days ?? ''}
            onChange={(event) => change({ ...selection, days: Number(event.target.value) })}>
            {periods.map((period) => <option key={period} value={period}>{periodLabel(period)}</option>)}
          </select>
        </label>
      </PageAction>
      {selection.optinId && <a className="inline-flex items-center gap-2 self-start text-note text-primary hover:underline"
        href={reportHref({ days: payload?.days ?? selection.days, goal: selectedGoal })}>
        <ArrowLeft aria-hidden="true" className="size-4" />{__('All Optin results', 'wconvert')}
      </a>}
      {!selection.optinId && payload !== null && payload.goals.length > 1 && (
        <div className="wconvert-panel-filters" role="group" aria-label={__('Filter reports by goal', 'wconvert')}>
          <button type="button" aria-pressed={!selectedGoal} onClick={() => change({ ...selection, goal: undefined })}>{__('All goals', 'wconvert')}</button>
          {payload.goals.map((card) => <button type="button" key={card.goal} aria-pressed={selectedGoal === card.goal}
            onClick={() => change({ ...selection, goal: card.goal })}>{card.label}</button>)}
        </div>
      )}
      {payload !== null && payload.from !== '' && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-note text-muted-foreground">
          <span>{sprintf(__('Showing %1$s to %2$s, in your site’s timezone.', 'wconvert'), payload.from, payload.to)}</span>
          {updating && <span role="status">{__('Updating report…', 'wconvert')}</span>}
        </div>
      )}
      {refreshError !== null && payload !== null && <PageError message={sprintf(__('Could not load the requested period. Showing the previous report and its dates. %s', 'wconvert'), refreshError)} />}
      {report.status === 'failed' && <Region label={__('Analytics', 'wconvert')}><RegionErrorState message={report.message} /></Region>}
      {refreshError !== null && <Button variant="outline" className="self-start" onClick={() => setRetry((value) => value + 1)}>{__('Retry loading report', 'wconvert')}</Button>}
      {report.status === 'loading' && <RegionSkeleton label={__('Analytics', 'wconvert')}>
        <StatRowSkeleton stats={4} /><Skeleton aria-hidden="true" className="h-36 w-full" />
      </RegionSkeleton>}
      {payload !== null && selection.optinId && !selectedOptin && <Region label={__('Optin report', 'wconvert')}>
        <EmptyState icon={ChartColumn} title={__('This Optin is not available in the report', 'wconvert')}
          action={<Button asChild variant="outline"><a href={reportHref({ days: payload.days })}>{__('View all results', 'wconvert')}</a></Button>}>
          {__('A deleted Optin keeps its historical counts in its Goal’s totals, but no longer has an individual report.', 'wconvert')}
        </EmptyState>
      </Region>}
      {payload !== null && !selection.optinId && payload.goals.length === 0 && <Region label={__('Analytics', 'wconvert')}>
        <EmptyState icon={ChartColumn} title={__('Nothing to report yet', 'wconvert')}
          action={<Button asChild variant="outline"><a href="#optins">{__('Go to Optins', 'wconvert')}</a></Button>}>
          {__('Publish an Optin and its numbers appear here.', 'wconvert')}
        </EmptyState>
      </Region>}
      {payload && cards?.map((card) => <GoalRegion key={card.goal} card={card} optin={selectedOptin}
        period={payload} query={shownQuery} />)}
      {payload !== null && payload.goals.length > 0 && <details className="wconvert-report-help">
        <summary>{__('How these numbers work', 'wconvert')}</summary>
        <ul>
          <li>{__('Impressions count times an Optin was seen. For an inline form, this starts when it enters the visitor’s view.', 'wconvert')}</li>
          <li>{__('Conversion rate is visitor actions divided by impressions. The action is a form submission or a button click, depending on the design. A dash means there were no impressions.', 'wconvert')}</li>
          <li>{__('For a lead magnet, Deliveries counts recorded sends; conversion rate still measures visitor submissions. Delivery totals do not prove inbox arrival.', 'wconvert')}</li>
          <li>{__('Goal totals include deleted Optins. The table lists existing Optins, so its rows may add up to less. Changing an Optin’s Goal moves its historical counts to that Goal.', 'wconvert')}</li>
          <li>{__('Reports use daily counters. Deleting captured leads through retention does not remove those historical counts.', 'wconvert')}</li>
        </ul>
      </details>}
      {!selection.optinId && <Milestones />}
    </div>
  );
}

function GoalRegion({ card, optin, period, query }: {
  card: GoalReport;
  optin?: OptinReport;
  period: DashboardPayload;
  query: ReportQuery;
}) {
  const numbers = optin ?? card;
  const back = reportHref(query);
  return (
    <Region>
      <RegionHeader title={optin?.name ?? card.label} level={3} />
      <RegionBody className="flex flex-col gap-5">
        {optin && <p className="m-0 text-note text-muted-foreground">{card.label}</p>}
        <StatRow>
          <Stat label={card.headline_label} value={formatCount(numbers.headline)} emphasis />
          <Stat label={__('Impressions', 'wconvert')} value={formatCount(numbers.impressions)} />
          <Stat label={__('Conversion rate', 'wconvert')} value={formatRate(numbers.conversion_rate)} />
          <Stat label={__('Dismissals', 'wconvert')} value={formatCount(numbers.dismissals)} />
        </StatRow>
        {numbers.impressions === 0 && <p className="m-0 text-note text-muted-foreground">
          {__('No impressions were recorded in this period. Check the date range and where the Optin is set to appear.', 'wconvert')}
        </p>}
        <ActivityChart label={card.headline_label} byDay={numbers.by_day} />
        {!optin && (card.undelivered_conversions ?? 0) > 0 && <div className="wconvert-report-attention">
          <p>{sprintf(_n('%d more submission than lead-magnet deliveries was recorded in this period.', '%d more submissions than lead-magnet deliveries were recorded in this period.', card.undelivered_conversions ?? 0, 'wconvert'), card.undelivered_conversions ?? 0)}</p>
          <p>{__('These totals count events on the day they happen. Check Destinations for forwarding delays or errors.', 'wconvert')}</p>
          <a href={destinationHref()}>{__('Review forwarding', 'wconvert')}</a>
        </div>}
      </RegionBody>
      {optin ? <RegionFooter>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><a href={editorHref(optin.id, back)}>{__('Edit this Optin', 'wconvert')}</a></Button>
          <Button asChild variant="outline"><a href={leadsHref({ optinId: optin.id, from: period.from, to: period.to })}>{__('View captured leads', 'wconvert')}</a></Button>
        </div>
      </RegionFooter> : <details className="wconvert-panel-details border-t border-border">
        <summary>{sprintf(_n('View %d Optin', 'View %d Optins', card.optins.length, 'wconvert'), card.optins.length)}</summary>
        <OptinTable card={card} period={period} query={query} />
      </details>}
    </Region>
  );
}

function OptinTable({ card, period, query }: { card: GoalReport; period: DashboardPayload; query: ReportQuery }) {
  if (card.optins.length === 0) {
    return <EmptyState icon={Megaphone} title={__('No existing Optins under this Goal', 'wconvert')}>
      {__('These totals include results from deleted Optins.', 'wconvert')}
    </EmptyState>;
  }
  const back = reportHref(query);
  return (
    <div className="border-t border-border">
      <DataTable label={sprintf(__('Optins for %s', 'wconvert'), card.label)}>
        <DataTableHead>
          <DataTableColumn>{__('Optin', 'wconvert')}</DataTableColumn>
          <DataTableColumn numeric>{card.headline_label}</DataTableColumn>
          <DataTableColumn numeric>{__('Impressions', 'wconvert')}</DataTableColumn>
          <DataTableColumn numeric>{__('Conversion rate', 'wconvert')}</DataTableColumn>
          <DataTableColumn>{__('Over time', 'wconvert')}</DataTableColumn>
          <DataTableActionsColumn>{__('Actions', 'wconvert')}</DataTableActionsColumn>
        </DataTableHead>
        <DataTableBody>
          {card.optins.map((optin) => <DataTableRow key={optin.id}>
            <DataTableCell label={__('Optin', 'wconvert')}>
              <a className="font-medium text-primary hover:underline" href={reportHref({ days: period.days, goal: card.goal, optinId: optin.id })}>{optin.name}</a>
            </DataTableCell>
            <DataTableCell label={card.headline_label} numeric>{formatCount(optin.headline)}</DataTableCell>
            <DataTableCell label={__('Impressions', 'wconvert')} numeric>{formatCount(optin.impressions)}</DataTableCell>
            <DataTableCell label={__('Conversion rate', 'wconvert')} numeric>{formatRate(optin.conversion_rate)}</DataTableCell>
            <DataTableCell label={__('Over time', 'wconvert')}><Sparkline label={card.headline_label} byDay={optin.by_day} /></DataTableCell>
            <DataTableActions>
              <Button asChild variant="ghost" size="sm"><a aria-label={sprintf(__('Edit %s', 'wconvert'), optin.name)} href={editorHref(optin.id, back)}>{__('Edit', 'wconvert')}</a></Button>
              <Button asChild variant="ghost" size="sm"><a aria-label={sprintf(__('View captures for %s', 'wconvert'), optin.name)} href={leadsHref({ optinId: optin.id, from: period.from, to: period.to })}>{__('Captures', 'wconvert')}</a></Button>
            </DataTableActions>
          </DataTableRow>)}
        </DataTableBody>
      </DataTable>
    </div>
  );
}

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

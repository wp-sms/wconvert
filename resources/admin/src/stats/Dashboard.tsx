import { useCallback, useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ChartColumn } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableColumn,
  DataTableHead,
  DataTableRow,
} from '../shell/DataTable';
import { EmptyState } from '../shell/EmptyState';
import { PageAction } from '../shell/PageActions';
import { Region, RegionBody, RegionErrorState, RegionHeader } from '../shell/Region';
import { Stat, StatRow } from '../shell/Stat';
import { TableSkeleton } from '../shell/TableSkeleton';
import { LOADING, failed, ready, type Loadable } from '../shell/loadable';
import { readDashboard, type DashboardPayload, type GoalReport, type OptinReport } from './api';
// Spelled once, because the Optin list and the builder's header read the same
// two numbers and "—" must not become "0%" on one screen and not another.
import { formatCount, formatRate } from './format';

/**
 * The windows the merchant can ask for, in days.
 *
 * **Days, never dates.** `1` is today alone, which is what "Today" means to
 * somebody looking at a dashboard, and the far end of every one of these is
 * resolved on the SERVER against the site's timezone. A date picker here would
 * be a picker over the browser's calendar, which belongs to whoever is sitting
 * at the keyboard rather than to the site.
 *
 * Which of them is selected on arrival is **not decided here**: the first read
 * sends no `days` at all and the server's own default answers, so
 * `StatRange::DEFAULT_DAYS` is spelled once and this bundle never has to keep
 * a copy of it in step.
 */
const WINDOWS = [1, 7, 30, 90] as const;

/**
 * The analytics screen.
 *
 * ============================================================================
 * PER-GOAL CARDS, NEVER A LEADERBOARD.
 * ============================================================================
 * There is no site-wide conversion rate on this screen and no ranking between
 * Goals, because "click-throughs to the offer" and "conversions on Optins that
 * capture an email" are different acts and ranking them against each other
 * means nothing. Comparison is offered *within* a Goal — its Optins sit inside
 * its card — and *within* an Optin over time, by changing the window.
 *
 * That is a property of the payload rather than of this file: an Optin's
 * numbers arrive inside its Goal's card, so there is no flat list here to
 * sort. This screen could not build a leaderboard if it wanted to.
 *
 * **Every word naming a Goal or its metric comes from the server.** The five
 * Goals live in one PHP enum, their labels are translatable strings
 * `wp i18n make-pot` can only see there, and a Goal id spelled in this bundle
 * is what `tests/unit/Goal/GoalParityTest.php` fails on.
 *
 * **One region per Goal** (ADR 0039), because a Goal's performance is one
 * concern and two Goals are two. What each region holds stopped being a
 * bulleted list of numbers: a merchant scanning a card is comparing
 * magnitudes, and magnitudes are compared as figures with their names under
 * them ({@see Stat}), never as *"Impressions 0"* prose.
 *
 * **The window is in the page header, and that amends ADR 0039's own
 * sentence.** It governs every region on the screen at once, so a copy in each
 * region's toolbar would be four controls that must be kept in agreement — the
 * ADR's placement table is about ACTIONS, and this is a filter over the whole
 * screen.
 */
export function Dashboard() {
  const [report, setReport] = useState<Loadable<DashboardPayload>>(LOADING);
  // `null` is "whatever the server opens on", and only the first read is ever
  // in that state.
  const [days, setDays] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setReport(ready(await readDashboard(days)));
    } catch (cause) {
      setReport(failed(cause));
    }
  }, [days]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const payload = report.status === 'ready' ? report.data : null;

  return (
    <div className="flex flex-col gap-5">
      {/*
        **A native `<select>`, and it stays one.** The vendored Radix select is
        the right control for a filter inside a region's toolbar, where it sits
        beside other controls we drew; here it is one control in the page
        header, it is read by `dashboard.test.tsx` as a `combobox` with a
        VALUE, and a four-item window picker gains nothing from a portal.
      */}
      <PageAction>
        {/*
          **`ms-auto`, because this is a filter and not an action.** ADR 0039
          pairs an ACTION with the title — the eye reads "Optins + Create an
          Optin" as one object — and a window picker sitting in that position
          reads as part of the screen's name. Pushed to the trailing edge it
          reads as what it is: a control over everything below it. It still
          wraps under the title on a narrow viewport, where there is no trailing
          edge to go to.

          `pe-9` clears the arrow the browser draws. Preflight does not strip a
          select's appearance, so at `px-2` the chevron sat on top of the last
          letter of "The last 30 days".
        */}
        <label className="ms-auto flex items-center gap-2 text-muted-foreground">
          {__('Showing', 'wconvert')}
          <select
            className="h-9 rounded-md border border-input bg-card ps-3 pe-9 text-sm text-foreground"
            value={payload === null || payload.days === 0 ? '' : payload.days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            {WINDOWS.map((window) => (
              <option key={window} value={window}>
                {window === 1
                  ? __('Today', 'wconvert')
                  : sprintf(
                      /* translators: %s: a number of days. */
                      _n('The last %s day', 'The last %s days', window, 'wconvert'),
                      String(window),
                    )}
              </option>
            ))}
          </select>
        </label>
      </PageAction>

      {report.status === 'failed' && (
        <Region label={__('Analytics', 'wconvert')}>
          <RegionErrorState
            message={report.message}
            hint={__('Reload the page to try again.', 'wconvert')}
          />
        </Region>
      )}

      {report.status === 'loading' && (
        <Region label={__('Analytics', 'wconvert')}>
          <DataTable>
            <TableSkeleton columns={4} rows={3} />
          </DataTable>
        </Region>
      )}

      {payload !== null && payload.goals.length === 0 && (
        <Region label={__('Analytics', 'wconvert')}>
          <EmptyState
            icon={ChartColumn}
            title={__('Nothing to report yet', 'wconvert')}
            action={
              <Button asChild variant="outline">
                <a href="#optins">{__('Go to Optins', 'wconvert')}</a>
              </Button>
            }
          >
            {__('Publish an Optin and its numbers appear here.', 'wconvert')}
          </EmptyState>
        </Region>
      )}

      {/*
        The window is stated ONCE, on the first card. It is the same window for
        every region on the screen, so repeating it under each would be one
        fact printed four times — and `dashboard.test.tsx` reads it with
        `findByText`, which fails on a second match rather than passing.
      */}
      {payload?.goals.map((card, index) => (
        <GoalRegion key={card.goal} card={card} window={index === 0 ? payload : null} />
      ))}
    </div>
  );
}

/**
 * One Goal's region.
 *
 * The headline is named by the server, because two of the five Goals convert
 * on a CLICK — a card headed "Submissions" over a click-metered Goal reports
 * zero forever and looks broken while being right.
 *
 * The heading is an `<h3>` rather than a region's usual `<h2>`: these are a
 * repeating SET under the page's own subject rather than a list of unrelated
 * concerns, and `dashboard.test.tsx` pins the level from the other side.
 *
 * **The window sits on the first region's title line and nowhere else.** It is
 * the same window for every card, so repeating it under each would be the same
 * fact stated four times.
 */
function GoalRegion({ card, window }: { card: GoalReport; window: DashboardPayload | null }) {
  return (
    <Region>
      <RegionHeader
        title={card.label}
        level={3}
        trailing={
          window === null || window.from === '' ? undefined : (
            <span className="text-muted-foreground tabular-nums">
              {window.from === window.to
                ? window.from
                : sprintf(
                    /* translators: 1: the first day of the window. 2: the last day. */
                    __('%1$s to %2$s, in your site’s timezone.', 'wconvert'),
                    window.from,
                    window.to,
                  )}
            </span>
          )
        }
      />

      <RegionBody className="flex flex-col gap-4">
        <StatRow>
          <Stat label={card.headline_label} value={formatCount(card.headline)} emphasis />
          <Stat label={__('Impressions', 'wconvert')} value={formatCount(card.impressions)} />
          <Stat
            label={__('Conversion rate', 'wconvert')}
            value={formatRate(card.conversion_rate)}
          />
          <Stat label={__('Dismissals', 'wconvert')} value={formatCount(card.dismissals)} />
          {/*
            **`conversions − deliveries`, and only the server knows whether there
            is one.** This bundle spells no Goal id — `GoalParityTest` fails on
            any of the five appearing here — so a card cannot ask which Goal it
            is drawing. `null` is the server saying there is nothing to report,
            and the stat is absent rather than zero.

            The copy is "no delivery yet" rather than "failed" on purpose: a
            Conversion whose push is still queued or backing off is counted here
            too, and calling that a failure would be a stronger claim than the
            subtraction supports. The field is named `undelivered_conversions`
            for the same reason — it shipped as `delivery_failures`, which said
            the opposite of the copy directly beneath it.
          */}
          {card.undelivered_conversions !== null && (
            <Stat
              label={_n(
                'Conversion with no delivery yet',
                'Conversions with no delivery yet',
                card.undelivered_conversions,
                'wconvert',
              )}
              value={formatCount(card.undelivered_conversions)}
            />
          )}
        </StatRow>

        <Sparkline label={card.headline_label} byDay={card.by_day} />
      </RegionBody>

      <OptinTable card={card} />
    </Region>
  );
}

/**
 * The Optins under one Goal.
 *
 * **Soft-deleted Optins are absent here and their counts are still in the card
 * above.** A merchant tidying up in March must not watch February's goal total
 * fall, and this list is what they are running rather than what they have ever
 * run.
 */
function OptinTable({ card }: { card: GoalReport }) {
  if (card.optins.length === 0) {
    return (
      <RegionBody className="border-t border-border text-muted-foreground">
        {__(
          'No Optins are running under this Goal. Its numbers are what earlier ones counted.',
          'wconvert',
        )}
      </RegionBody>
    );
  }

  return (
    <div className="border-t border-border">
      <DataTable>
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

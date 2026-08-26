import { useCallback, useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { readDashboard, type DashboardPayload, type GoalReport, type OptinReport } from './api';

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

/** Before the first read lands. Not an error state — an install with no Optins looks the same. */
const EMPTY: DashboardPayload = { from: '', to: '', days: 0, goals: [] };

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
 */
export function Dashboard() {
  const [payload, setPayload] = useState<DashboardPayload>(EMPTY);
  // `null` is "whatever the server opens on", and only the first read is ever
  // in that state.
  const [days, setDays] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPayload(await readDashboard(days));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [days]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="wconvert-dashboard">
      <h2>{__('Analytics', 'wconvert')}</h2>

      {error !== null && (
        <div className="notice notice-error">
          <p>{error}</p>
        </div>
      )}

      <p>
        <label>
          {__('Showing', 'wconvert')}{' '}
          <select value={payload.days === 0 ? '' : payload.days} onChange={(e) => setDays(Number(e.target.value))}>
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
        </label>{' '}
        {payload.from !== '' && (
          <span className="description">
            {payload.from === payload.to
              ? payload.from
              : sprintf(
                  /* translators: 1: the first day of the window. 2: the last day. */
                  __('%1$s to %2$s, in your site’s timezone.', 'wconvert'),
                  payload.from,
                  payload.to,
                )}
          </span>
        )}
      </p>

      {payload.goals.length === 0 && (
        <p className="wconvert-dashboard__empty">
          {__('Nothing to report yet. Create an Optin and publish it, and its numbers appear here.', 'wconvert')}
        </p>
      )}

      <div className="wconvert-goal-cards">
        {payload.goals.map((card) => (
          <GoalCard key={card.goal} card={card} />
        ))}
      </div>
    </section>
  );
}

/**
 * One Goal's card.
 *
 * The headline is named by the server, because two of the five Goals convert
 * on a CLICK — a card headed "Submissions" over a click-metered Goal reports
 * zero forever and looks broken while being right.
 */
function GoalCard({ card }: { card: GoalReport }) {
  return (
    <div className="wconvert-goal-card">
      <h3>{card.label}</h3>

      <p className="wconvert-goal-card__headline">
        <strong>{formatCount(card.headline)}</strong> <span>{card.headline_label}</span>
      </p>

      <ul className="wconvert-goal-card__stats">
        <li>
          {__('Impressions', 'wconvert')} <strong>{formatCount(card.impressions)}</strong>
        </li>
        <li>
          {__('Conversion rate', 'wconvert')} <strong>{formatRate(card.conversion_rate)}</strong>
        </li>
        <li>
          {__('Dismissals', 'wconvert')} <strong>{formatCount(card.dismissals)}</strong>
        </li>
        {/*
          **`conversions − deliveries`, and only the server knows whether there
          is one.** This bundle spells no Goal id — `GoalParityTest` fails on
          any of the five appearing here — so a card cannot ask which Goal it
          is drawing. `null` is the server saying there is nothing to report,
          and the row is absent rather than zero.

          The copy is "did not go out" rather than "failed" on purpose: a
          Conversion whose push is still queued or backing off is counted here
          too, and calling that a failure would be a stronger claim than the
          subtraction supports.
        */}
        {card.delivery_failures !== null && (
          <li>
            {_n(
              'Conversion with no delivery yet',
              'Conversions with no delivery yet',
              card.delivery_failures,
              'wconvert'
            )}{' '}
            <strong>{formatCount(card.delivery_failures)}</strong>
          </li>
        )}
      </ul>

      <Sparkline label={card.headline_label} byDay={card.by_day} />

      <OptinTable card={card} />
    </div>
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
      <p className="description">
        {__('No Optins are running under this Goal. Its numbers are what earlier ones counted.', 'wconvert')}
      </p>
    );
  }

  return (
    <table className="wp-list-table widefat fixed striped">
      <thead>
        <tr>
          <th>{__('Optin', 'wconvert')}</th>
          <th>{card.headline_label}</th>
          <th>{__('Impressions', 'wconvert')}</th>
          <th>{__('Conversion rate', 'wconvert')}</th>
          <th>{__('Dismissals', 'wconvert')}</th>
          <th>{__('Over time', 'wconvert')}</th>
        </tr>
      </thead>
      <tbody>
        {card.optins.map((optin: OptinReport) => (
          <tr key={optin.id}>
            <td>{optin.name}</td>
            <td>{formatCount(optin.headline)}</td>
            <td>{formatCount(optin.impressions)}</td>
            <td>{formatRate(optin.conversion_rate)}</td>
            <td>{formatCount(optin.dismissals)}</td>
            {/*
              Comparison within an Optin over time, which the merchant would
              otherwise only get by moving the whole screen's window and
              remembering the last number.
            */}
            <td>
              <Sparkline label={card.headline_label} byDay={optin.by_day} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
 */
function Sparkline({ label, byDay }: { label: string; byDay: Record<string, number> }) {
  const days = Object.entries(byDay);

  if (days.length === 0) {
    return null;
  }

  const peak = Math.max(...days.map(([, count]) => count));
  const width = 100 / days.length;

  return (
    <div className="wconvert-sparkline">
      <svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {days.map(([day, count], index) => {
          // A day with nothing on it still gets a hairline, so the series
          // reads as a run of days rather than as a shorter chart.
          const height = peak === 0 ? 0.5 : Math.max(0.5, (count / peak) * 24);

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
      <p className="screen-reader-text">
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

const formatCount = (count: number) => new Intl.NumberFormat().format(count);

/**
 * A rate, or an em dash.
 *
 * **Undefined is not zero.** Nothing was shown, so there is no denominator —
 * and "0%" is a claim that visitors saw it and did not act, which is a
 * different and much worse thing to tell a merchant about an Optin that never
 * rendered.
 */
const formatRate = (rate: number | null) =>
  rate === null ? '—' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(rate * 100)}%`;

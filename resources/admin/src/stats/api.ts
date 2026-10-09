import type { Insight } from './Insights';
import type { ReportQuery } from '../nav';
import apiFetch from '@wordpress/api-fetch';

/**
 * The analytics screen's one read.
 *
 * ============================================================================
 * IT NEVER SENDS THE BROWSER'S TODAY.
 * ============================================================================
 * Calendar boundaries follow the MERCHANT's today — the
 * site's timezone, not the browser's. A date built here would be the day of
 * whoever is sitting at the keyboard: a merchant in Tokyo checking their
 * numbers from a hotel in Los Angeles would be handed yesterday's window and
 * told it was today's, and every number in it would be right about the wrong
 * day.
 *
 * So every preset is a count of days or a calendar month, the far end is
 * resolved on the server against the site's own timezone, and `from` and `to`
 * come BACK. The one exception is Custom dates (ADR 0132): two days the
 * merchant typed, sent as typed, and refused by the server when they end after
 * ITS today — which the payload carries back as `today`.
 *
 * **No [[Goal]] id is spelled in this file, or anywhere in this bundle.** The
 * Goals live in `src/Goal/Goal.php` as an enum and every word the cards render
 * — the Goal's label, and what its headline number is CALLED — travels in the
 * payload, because `wp i18n make-pot` cannot see a JavaScript string.
 * `tests/unit/Goal/GoalParityTest.php` fails the day one appears here.
 */

/** The numbers a card and an Optin row both carry. */
export interface Numbers {
  /** The Goal's headline metric — named by `headline_label` on the card. */
  headline: number;
  impressions: number;
  dismissals: number;
  /** Conversions ÷ impressions, or null where nothing was shown. */
  conversion_rate: number | null;
  /** The headline number per day, with every day in the window present. */
  by_day: Record<string, number>;
  conversions: number;
  items_added?: number;
  deliveries: number | null;
  conversion_by_day: Record<string, number>;
  impression_by_day: Record<string, number>;
}

/**
 * One [[Optin]]'s numbers, inside the card for the Goal it serves.
 *
 * It carries its own `by_day`, which is what "comparison is offered within an
 * Optin over time" means — without it the only way to compare an Optin with
 * itself is to move the whole screen's window and remember the last number.
 */
export interface OptinReport extends Numbers {
  id: string;
  name: string;
  parent_id: string | null;
  status: 'published' | 'paused' | 'historical';
  published_at: string | null;
}

/**
 * One [[Goal]]'s card.
 *
 * **A card, never a row in a ranking.** "Click-throughs to the offer" and
 * "conversions on Optins that capture an email" are different acts, so there
 * is no site-wide conversion rate in this payload and no flat list of Optins
 * to sort across Goals — an Optin's numbers arrive INSIDE the card for its
 * Goal, which is what makes a leaderboard unexpressible rather than merely
 * discouraged.
 *
 * Dismissals and conversions can overlap when a visitor reopens a Campaign.
 * Daily counters cannot reconstruct an exclusive abandonment group.
 *
 * Analytics presents `conversions` and `deliveries` separately. Neither their
 * difference nor a send event proves a failed delivery or inbox arrival.
 */
export interface GoalReport extends Numbers {
  goal: string;
  action: 'submit' | 'click' | 'match' | 'add_to_cart';
  result_label: string;
  rate_label: string;
  /** The merchant's own words for the Goal, translated in PHP. */
  label: string;
  /** What the headline number is CALLED — two of the five convert on a click. */
  headline_label: string;
  measurement?: string;
  proof_level?: string;
  /**
   * Same-period conversions minus recorded deliveries, clamped at zero;
   * null on Goals that do not count lead-magnet deliveries. This aggregate
   * difference is not a per-Lead backlog: a later delivery can land in a
   * different daily window, and replayed sends can be counted again.
   */
  undelivered_conversions: number | null;
  optins: OptinReport[];
}

export interface DashboardPayload {
  insights?: Insight[];
  /** A stable calendar-month scope selected from a monthly target. */
  month?: string;
  /** The window the server read, resolved against the SITE's timezone. */
  from: string;
  to: string;
  /**
   * How many days that window covers.
   *
   * It comes BACK rather than being assumed, so the selector can show which
   * window is current without this bundle spelling the server's default a
   * second time — `StatRange::DEFAULT_DAYS` is the only place that number
   * lives, and there is no parity test across this boundary to catch a copy.
   */
  days: number;
  goals: GoalReport[];
  impact: Impact[];
  previous?: DashboardPayload;
  /**
   * Whether the window counts complete days only. False for Today, and for
   * custom dates that end today: both include today so far.
   */
  complete_days?: boolean;
  /** Set when the window is custom dates the merchant typed. */
  custom?: boolean;
  /** The site's today, from the server — the latest a custom range may end. */
  today?: string;
}

/** What a report needs to know about the window the screen accepted. */
export type ReportPeriod = Pick<DashboardPayload, 'from' | 'to' | 'days' | 'month' | 'complete_days' | 'custom'>;
export type PeriodQuery = Pick<ReportQuery, 'today' | 'from' | 'to' | 'month' | 'days'>;

/**
 * The window an accepted payload answers, as a link names it — so drill-downs,
 * the editor's return link and every per-campaign report read the same days.
 * A live one-day read is Analytics' Today; nothing else asks for one.
 */
export function periodOf(period: ReportPeriod): PeriodQuery {
  if (period.custom) return { from: period.from, to: period.to };
  if (period.month) return { month: period.month };
  if (period.complete_days === false && period.days === 1) return { today: true };
  return { days: period.days };
}

/**
 * One window as REST parameters, for every report route (ADR 0132). Today is
 * the one live read and says so: the order report defaults to complete days.
 */
export function periodParams(query: PeriodQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.today) {
    params.set('days', '1');
    params.set('complete', '0');
  } else if (query.from !== undefined && query.to !== undefined) {
    params.set('from', query.from);
    params.set('to', query.to);
  } else {
    if (query.month) params.set('month', query.month);
    else if (query.days !== undefined) params.set('days', String(query.days));
    params.set('complete', '1');
  }
  return params;
}

/** Analytics' read: any of its windows, with the comparison where one applies. */
export const readReport = (query: PeriodQuery) =>
  apiFetch<DashboardPayload>({ path: `/wconvert/v1/dashboard?${periodParams(query).toString()}` });

export interface Impact {
  id: string;
  label: string;
  note: string;
  count: number;
  goals: string[];
}

/**
 * `days` omitted asks for the server's own default window, which is the only
 * way this bundle can avoid naming it.
 */
export const readDashboard = (
  days: number | null,
  complete = false,
  month?: string,
) =>
  apiFetch<DashboardPayload>({
    path: month
      ? `/wconvert/v1/dashboard?month=${encodeURIComponent(month)}&complete=1`
      : `/wconvert/v1/dashboard${days === null ? (complete ? '?complete=1' : '') : `?days=${encodeURIComponent(String(days))}${complete ? '&complete=1' : ''}`}`,
  });

/**
 * One [[Optin]]'s numbers, and what its [[Goal]] calls the headline one.
 *
 * The card is the payload's shape and an Optin's numbers arrive INSIDE it, so
 * reading one row means walking the cards. `label` is carried down because the
 * headline number is not the same number under every Goal — two of the five
 * convert on a click — and a figure shown without the word for it is the
 * ambiguity {@see GoalReport} exists to prevent.
 *
 * **Narrower than `OptinReport`, and that is the point.** That carries
 * `by_day` as well, which an Optin ROW has no honest heading for — so keeping
 * this shape to what a row can label makes the wrong column unexpressible
 * rather than merely absent. The argument lived beside `OptinList`'s own copy
 * of this type until the type moved here; #74 found the docblock still there,
 * describing nothing, directly above the next declaration's.
 */
export interface OptinNumbers {
  /** What the headline number is CALLED, off the card this Optin sits in. */
  readonly label: string;
  /**
   * How many days these numbers cover, off the payload.
   *
   * **Carried down for the same reason `label` is**: a figure shown without
   * the window it was counted over is as ambiguous as one shown without the
   * word for it, and the Analytics screen dates every card while the builder's
   * strip showed three undated numbers. It comes from the payload rather than
   * from a constant here, because `StatRange::DEFAULT_DAYS` is the only place
   * that number lives and there is no parity test across this boundary.
   */
  readonly days: number;
  readonly report: OptinReport;
}

/**
 * The dashboard's cards, flattened to one row per [[Optin]].
 *
 * ============================================================================
 * TWO SCREENS READ THIS AND NEITHER WALKS THE PAYLOAD ITSELF.
 * ============================================================================
 * The Optin list wants a number beside every row; the builder wants the one row
 * it is editing. Both were spelling the same walk — `payload.goals`, then
 * `card.optins` — beside the same swallowed `catch`, and `format.ts` was
 * already extracted because the same thing had happened to the FORMATTING. The
 * read is the other half of that.
 *
 * **It is still the dashboard's own read, deliberately** (ADR 0034). The
 * builder fetching a whole dashboard to find one row is more payload than that
 * screen needs, and the alternative is worse: a second endpoint computing
 * impressions and conversion rate a second way, which is exactly the drift
 * ADR 0034 refused when it put the join in PHP. The join is one query over
 * daily counters, the response is small, and a narrower read would be a second
 * spelling of the [[Goal]]'s own interpretation of a [[Conversion]] (ADR 0020).
 * Revisit it when an install's dashboard is slow, not before.
 */
export const numbersByOptin = (
  payload: DashboardPayload,
): Record<string, OptinNumbers> =>
  Object.fromEntries(
    payload.goals.flatMap((card) =>
      card.optins.map((optin) => [
        optin.id,
        { label: card.headline_label, days: payload.days, report: optin },
      ]),
    ),
  );

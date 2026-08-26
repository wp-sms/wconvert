import apiFetch from '@wordpress/api-fetch';

/**
 * The analytics screen's one read.
 *
 * ============================================================================
 * IT ASKS FOR A NUMBER OF DAYS AND NEVER FOR A DATE.
 * ============================================================================
 * The screen says "Today", and that has to mean the MERCHANT's today — the
 * site's timezone, not the browser's. A date built here would be the day of
 * whoever is sitting at the keyboard: a merchant in Tokyo checking their
 * numbers from a hotel in Los Angeles would be handed yesterday's window and
 * told it was today's, and every number in it would be right about the wrong
 * day.
 *
 * So the window is a count of days, the far end is resolved on the server
 * against the site's own timezone, and `from` and `to` come BACK rather than
 * going out. There is deliberately no way to express any other window from
 * here.
 *
 * **No [[Goal]] id is spelled in this file, or anywhere in this bundle.** The
 * five live in `src/Goal/Goal.php` as an enum and every word the cards render
 * — the Goal's label, and what its headline number is CALLED — travels in the
 * payload, because `wp i18n make-pot` cannot see a JavaScript string.
 * `tests/unit/Goal/GoalParityTest.php` fails the day one appears here.
 */

/** The numbers a card and an Optin row both carry. */
interface Numbers {
  /** The Goal's headline metric — named by `headline_label` on the card. */
  headline: number;
  impressions: number;
  dismissals: number;
  /** Conversions ÷ impressions, or null where nothing was shown. */
  conversion_rate: number | null;
  /** The headline number per day, with every day in the window present. */
  by_day: Record<string, number>;
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
 * There is also no "left without converting": it is already
 * `impressions − conversions − dismissals`, and naming it would put two
 * numbers on screen where one is the arithmetic of the other.
 *
 * `delivery_failures` is **not** an instance of that rule, which is worth
 * saying because this comment used to claim it was. `conversions` is not a
 * field on this payload at all — the numbers below are `headline`,
 * `impressions`, `dismissals`, `conversion_rate` and `by_day`, and on a
 * lead-magnet card `headline` is *deliveries*. So the subtraction is new
 * information rather than a restatement.
 */
export interface GoalReport extends Numbers {
  goal: string;
  /** The merchant's own words for the Goal, translated in PHP. */
  label: string;
  /** What the headline number is CALLED — two of the five convert on a click. */
  headline_label: string;
  /**
   * Conversions that have no delivery yet, clamped at zero — or **null on
   * every Goal but the lead-magnet one.**
   *
   * The server decides which, because this bundle cannot: no Goal id is
   * spelled anywhere in it, so a card has no way to know which Goal it is
   * drawing. Null means "there is nothing to say here", and the row is not
   * rendered.
   *
   * It reads *not yet delivered* rather than *failed*: a Conversion whose push
   * is still queued or backing off is in it.
   */
  delivery_failures: number | null;
  optins: OptinReport[];
}

export interface DashboardPayload {
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
}

/**
 * `days` omitted asks for the server's own default window, which is the only
 * way this bundle can avoid naming it.
 */
export const readDashboard = (days: number | null) =>
  apiFetch<DashboardPayload>({
    path: `/wconvert/v1/dashboard${days === null ? '' : `?days=${encodeURIComponent(String(days))}`}`,
  });

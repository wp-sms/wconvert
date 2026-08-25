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

/** One [[Optin]]'s numbers, inside the card for the Goal it serves. */
export interface OptinReport {
  id: string;
  name: string;
  /** The Goal's headline metric for this Optin — named by `headline_label` on the card. */
  headline: number;
  impressions: number;
  dismissals: number;
  /** Conversions ÷ impressions, or null where nothing was shown. */
  conversion_rate: number | null;
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
 */
export interface GoalReport {
  goal: string;
  /** The merchant's own words for the Goal, translated in PHP. */
  label: string;
  /** What the headline number is CALLED — two of the five convert on a click. */
  headline_label: string;
  headline: number;
  impressions: number;
  dismissals: number;
  conversion_rate: number | null;
  /**
   * `conversions − deliveries`, or null where the headline already IS
   * conversions and where nothing writes the headline kind yet.
   */
  delivery_failures: number | null;
  /** Why the headline reads zero, where it reads zero for a reason nobody can act on. */
  note: string | null;
  /** The headline number per day, with every day in the window present. */
  by_day: Record<string, number>;
  optins: OptinReport[];
}

export interface DashboardPayload {
  /** The window the server read, resolved against the SITE's timezone. */
  from: string;
  to: string;
  goals: GoalReport[];
}

export const readDashboard = (days: number) =>
  apiFetch<DashboardPayload>({ path: `/wconvert/v1/dashboard?days=${encodeURIComponent(String(days))}` });

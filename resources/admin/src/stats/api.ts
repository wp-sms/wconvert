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
 * `undelivered_conversions` is **not** an instance of that rule, which is
 * worth saying because this comment used to claim it was. `conversions` is not a
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
   * is still queued or backing off is in it — which is what the name says. It
   * shipped as `delivery_failures`, contradicting both this sentence and
   * `WConvert\Destination\DeliveryFailures`, a ring of ~200 *terminal*
   * failures on the PHP side. Two opposite populations under one name.
   */
  undelivered_conversions: number | null;
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

/**
 * One [[Optin]]'s numbers, and what its [[Goal]] calls the headline one.
 *
 * The card is the payload's shape and an Optin's numbers arrive INSIDE it, so
 * reading one row means walking the cards. `label` is carried down because the
 * headline number is not the same number under every Goal — two of the five
 * convert on a click — and a figure shown without the word for it is the
 * ambiguity {@see GoalReport} exists to prevent.
 */
export interface OptinNumbers {
  /** What the headline number is CALLED, off the card this Optin sits in. */
  readonly label: string;
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
export const numbersByOptin = (payload: DashboardPayload): Record<string, OptinNumbers> =>
  Object.fromEntries(
    payload.goals.flatMap((card) =>
      card.optins.map((optin) => [optin.id, { label: card.headline_label, report: optin }]),
    ),
  );

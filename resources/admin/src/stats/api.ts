import apiFetch from '@wordpress/api-fetch';

/**
 * The analytics screen's one read.
 *
 * ============================================================================
 * IT ASKS FOR A NUMBER OF DAYS AND NEVER FOR A DATE.
 * ============================================================================
 * Calendar boundaries follow the MERCHANT's today — the
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
 * Analytics presents `conversions` and `deliveries` separately. Neither their
 * difference nor a send event proves a failed delivery or inbox arrival.
 */
export interface GoalReport extends Numbers {
  goal: string;
  action: 'submit' | 'click';
  result_label: string;
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
  complete_days?: boolean;
}

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
export const readDashboard = (days: number | null, complete = false) =>
  apiFetch<DashboardPayload>({
    path: `/wconvert/v1/dashboard${days === null ? (complete ? '?complete=1' : '') : `?days=${encodeURIComponent(String(days))}${complete ? '&complete=1' : ''}`}`,
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
export const numbersByOptin = (payload: DashboardPayload): Record<string, OptinNumbers> =>
  Object.fromEntries(
    payload.goals.flatMap((card) =>
      card.optins.map((optin) => [
        optin.id,
        { label: card.headline_label, days: payload.days, report: optin },
      ]),
    ),
  );

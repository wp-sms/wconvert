import type { Arrival } from './arrival';
import type { BrowserReport, EntryReport } from './explain';

/**
 * The funnel: **the first gate that closes is the answer.**
 *
 * ============================================================================
 * PURE, AND SEPARATE FROM THE PANEL THAT DRAWS IT.
 * ============================================================================
 * Half the funnel is server facts frozen when the page rendered, and half is
 * browser facts re-read on every signal. Joining them is arithmetic; drawing
 * the result is DOM. Keeping the two apart is what lets the arithmetic be
 * tested at all — `panel.ts` has a shadow root and this has none.
 *
 * ```
 * Published → Not suspended → Targeting admits this page → reached the browser
 *   → Inside its schedule → Frequency allows → Consent given → Trigger exists
 *   → Conditions hold → Trigger fired → won the overlay
 * ```
 *
 * **The schedule gate sits after the payload gate, and the order is the whole
 * scheduling decision written down.** A not-yet-started Optin IS published, IS
 * in the projection and DOES reach the browser — it has to, because the set is
 * rebuilt on write and a full-page cache can serve the same HTML for days
 * (ADR 0003) — so the browser is what decides, and this screen reports the
 * four gates that opened before naming the one that did not.
 *
 * **The last gate has no word in the product today.** `arbitrate()` silently
 * drops a `ready` overlay when a higher-priority one won, and "ready but not
 * shown" is exactly what a merchant is looking at when they ask why their
 * popup did not appear.
 */

/** One Optin as the server described it, before the browser was consulted. */
export interface ServerOptin {
  readonly id: string;
  readonly name: string;
  readonly published: boolean;
  /** The sentence the Optin list already shows, or null. */
  readonly suspended: string | null;
  /**
   * How far each end of the scheduled window is from now, **in words minted
   * by PHP** — or null where this Optin is not scheduled.
   *
   * ==========================================================================
   * THE MAGNITUDE IS THE SERVER'S WORD; THE DIRECTION IS THE BROWSER'S.
   * ==========================================================================
   * This bundle carries no `@wordpress/i18n` — it is composed from the
   * loader's own module set, which has no dependencies at all (ADR 0004) — so
   * *"3 days"* cannot be spelled here: it needs plural rules the panel has no
   * formatter for. `human_time_diff()` already says it, translated, in core.
   *
   * Both are minted whenever the boundary EXISTS, without regard to which side
   * of it we are on, because the diff is an absolute magnitude. Which one to
   * show is {@link EntryReport.schedule}'s answer, taken on the same clock
   * reading as the verdict — so the two halves cannot disagree about the
   * direction, which is the only thing they could have disagreed about.
   */
  readonly schedule: { readonly starts: string | null; readonly ends: string | null } | null;
  readonly audienceAllowed?: boolean;
  readonly targeting: TargetingReport | null;
}

export interface TargetingReport {
  readonly admits: boolean;
  readonly reason: string | null;
  readonly logged_in: { wanted: boolean; holds: boolean } | null;
  /**
   * The roles the Optin wants and the ones this request holds — or null where
   * it does not ask.
   *
   * **Both halves, because neither answers on its own.** The merchant opened
   * this panel by being an administrator, so *"what does a subscriber see"* is
   * unanswerable here and is never simulated. What can be said is which roles
   * the Optin is aimed at and which this request has, and the sentence names
   * the first.
   */
  readonly roles: { wanted: readonly string[]; held: readonly string[]; holds: boolean } | null;
  readonly include: readonly TargetingRow[];
  readonly exclude: readonly TargetingRow[];
}

export interface TargetingRow {
  readonly type: string;
  readonly value: string;
  readonly matches: boolean;
}

/** What the server printed into `#wconvert-inspector`. */
export interface ServerReport {
  readonly request: Record<string, unknown>;
  readonly optins: readonly ServerOptin[];
  readonly labels: Labels;
}

/** Every word, minted in PHP where `make-pot` can see it. */
export interface Labels {
  readonly [key: string]: string | Labels;
}

/**
 * The funnel, in the order it is applied.
 *
 * ============================================================================
 * THE SEQUENCE IS THE ANSWER, WHICH IS WHY IT IS A LIST AND NOT A CASCADE OF
 * `if`s WITH A STRING AT THE END.
 * ============================================================================
 * A merchant asking why nothing showed needs two facts, and they are different
 * questions: **how far it got**, and **what stopped it**. This is the first.
 * Naming the gate is what turns "your allowance is spent" into "it was
 * published, not suspended, allowed on this page, it reached the browser — and
 * then its allowance was spent", which is the sentence that tells them the
 * other nine things are fine.
 *
 * Keyed to `InspectorLabels::all()['gates']`, which mints the words.
 */
export const GATES = [
  'published',
  'suspended',
  'targeting',
  'payload',
  'schedule',
  'frequency',
  'consent',
  'trigger',
  'conditions',
  'fired',
  'won',
] as const;

export type Gate = (typeof GATES)[number];

/** Where an Optin stopped, and what to say about it. */
export interface Row {
  readonly optin: ServerOptin;
  /**
   * Which gate closed — **null where every one of them opened**.
   *
   * Held apart from {@link stopped} because they answer different questions
   * and were one value until the funnel had no renderer: `stoppedAt` returned
   * a string that was sometimes a stage (`draft`, `not_in_payload`) and
   * sometimes a cause (`excluded`, `capped`), so there was nowhere to put the
   * stage and ten minted gate labels shipped with no reader.
   */
  readonly gate: Gate | null;
  /** The key into `labels.stopped`, or null where it is showing. */
  readonly stopped: string | null;
  /**
   * Substituted into the sentence, where it takes one.
   *
   * Two sentences take one. The arbitration sentence takes the NAME of the
   * Optin that won — never "priority". Two overlays at equal priority are
   * broken by the ULID, which is creation order, and telling a merchant their
   * popup lost on priority when both were zero would send them to change a
   * number that decides nothing.
   *
   * The two schedule sentences take **how long**, as PHP minted it: *"it
   * starts in %s"*, *"it ended %s ago"*. One `%s` each and never two, because
   * the panel substitutes with a single `String.replace` (ADR 0048).
   */
  readonly subject: string | null;
  /** Null where it never reached the browser, so there is nothing more to say. */
  readonly browser: EntryReport | null;
}

export interface Funnel {
  readonly arrival: Arrival;
  readonly rows: readonly Row[];
}

/**
 * The two halves, joined.
 *
 * @param reached Ids the payload actually carries — the "reached the browser"
 *   gate, read off the page rather than recomputed. An Optin that passed
 *   Targeting and is absent here was dropped by something between the two,
 *   and the honest report is that it did not arrive. It is a page-level fact
 *   passed beside the rows for the reason {@link BrowserReport.siteCapped}
 *   travels there rather than on each row.
 */
export function funnel(
  server: ServerReport,
  browser: BrowserReport,
  reached: ReadonlySet<string>,
  arrival: Arrival,
): Funnel {
  const byId = new Map(browser.entries.map((entry) => [entry.id, entry]));
  const names = new Map(server.optins.map((optin) => [optin.id, optin.name]));
  const winner = browser.entries.find(
    (entry) => entry.overlay && entry.standing === 'ready' && !entry.lostArbitration,
  );

  return {
    arrival,
    rows: server.optins.map((optin) => {
      const entry = byId.get(optin.id) ?? null;

      const closed = stoppedAt(optin, entry, reached, browser.siteCapped);

      return {
        optin,
        gate: closed.gate,
        stopped: closed.reason,
        subject: subjectFor(closed.reason, optin, entry, winner, names),
        // An Optin stopped on the server has no browser half, and the panel
        // says so rather than drawing an empty table under it.
        browser: entry,
      };
    }),
  };
}

/**
 * What the sentence's one `%s` is filled with, where it takes one.
 *
 * Keyed off the REASON rather than off the row's shape, so a sentence with no
 * placeholder can never be handed a subject and a sentence with one can never
 * be left holding a literal `%s`.
 */
function subjectFor(
  reason: string | null,
  optin: ServerOptin,
  entry: EntryReport | null,
  winner: EntryReport | undefined,
  names: ReadonlyMap<string, string>,
): string | null {
  if (reason === 'before_window') {
    return optin.schedule?.starts ?? null;
  }

  if (reason === 'after_window') {
    return optin.schedule?.ends ?? null;
  }

  if (reason === 'lost' && entry !== null && winner !== undefined) {
    return names.get(winner.id) ?? winner.id;
  }

  // ==========================================================================
  // THE SLUGS, NOT THE ROLES' OWN NAMES, AND THAT IS THE CHEAP ANSWER.
  // ==========================================================================
  // A role's display name is a fact about the INSTALL — whatever registered it
  // — so naming them would mean shipping the whole offered map into this
  // bundle's labels for a sentence one Optin in a hundred prints. The slug is
  // what is stored, it is what an administrator recognises, and it is already
  // here.
  if (reason === 'wants_role') {
    return optin.targeting?.roles?.wanted.join(', ') ?? null;
  }

  return null;
}

/**
 * The first gate that closed, and what to say about it.
 *
 * ============================================================================
 * ORDER IS THE WHOLE CONTENT OF THIS FUNCTION.
 * ============================================================================
 * An Optin that is both a draft and suspended is a DRAFT — telling its author
 * it is suspended sends them to reactivate a plugin when what they needed was
 * the Publish button.
 *
 * **Two values and not one.** The gate is a fact about the SEQUENCE and the
 * reason is a fact about this Optin, and folding them into one string is what
 * left the funnel unrenderable: `draft` and `not_in_payload` named stages
 * while `excluded` and `capped` named causes, so a caller could not ask "how
 * far did it get" at all.
 */
function stoppedAt(
  optin: ServerOptin,
  entry: EntryReport | null,
  reached: ReadonlySet<string>,
  siteCapped: boolean,
): { gate: Gate | null; reason: string | null } {
  if (!optin.published) {
    return { gate: 'published', reason: 'draft' };
  }

  if (optin.suspended !== null) {
    // The sentence is the Optin list's own, carried verbatim, so the two
    // screens cannot disagree about why. There is no key for it.
    return { gate: 'suspended', reason: 'suspended' };
  }

  if (optin.targeting !== null && !optin.targeting.admits) {
    return { gate: 'targeting', reason: targetingKey(optin.targeting) };
  }

  // Absent from the payload after Targeting admitted it: something between the
  // two dropped it, and "it did not arrive" is the honest report rather than a
  // guess about which cache did it.
  if (optin.audienceAllowed === false) return { gate: 'targeting', reason: 'audience_server' };

  if (!reached.has(optin.id) || entry === null) {
    return { gate: 'payload', reason: 'not_in_payload' };
  }

  // ==========================================================================
  // OUTSIDE ITS WINDOW, BEFORE THE ALLOWANCE — THE SAME ORDER `decide` ASKS.
  // ==========================================================================
  // The engine answers `capped` for both, deliberately (ADR 0047), and this is
  // where the two part company: a merchant told *"this browser has already had
  // its allowance"* about a sale that starts on Friday goes looking for a
  // cookie. It sits AFTER `payload` because a scheduled Optin IS in the
  // published set and DOES reach the browser before its window opens — which
  // is the decision the whole feature turns on, readable off the sequence.
  if ((entry.standing === 'capped' || entry.standing === 'waiting') && entry.schedule !== null) {
    return {
      gate: 'schedule',
      reason: entry.schedule === 'before' ? 'before_window' : 'after_window',
    };
  }

  // ==========================================================================
  // THE SAME WORD, THE OTHER SENTENCE — AND NO TWELFTH GATE.
  // ==========================================================================
  // The site's allowance and this Optin's own both produce `capped`, and both
  // sit behind the `frequency` gate, because they are the same question at two
  // scopes (ADR 0047). What differs is where the merchant goes next: one is a
  // setting on the Optin in front of them, the other is a site-wide setting
  // that is quietly stopping every Optin on this page at once.
  //
  // The SITE is what they are told about, because it is the veto: an Optin
  // cannot opt out of it, so naming the Optin's own allowance would send them
  // to a setting that decided nothing. It sits after the schedule for the
  // mirror reason — a sale that starts on Friday is a date they set.
  if (entry.standing === 'capped' && siteCapped) {
    return { gate: 'frequency', reason: 'site_capped' };
  }

  if (entry.lostArbitration) {
    return { gate: 'won', reason: entry.placementStatus === 'automatic_missing' ? 'automatic_missing'
      : entry.placementStatus === 'automatic_ready' ? 'automatic_lost' : 'lost' };
  }

  if (entry.standing === 'ready') {
    return { gate: null, reason: null };
  }

  // The engine's own word for it, one to one, never re-derived from the rules:
  // `Standing` is what `decide` concluded and this screen exists to report it.
  // What the gate map adds is WHERE in the sequence each standing sits, which
  // is a fact about the funnel rather than about the Optin.
  return { gate: GATE_OF[entry.standing] ?? null, reason: entry.standing };
}

/**
 * Which gate each engine standing sits behind.
 *
 * `ready` is absent because it is not a stop — it is every gate open, and
 * {@link stoppedAt} returns before reaching here.
 */
const GATE_OF: Readonly<Record<string, Gate>> = {
  capped: 'frequency',
  blocked: 'consent',
  inert: 'trigger',
  ineligible: 'conditions',
  waiting: 'fired',
  shown: 'won',
};

/**
 * Which Targeting gate closed.
 *
 * **The visitor predicate is reported as a fact about THIS request, never
 * simulated.** The merchant is signed in — that is what let them open the
 * panel — so "what does a signed-out visitor see" is unanswerable, and the two
 * keys say which direction it is rather than pretending to answer.
 */
function targetingKey(targeting: TargetingReport): string {
  if (targeting.reason === 'wrong_visitor') {
    return targeting.logged_in?.wanted === true ? 'wants_signed_in' : 'wants_signed_out';
  }

  // The second visitor predicate, and its own key rather than a third arm of
  // the one above: the two send a merchant to different places. "You are
  // signed in" is a setting they can read off their own account; this is a
  // fact about the account they happen to be signed in as.
  if (targeting.reason === 'wrong_role') {
    return 'wants_role';
  }

  return targeting.reason ?? 'not_in_payload';
}

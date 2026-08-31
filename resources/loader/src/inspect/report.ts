import type { Arrival } from './arrival';
import type { EntryReport } from './explain';

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
 *   → Frequency allows → Consent given → Trigger exists → Conditions hold
 *   → Trigger fired → won the overlay
 * ```
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
  readonly targeting: TargetingReport | null;
}

export interface TargetingReport {
  readonly admits: boolean;
  readonly reason: string | null;
  readonly logged_in: { wanted: boolean; holds: boolean } | null;
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

/** Where an Optin stopped, and what to say about it. */
export interface Row {
  readonly optin: ServerOptin;
  /** The key into `labels.stopped`, or null where it is showing. */
  readonly stopped: string | null;
  /**
   * Substituted into the sentence, where it takes one.
   *
   * Only the arbitration sentence does, and what it takes is the NAME of the
   * Optin that won — never "priority". Two overlays at equal priority are
   * broken by the ULID, which is creation order, and telling a merchant their
   * popup lost on priority when both were zero would send them to change a
   * number that decides nothing.
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
 *   and the honest report is that it did not arrive.
 */
export function funnel(
  server: ServerReport,
  browser: readonly EntryReport[],
  reached: ReadonlySet<string>,
  arrival: Arrival,
): Funnel {
  const byId = new Map(browser.map((entry) => [entry.id, entry]));
  const names = new Map(server.optins.map((optin) => [optin.id, optin.name]));
  const winner = browser.find((entry) => entry.overlay && entry.standing === 'ready' && !entry.lostArbitration);

  return {
    arrival,
    rows: server.optins.map((optin) => {
      const entry = byId.get(optin.id) ?? null;

      return {
        optin,
        stopped: stoppedAt(optin, entry, reached),
        subject:
          entry !== null && entry.lostArbitration && winner !== undefined
            ? (names.get(winner.id) ?? winner.id)
            : null,
        // An Optin stopped on the server has no browser half, and the panel
        // says so rather than drawing an empty table under it.
        browser: entry,
      };
    }),
  };
}

/**
 * The first gate that closed, in the order they are actually applied.
 *
 * Order is the whole content of this function. An Optin that is both a draft
 * and suspended is a DRAFT — telling its author it is suspended sends them to
 * reactivate a plugin when what they needed was the Publish button.
 */
function stoppedAt(optin: ServerOptin, entry: EntryReport | null, reached: ReadonlySet<string>): string | null {
  if (!optin.published) {
    return 'draft';
  }

  if (optin.suspended !== null) {
    // The sentence is the Optin list's own, carried verbatim, so the two
    // screens cannot disagree about why. There is no key for it.
    return 'suspended';
  }

  if (optin.targeting !== null && !optin.targeting.admits) {
    return targetingKey(optin.targeting);
  }

  if (!reached.has(optin.id)) {
    return 'not_in_payload';
  }

  if (entry === null) {
    return 'not_in_payload';
  }

  if (entry.lostArbitration) {
    return 'lost';
  }

  // The engine's own word for it, one to one — `capped`, `blocked`, `inert`,
  // `ineligible`, `waiting`, `shown`. Never re-derived from the rules, because
  // `Standing` is what `decide` concluded and this screen exists to report it.
  return entry.standing === 'ready' ? null : entry.standing;
}

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

  return targeting.reason ?? 'not_in_payload';
}

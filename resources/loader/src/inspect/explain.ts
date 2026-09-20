import { decide, isOverlay, isSiteCapped, rulesOf, type Decision, type Standing, type Verdict } from '../decide';
import type { PayloadEntry, Presenter, Rule } from '../types';

/**
 * Why each Optin on this page is where it is — **from the real decision, not
 * from a second one**.
 *
 * ============================================================================
 * `decide.ts` DOES NOT CHANGE. NOT ONE LINE.
 * ============================================================================
 * The obvious way to build this screen is to make the engine report as it
 * goes. That is a debug mode in the shipped loader, and it is rejected on the
 * LEAK rather than on the bytes: `window.wconvert.candidates` behind a
 * guessable query parameter exposes campaign ids and rule state on a page that
 * may be in a public full-page cache, and a capability check cannot rescue it
 * — `Routes::canCapture()` already records why nothing baked into a cached
 * page authenticates anyone.
 *
 * So this wraps each evaluator to RECORD its answer and then calls the real
 * `decide()`. There is one spelling of the decision, `Standing` is never
 * re-derived, and drift is structurally impossible rather than test-enforced.
 * Nothing in the production module graph imports this file, so
 * `npm run check:loader` must print byte-identical numbers — a non-zero delta
 * means something leaked and the change is wrong.
 *
 * ============================================================================
 * THREE ANSWERS PER RULE, NEVER TWO.
 * ============================================================================
 * `true`, `false`, and **`null` for not evaluated**. That third one is
 * mandatory: a rule withheld by a consent plugin was NOT EVALUATED and did not
 * FAIL, and a red cross beside it teaches a merchant to go and fix a rule that
 * is perfectly fine.
 */

/** `null` means this rule was not evaluated — never that it failed. */
export type Answer = boolean | null;

export interface RuleReport {
  readonly rule: Rule;
  readonly answer: Answer;
  /**
   * No module in this build evaluates this rule type.
   *
   * Reported apart from the answer because the two are different facts and the
   * merchant can act on only one of them: an unsupported Trigger is why the
   * Optin is `inert`, and it is fixed by having the module rather than by
   * changing the rule.
   */
  readonly unsupported: boolean;
}

export interface EntryReport {
  readonly placementStatus?: string;
  readonly recoveryStatus?: string;
  readonly id: string;
  readonly displayType?: string;
  readonly placement?: string;
  readonly standing: Standing;
  readonly overlay: boolean;
  readonly triggers: readonly RuleReport[];
  readonly conditions: readonly RuleReport[];
  /**
   * It was `ready` and something else took the page view.
   *
   * ==========================================================================
   * THE GATE WITH NO WORD IN THE PRODUCT.
   * ==========================================================================
   * `arbitrate()` silently drops a `ready` overlay when a higher-priority one
   * won, and there is no `Standing` that says so — "ready but not shown" is
   * exactly what a merchant is looking at when they ask why their popup did
   * not appear.
   *
   * It is DERIVED from `verdict.show` against `standing === 'ready'` rather
   * than being an eighth `Standing`, because the standing is a fact about ONE
   * Optin and this is a fact about the page.
   */
  readonly lostArbitration: boolean;
  /**
   * Which side of its scheduled window this Optin is on, or null where it is
   * inside one or has none.
   *
   * ==========================================================================
   * A FACT ABOUT THE ENTRY, NOT A SEVENTH `Standing`.
   * ==========================================================================
   * `decide` answers `capped` for an Optin outside its window, exactly as it
   * does for one whose allowance is spent, and that is deliberate: ADR 0047
   * argues at length against widening a closed vocabulary to carry a
   * distinction this screen can render as a sentence beside the word it
   * already uses. So the distinction is derived here, from the same inputs the
   * decision was taken on, AFTER it was taken — the same arrangement
   * {@link lostArbitration} has, and for the same reason.
   *
   * `after` beats `before`: a campaign with both boundaries behind it is
   * finished, and telling its author it has not started yet sends them looking
   * for a date that already passed.
   */
  readonly schedule: 'before' | 'after' | null;
}

/**
 * The browser's half of the report: every row, and the one fact that is about
 * the PAGE rather than about any row on it.
 *
 * ============================================================================
 * `siteCapped` IS NOT A FIELD ON A ROW, BECAUSE IT IS THE SAME ON EVERY ROW.
 * ============================================================================
 * {@link EntryReport.lostArbitration} and {@link EntryReport.schedule} are
 * both derived after the verdict too, and both belong to a row because both
 * DIFFER between rows. This one cannot: the site's allowance is spent or it is
 * not, and repeating that answer once per Optin invites a reader to believe
 * the rows could disagree.
 *
 * So it travels beside them, the way `funnel()` already takes the page-level
 * set of ids that reached the browser.
 */
export interface BrowserReport {
  readonly entries: readonly EntryReport[];
  /**
   * This device has spent the allowance the whole SITE shares (ADR 0047).
   *
   * `decide` answers `capped` for that exactly as it does for an Optin whose
   * own allowance is spent, and deliberately: a seventh `Standing` to tell
   * them apart widens a vocabulary the design keeps closed, to carry a
   * distinction a sentence can. So the distinction is derived here, from the
   * same inputs the decision was taken on and after it was taken — the same
   * arrangement the two fields above have.
   *
   * It is true whenever the site's allowance is spent, INCLUDING where an
   * Optin's own is spent as well. The site is a veto, so it is what the
   * merchant is told about.
   */
  readonly siteCapped: boolean;
}

export interface Explanation extends BrowserReport {
  /** The verdict the page actually took. */
  readonly verdict: Verdict;
}

export interface PresentationChecks {
  select?: Presenter['select'];
  recovery?: (entry: PayloadEntry, decision: Decision) => string | undefined;
  placement?: (entry: PayloadEntry) => string | undefined;
}

export function explain(decision: Decision, presentation: PresentationChecks = {}): Explanation {
  const answers = new Map<Rule, boolean>();

  // ==========================================================================
  // THE ONE SPELLING OF THE DECISION.
  // ==========================================================================
  // Each evaluator is wrapped to record what it said, and then the REAL
  // `decide` is run over the wrappers. The short-circuit in
  // `conditions.every()` is not worked around — it IS the answer to which
  // condition failed, and a rule it never reached is one this map has no entry
  // for.
  const watched = new Map(
    [...decision.evaluators].map(([type, evaluator]) => [
      type,
      {
        holds: (rule: Rule): boolean => {
          try {
            const held = evaluator.holds(rule);

            // Recorded as `decide` reads it — `=== true` — so a module
            // returning something truthy-but-not-true is reported as the
            // false the engine acted on rather than as the true it said.
            answers.set(rule, held === true);

            return held;
          } catch (error) {
            // `decide` catches this and fails the rule shut (ADR 0004). The
            // report says the same thing, because that is what happened.
            answers.set(rule, false);
            throw error;
          }
        },
      },
    ]),
  );

  const decided = decide({ ...decision, evaluators: watched });
  const verdict = { ...decided, show: presentation.select?.(decided.show) ?? decided.show };
  const showing = new Set(verdict.show.map((entry) => entry.id));
  // One fact about the page, asked once, from the same predicate the decision
  // was taken with rather than from a second spelling of it.
  const siteCapped = isSiteCapped(decision);
  const standings = new Map(verdict.candidates.map((candidate) => [candidate.id, candidate.standing]));

  // Everything `decide` skipped is filled in HERE, after the verdict is taken,
  // where an answer cannot change it. A merchant looking at a `capped` Optin
  // still wants to know whether their rules would have passed.
  for (const entry of decision.entries) {
    if (withheldOn(entry, decision)) {
      // NOT EVALUATED, and it stays that way. This is the whole reason
      // `Answer` has three values.
      continue;
    }

    for (const rule of rulesOf(entry)) {
      if (!answers.has(rule) && decision.evaluators.has(rule.type)) {
        answers.set(rule, held(decision, rule));
      }
    }
  }

  return {
    verdict,
    siteCapped,
    entries: decision.entries.map((entry) => {
      const standing = standings.get(entry.id) ?? 'inert';

      return {
        id: entry.id,
        displayType: entry.display_type,
        placement: entry.placement,
        placementStatus: presentation.placement?.(entry),
        recoveryStatus: presentation.recovery ? presentation.recovery(entry, decision)
          : (entry as PayloadEntry & { teaser?: unknown }).teaser ? 'Reopen settings are saved; this feature requires Pro.' : undefined,
        standing,
        overlay: isOverlay(entry),
        triggers: (entry.triggers ?? []).map((rule) => report(rule, answers, decision)),
        conditions: (entry.conditions ?? []).map((rule) => report(rule, answers, decision)),
        lostArbitration: standing === 'ready' && !showing.has(entry.id),
        schedule: sideOfWindow(entry, decision.now),
      };
    }),
  };
}

/**
 * Which side of its window, on the same clock reading `decide` was given.
 *
 * Not re-read from `Date.now()`: a second reading could land the panel on the
 * other side of a boundary from the verdict it is explaining, which is the one
 * way this screen could contradict the page it runs on.
 */
function sideOfWindow(entry: PayloadEntry, now: number): 'before' | 'after' | null {
  if (entry.ends_at !== undefined && now >= entry.ends_at) {
    return 'after';
  }

  return entry.starts_at !== undefined && now < entry.starts_at ? 'before' : null;
}

/** Does any rule on this entry need consent this visitor has withheld? */
const withheldOn = (entry: PayloadEntry, decision: Decision): boolean =>
  rulesOf(entry).some((rule) => decision.withheld.has(rule.type));

/**
 * Ask one rule, outside the decision.
 *
 * Fail-shut on a throw, exactly as `decide` does: a rule reaching for
 * something this browser does not have must not take the panel down with it.
 */
function held(decision: Decision, rule: Rule): boolean {
  try {
    return decision.evaluators.get(rule.type)?.holds(rule) === true;
  } catch {
    return false;
  }
}

const report = (rule: Rule, answers: ReadonlyMap<Rule, boolean>, decision: Decision): RuleReport => ({
  rule,
  answer: answers.has(rule) ? (answers.get(rule) as boolean) : null,
  unsupported: !decision.evaluators.has(rule.type),
});

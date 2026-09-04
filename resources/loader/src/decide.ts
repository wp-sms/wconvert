import type { Frequency, PayloadEntry, Rule, RuleEvaluator, VisitorState } from './types';
import { isAllowed } from './frequency';
import { isWithinWindow } from './schedule';
import { SITE_SLOT } from './state';

/**
 * The whole decision, in one pure call.
 *
 * Pure is the load-bearing word. Every live reading — the clock, the scroll
 * position, the viewport — is behind a {@link RuleEvaluator}, so this function
 * cannot cache an answer it was not given, and the shell re-runs it on every
 * signal change. That is what makes "all Conditions hold **at the instant** a
 * Trigger fires" a property of the shape rather than a rule to remember.
 */

/**
 * Why an Optin is or is not on screen.
 *
 * The two-axis rule model exists so an engine holding several eligible Optins
 * can tell `waiting` from `ineligible` (ADR 0005). Without the split, both
 * collapse into "not showing", and "why didn't my popup show?" has no answer.
 */
export type Standing =
  /** A Trigger fired and every Condition held at that instant. */
  | 'ready'
  /** Eligible, but no Trigger has fired yet. */
  | 'waiting'
  /** No Trigger this build can ever fire — an empty list, or every one unknown here. */
  | 'inert'
  /** A Condition does not hold. It may come to. */
  | 'ineligible'
  /** A rule needs Storage Consent this visitor has not given. Not evaluated, not failed. */
  | 'blocked'
  /** The allowance is spent. The one answer that cannot change on this page view. */
  | 'capped'
  /** Already shown, this page view. */
  | 'shown';

export interface Candidate {
  readonly id: string;
  readonly standing: Standing;
  readonly overlay: boolean;
}

export interface Verdict {
  /** Show these, now, in this order. */
  readonly show: readonly PayloadEntry[];
  /** Could anything still be SHOWN on this page view? When false, tear the listeners down. */
  readonly live: boolean;
  readonly candidates: readonly Candidate[];
}

export interface Decision {
  readonly entries: readonly PayloadEntry[];
  /** Rule type => its evaluator. A type absent here has no module in this build. */
  readonly evaluators: ReadonlyMap<string, RuleEvaluator>;
  /** Rule types whose Storage Consent this visitor has withheld. */
  readonly withheld: ReadonlySet<string>;
  readonly state: VisitorState;
  /**
   * The allowance the whole site shares, or **undefined where there is none**.
   *
   * ==========================================================================
   * A VETO, NOT A VOTE — AND ABSENT IS THE SHIPPED DEFAULT.
   * ==========================================================================
   * The same four fields as an entry's own {@link PayloadEntry.frequency},
   * held once for the whole site and checked against {@link SITE_SLOT} rather
   * than against any Optin's record (ADR 0047). An Optin cannot opt out of it:
   * a per-Optin *ignore the site setting* is the configuration two scopes
   * exist to delete.
   *
   * Undefined is what a site that has asked for nothing sends — which is every
   * site until a merchant configures one, because all four fields default OFF
   * at this scope. *One dismissal silences the entire site for a week* is a
   * claim about what the visitor meant that they did not make, so the page
   * carries no allowance at all and this decision is byte-for-byte the one it
   * takes today.
   */
  readonly siteFrequency?: Frequency;
  /** Whole days since the epoch. */
  readonly day: number;
  /**
   * The wall clock, in milliseconds — the schedule's comparand, and only that.
   *
   * Beside {@link day} rather than replacing it, and the two precisions are
   * the point. `day` is what a [[Frequency]] cooldown asks about and what is
   * WRITTEN to the visitor's device, deliberately coarse because a per-device
   * value at millisecond precision is most of the way back to the artefact
   * ADR 0017 removed. This is compared against a number the SERVER authored
   * and is never stored anywhere. One clock reading produces both.
   */
  readonly now: number;
  /** Ids already shown on this page view. */
  readonly shown: ReadonlySet<string>;
  /** Has an overlay already had this page view? Set on SHOW, so a dismissal cannot un-set it. */
  readonly overlayDone: boolean;
}

/**
 * `inline` renders where it was embedded and never competes; the other three
 * are overlays and compete for the screen (CONTEXT.md, Display Type).
 *
 * Anything unrecognised competes. That is the safe direction to be wrong in:
 * the worst it does is show one fewer thing, where reading it as inline could
 * put two overlays on one screen.
 */
export const isOverlay = (entry: PayloadEntry): boolean => entry.display_type !== 'inline';

/**
 * Every rule an entry carries, both axes, in one list.
 *
 * The axes are separate because kind decides how a rule is READ — any one
 * Trigger, all Conditions. Questions about the rules themselves, like which
 * modules this page needs or which need consent, are asked of all of them.
 */
export const rulesOf = (entry: PayloadEntry): readonly Rule[] => [
  ...(entry.triggers ?? []),
  ...(entry.conditions ?? []),
];

/** Nothing is live except what could still change, so `capped`, `inert` and `shown` are not. */
const STILL_LIVE: ReadonlySet<Standing> = new Set<Standing>(['ready', 'waiting', 'ineligible', 'blocked']);

/**
 * Has this device spent the allowance the whole site shares?
 *
 * Asked ONCE per decision rather than per entry, because it is one fact about
 * the page — and asked at all only where the site has configured an allowance,
 * which is what keeps a site that has asked for nothing on exactly today's
 * path (ADR 0047).
 *
 * Exported so the eligibility inspector can tell a site-vetoed Optin from one
 * whose own allowance is spent **without a second spelling of the question**.
 * `explain.ts` calls the real `decide` for exactly that reason; a copy of this
 * predicate beside it is the same drift one indirection along.
 */
export const isSiteCapped = (decision: Decision): boolean =>
  decision.siteFrequency !== undefined &&
  !isAllowed(decision.siteFrequency, decision.state[SITE_SLOT], decision.day);

export function decide(decision: Decision): Verdict {
  const candidates: Candidate[] = [];
  const ready: PayloadEntry[] = [];
  const siteCapped = isSiteCapped(decision);

  for (const entry of decision.entries) {
    const standing = standingOf(entry, decision, siteCapped);

    candidates.push({ id: entry.id, standing, overlay: isOverlay(entry) });

    if (standing === 'ready') {
      ready.push(entry);
    }
  }

  const show = arbitrate(ready, decision.overlayDone);
  const showing = new Set(show.map((entry) => entry.id));
  const overlayClosed = decision.overlayDone || show.some(isOverlay);

  return {
    show,
    // "Could it still become ready" is not enough: an overlay behind a
    // dismissal is ready forever and will never be shown again, and a page
    // held live for it never releases its listeners. What keeps the page live
    // is a candidate that could still be SHOWN.
    live: candidates.some(
      (candidate) =>
        STILL_LIVE.has(candidate.standing) &&
        !showing.has(candidate.id) &&
        (!candidate.overlay || !overlayClosed),
    ),
    candidates,
  };
}

function standingOf(entry: PayloadEntry, decision: Decision, siteCapped: boolean): Standing {
  if (decision.shown.has(entry.id)) {
    return 'shown';
  }

  // ==========================================================================
  // THE SCHEDULE AND THE TWO SCOPES OF THE ALLOWANCE. ALL THREE ARE `capped`.
  // ==========================================================================
  // `capped` already means *the allowance is spent, and this cannot change on
  // this page view*, which is what being outside a scheduled window is. A
  // seventh member of `Standing` distinguishing the two is the thing to
  // resist: it widens a vocabulary the whole design keeps closed, to carry a
  // distinction `inspect/explain.ts` renders as a sentence beside the one word
  // (ADR 0047).
  //
  // The schedule is asked FIRST because it is the more surprising answer and
  // the one the merchant can act on: "your sale has not started" sends them to
  // a date they set, where "this browser has had its allowance" is a fact
  // about one device. The inspector reports whichever gate this order picked.
  //
  // The SITE's allowance is asked before the Optin's own, and that order is
  // the veto written down: it holds whatever this Optin's own Frequency says,
  // so reporting the Optin's would send a merchant to a setting that decided
  // nothing.
  if (
    !isWithinWindow(entry, decision.now) ||
    siteCapped ||
    !isAllowed(entry.frequency, decision.state[entry.id], decision.day)
  ) {
    return 'capped';
  }

  const triggers = entry.triggers ?? [];
  const conditions = entry.conditions ?? [];

  // Consent is asked before evaluation, not folded into it. An Optin whose
  // rules need a category the visitor has withheld is NOT EVALUATED rather
  // than evaluated-as-false, so it can still fire later in the same page view
  // when consent arrives (issue #11).
  if (rulesOf(entry).some((rule) => decision.withheld.has(rule.type))) {
    return 'blocked';
  }

  // ADR 0012's zero-trigger loss, named rather than hidden inside "waiting".
  // An Optin with an empty trigger list, or whose every trigger names a type
  // this build has no module for, can NEVER fire — so calling it "waiting"
  // holds a timer open for the rest of the visit waiting for a moment that
  // cannot arrive. Checked before the conditions, because a failing condition
  // is temporary and this is not.
  if (!triggers.some((rule) => decision.evaluators.has(rule.type))) {
    return 'inert';
  }

  const holds = (rule: Rule): boolean => {
    try {
      return decision.evaluators.get(rule.type)?.holds(rule) === true;
    } catch {
      // One rule reaching for something this browser does not have must not
      // take every Optin on the page down with it. That is ADR 0004's failure
      // mode exactly — silent, total, one line in a console nobody reads — and
      // `decide` runs inside scroll handlers and timers where a throw is
      // uncatchable from anywhere useful. A rule that cannot answer does not
      // hold, which is the same fail-shut rule an unknown type already gets.
      return false;
    }
  };

  // Conditions first, and re-read on every call: this is the instant.
  if (!conditions.every(holds)) {
    return 'ineligible';
  }

  return triggers.some(holds) ? 'ready' : 'waiting';
}

/**
 * At most one overlay per page view, and no runner-up after a dismissal.
 *
 * Priority first, then id — deterministic, so the winner is never a property of
 * the order the published set happened to be built in.
 */
function arbitrate(ready: readonly PayloadEntry[], overlayDone: boolean): readonly PayloadEntry[] {
  const inline = ready.filter((entry) => !isOverlay(entry));

  if (overlayDone) {
    return inline;
  }

  const winner = ready
    .filter(isOverlay)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.id < b.id ? -1 : 1))[0];

  return winner === undefined ? inline : [winner, ...inline];
}

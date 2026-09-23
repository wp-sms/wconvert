import type { Frequency, PayloadEntry, Rule, RuleEvaluator, VisitorState } from './types';
import { isAllowed } from './frequency';
import { audienceMatches, audienceRules, openingMatches, openingRules, type Answer } from './display-rules';
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
  readonly elapsedSeconds?: number;
  readonly visible?: boolean;
  readonly sessionCounts?: Readonly<Record<string, number>>;
  readonly activeOverlay?: string;
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
export const rulesOf = (entry: PayloadEntry): readonly Rule[] => entry.display_rules
  ? [...openingRules(entry.display_rules), ...audienceRules(entry.display_rules), ...(entry.required_rules ?? [])] : [];

/** Shared by automatic opening, explicit activation, recovery, and diagnostics. */
export function audienceAnswer(entry: PayloadEntry, decision: Decision): Answer {
  if (!entry.display_rules) return false;
  const read = (rule: Rule): Answer => readRule(rule, decision);
  const required = entry.required_rules ?? [];
  for (const rule of required) { const answer = read(rule); if (answer !== true) return answer; }
  return audienceMatches(entry.display_rules.audience, read);
}
export function readRule(rule: Rule, decision: Decision): Answer {
  if (decision.withheld.has(rule.type)) return 'blocked';
  try { return decision.evaluators.get(rule.type)?.holds(rule) === true; } catch { return false; }
}
export function explicitBlock(entry: PayloadEntry, decision: Decision): string | null {
  if ((entry.starts_at !== undefined && decision.now < entry.starts_at) || (entry.ends_at !== undefined && decision.now >= entry.ends_at)) return 'schedule';
  if (entry.frequency?.stopAfterConversion !== false && decision.state[entry.id]?.c === 1) return 'conversion';
  if (decision.siteFrequency && decision.siteFrequency.stopAfterConversion !== false && decision.state[SITE_SLOT]?.c === 1) return 'site_conversion';
  if (decision.activeOverlay && decision.activeOverlay !== entry.id) return 'collision';
  const answer = audienceAnswer(entry, decision);
  return answer === true ? null : answer === 'blocked' ? 'consent' : 'condition';
}

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

  const explicit = ready.filter(entry => entry.display_rules?.opening.mode === 'click');
  const show = arbitrate(explicit.length ? explicit : ready, Boolean(decision.activeOverlay) || (decision.overlayDone && !explicit.length));
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
        (!showing.has(candidate.id) || decision.entries.find(entry => entry.id === candidate.id)?.display_rules?.opening.mode === 'click') &&
        (!candidate.overlay || !overlayClosed || decision.entries.find(entry => entry.id === candidate.id)?.display_rules?.opening.mode === 'click'),
    ),
    candidates,
  };
}

function standingOf(entry: PayloadEntry, decision: Decision, siteCapped: boolean): Standing {
  const plan = entry.display_rules;
  if (!plan || (plan.opening.mode !== 'immediate' && !plan.opening.rules.length)) return 'inert';
  const explicit = plan.opening.mode === 'click';
  if (!explicit && decision.shown.has(entry.id)) return 'shown';
  // Loss of any supplied implementation suspends the whole authored policy.
  if (rulesOf(entry).some(rule => !decision.evaluators.has(rule.type) && !decision.withheld.has(rule.type))) return 'inert';
  if (entry.ends_at !== undefined && decision.now >= entry.ends_at) return 'capped';
  if (entry.starts_at !== undefined && decision.now < entry.starts_at) return 'waiting';
  if (explicit) {
    const block = explicitBlock(entry, decision);
    if (block) return block === 'consent' ? 'blocked' : 'ineligible';
  } else if (siteCapped || !isAllowed(entry.frequency, decision.state[entry.id], decision.day)
    || (entry.frequency?.maxPerSession !== undefined && (decision.sessionCounts?.[entry.campaign ?? entry.id] ?? 0) >= entry.frequency.maxPerSession)) return 'capped';
  const audience = audienceAnswer(entry, decision);
  if (audience !== true) return audience === 'blocked' ? 'blocked' : 'ineligible';
  if (decision.visible === false) return 'waiting';
  const opening = openingMatches(plan.opening, rule => readRule(rule, decision), decision.elapsedSeconds ?? 0);
  return opening === true ? 'ready' : opening === 'blocked' ? 'blocked' : 'waiting';
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

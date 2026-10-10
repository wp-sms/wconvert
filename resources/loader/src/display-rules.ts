import type { Rule } from './types';

/** Fixed depth: alternative audience groups, each containing only leaves. */
export interface RuleGroup {
  readonly id?: string;
  readonly match: 'all' | 'any';
  readonly rules: readonly Rule[];
}
export type Audience = { readonly mode: 'everyone' } | { readonly mode: 'groups'; readonly groups: readonly RuleGroup[] };
export type Opening = { readonly mode: 'immediate' }
  | { readonly mode: 'automatic'; readonly minimum_seconds?: number; readonly match: 'all' | 'any'; readonly rules: readonly Rule[] }
  | { readonly mode: 'click'; readonly rules: readonly Rule[] };
export interface DisplayPlan { readonly audience: Audience; readonly opening: Opening }
export type Answer = boolean | 'blocked';
export type ReadRule = (rule: Rule) => Answer;

/**
 * One leaf's answer once its "is not" is applied (ADR 0139) — the one place a
 * negation is read, shared by the decision, the inspector and Test a visit.
 *
 * Only a settled yes or no flips. `blocked` stays blocked, because consent is
 * still withheld; and an answer that is not `known` yet (a cart still loading)
 * is false, so "their cart is empty" never shows before the cart has said so.
 */
export const leafAnswer = (rule: Rule, raw: Answer, known = true): Answer =>
  raw === 'blocked' || rule.negate !== true ? raw : known && !raw;

/** Shared three-valued ALL/ANY reduction, including empty-group rejection. */
function combine<T>(rules: readonly T[], match: 'all' | 'any', read: (rule: T) => Answer): Answer {
  if (!rules.length || !['all', 'any'].includes(match)) return false;
  let blocked = false;
  for (const rule of rules) {
    const answer = read(rule);
    if (answer === 'blocked') blocked = true;
    else if (match === 'all' && !answer) return false;
    else if (match === 'any' && answer) return true;
  }
  return blocked ? 'blocked' : match === 'all';
}
export function groupMatches(group: RuleGroup, read: ReadRule): Answer {
  return combine(group.rules, group.match, read);
}
export function audienceMatches(audience: Audience, read: ReadRule): Answer {
  return audience.mode === 'everyone' || combine(audience.groups, 'any', group => groupMatches(group, read));
}
export function openingMatches(opening: Opening, read: ReadRule, elapsedSeconds: number): Answer {
  if (opening.mode === 'immediate') return true;
  if (opening.mode === 'automatic' && elapsedSeconds < (opening.minimum_seconds ?? 0)) return false;
  return groupMatches({ match: opening.mode === 'click' ? 'any' : opening.match, rules: opening.rules }, read);
}
export const audienceRules = (plan: DisplayPlan): readonly Rule[] => plan.audience.mode === 'everyone'
  ? [] : plan.audience.groups.flatMap(group => group.rules);
export const openingRules = (plan: DisplayPlan): readonly Rule[] => plan.opening.mode === 'immediate' ? [] : plan.opening.rules;

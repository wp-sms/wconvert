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

/** Empty or malformed groups never become a wider audience. */
export function groupMatches(group: RuleGroup, read: ReadRule): Answer {
  if (!group.rules.length || !['all', 'any'].includes(group.match)) return false;
  let blocked = false;
  for (const rule of group.rules) {
    const answer = read(rule);
    if (answer === 'blocked') blocked = true;
    else if (group.match === 'all' && !answer) return false;
    else if (group.match === 'any' && answer) return true;
  }
  return blocked ? 'blocked' : group.match === 'all';
}
export function audienceMatches(audience: Audience, read: ReadRule): Answer {
  if (audience.mode === 'everyone') return true;
  let blocked = false;
  for (const group of audience.groups) {
    const answer = groupMatches(group, read);
    if (answer === true) return true;
    if (answer === 'blocked') blocked = true;
  }
  return blocked ? 'blocked' : false;
}
export function openingMatches(opening: Opening, read: ReadRule, elapsedSeconds: number): Answer {
  if (opening.mode === 'immediate') return true;
  if (opening.mode === 'automatic' && elapsedSeconds < (opening.minimum_seconds ?? 0)) return false;
  return groupMatches({ match: opening.mode === 'click' ? 'any' : opening.match, rules: opening.rules }, read);
}
export const audienceRules = (plan: DisplayPlan): readonly Rule[] => plan.audience.mode === 'everyone'
  ? [] : plan.audience.groups.flatMap(group => group.rules);
export const openingRules = (plan: DisplayPlan): readonly Rule[] => plan.opening.mode === 'immediate' ? [] : plan.opening.rules;

import { groupProblems } from './validation';
import type { DisplayPlan, RuleGroup } from '@loader/display-rules';
import type { Rule, RuleType } from '../api';
import { phraseOf } from './sentence';
import { __ } from '@wordpress/i18n';

import { newAuthoringId as newRuleId } from '../../authoringId';
export { newRuleId };
export const emptyGroup = (): RuleGroup => ({ id: newRuleId(), match: 'all', rules: [] });
export const freshRule = (rule: Rule): Rule => ({ ...rule, id: newRuleId() });
export const incompletePlan = (): DisplayPlan => ({ audience: { mode: 'everyone' }, opening: { mode: 'automatic', match: 'all', rules: [] } });
export const planFrom = (value: unknown): DisplayPlan | undefined => value && typeof value === 'object' && 'audience' in value && 'opening' in value ? value as DisplayPlan : undefined;
export function groupSummary(group: RuleGroup, types: readonly RuleType[]) {
  const parts = group.rules.map(rule => phraseOf(rule as Rule, types));
  return { text: parts.length ? parts.map(part => part.text).join(group.match === 'all' ? __(' AND ', 'wconvert') : __(' OR ', 'wconvert')) : __('Add a rule', 'wconvert'),
    attention: !parts.length || parts.some(part => part.attention) || groupProblems(group, types).length > 0 };
}

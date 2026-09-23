import { groupProblems } from './validation';
import { __ } from '@wordpress/i18n';
import type { RuleGroup } from '@loader/display-rules';
import type { Rule, RuleType } from '../api';
import { RuleRow } from './RuleRow';
import { RuleRows } from '../RuleRows';
import { AddRule } from './AddRule';
import { freshRule } from './plan';

export function GroupEditor({ group, types, onChange, offset = 0, operator = true }: {
  group: RuleGroup; types: readonly RuleType[]; onChange: (group: RuleGroup) => void; offset?: number; operator?: boolean;
}) {
  const problems = groupProblems(group, types);
  return <div className="wconvert-display-group">
    {operator && <label className="wconvert-display-match">{__('Match', 'wconvert')}{' '}
      <select aria-label={__('Match requirements', 'wconvert')} value={group.match} onChange={event => onChange({ ...group, match: event.target.value as 'all' | 'any' })}>
        <option value="all">{__('All rules (AND)', 'wconvert')}</option><option value="any">{__('Any rule (OR)', 'wconvert')}</option>
      </select>
    </label>}
    {operator && group.rules.length > 1 && <p className="wconvert-display-rule-help">{group.match === 'all'
      ? __('Every rule below must match together.', 'wconvert')
      : __('One matching rule below is enough.', 'wconvert')}</p>}
    <RuleRows rows={group.rules.map((rule, index) => ({ key: String(rule.id ?? index),
      content: <RuleRow rule={rule as Rule} at={offset + index} types={types} onChange={next => onChange({ ...group, rules: group.rules.map((old, at) => at === index ? { ...next, id: old.id } : old) })} />,
      onRemove: () => onChange({ ...group, rules: group.rules.filter((_old, at) => at !== index) }),
    }))} empty={__('Choose a rule below to get started.', 'wconvert')} />
    {problems.length > 0 && <ul role="alert" className="text-note text-destructive">{problems.map((problem, index) => <li key={index}>{problem}</li>)}</ul>}
    {group.rules.length < 8 && <AddRule axis={types} label={__('Add a rule', 'wconvert')} onAdd={rule => onChange({ ...group, rules: [...group.rules, freshRule(rule)] })} />}
  </div>;
}

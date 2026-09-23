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
    {operator && <label className="wconvert-display-match">{__('Visitors must match', 'wconvert')}{' '}
      <select aria-label={__('Match requirements', 'wconvert')} value={group.match} onChange={event => onChange({ ...group, match: event.target.value as 'all' | 'any' })}>
        <option value="all">{__('ALL of these rules', 'wconvert')}</option><option value="any">{__('ANY of these rules', 'wconvert')}</option>
      </select>
    </label>}
    <RuleRows rows={group.rules.map((rule, index) => ({ key: String(rule.id ?? index),
      content: <RuleRow rule={rule as Rule} at={offset + index} types={types} onChange={next => onChange({ ...group, rules: group.rules.map((old, at) => at === index ? { ...next, id: old.id } : old) })} />,
      onRemove: () => onChange({ ...group, rules: group.rules.filter((_old, at) => at !== index) }),
    }))} empty={__('Add a requirement to complete this group.', 'wconvert')} />
    {problems.length > 0 && <ul role="alert" className="text-note text-destructive">{problems.map((problem, index) => <li key={index}>{problem}</li>)}</ul>}
    {group.rules.length < 8 && <AddRule axis={types} label={__('Add a rule', 'wconvert')} onAdd={rule => onChange({ ...group, rules: [...group.rules, freshRule(rule)] })} />}
  </div>;
}

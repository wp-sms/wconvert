import { useId, type ReactNode } from 'react';
import { groupProblems } from './validation';
import { __ } from '@wordpress/i18n';
import type { RuleGroup } from '@loader/display-rules';
import type { Rule, RuleType } from '../api';
import { RuleRow } from './RuleRow';
import { RuleRows } from '../RuleRows';
import { AddRule } from './AddRule';
import { freshRule } from './plan';

export function GroupEditor({ group, types, onChange, offset = 0, operator = true, heading }: {
  group: RuleGroup; types: readonly RuleType[]; onChange: (group: RuleGroup) => void; offset?: number; operator?: boolean;
  /** The group's own title row, drawn inside its box. */
  heading?: ReactNode;
}) {
  const problems = groupProblems(group, types);
  const name = useId();
  return <div className="wconvert-display-group">
    {heading}
    {/* A choice of how rules combine means nothing until there are two of them. */}
    {operator && group.rules.length > 1 && <fieldset className="wconvert-display-match">
      <legend className="sr-only">{__('How the rules combine', 'wconvert')}</legend>
      <label><input type="radio" name={name} checked={group.match === 'all'} onChange={() => onChange({ ...group, match: 'all' })} />{__('Must match every rule', 'wconvert')}</label>
      <label><input type="radio" name={name} checked={group.match === 'any'} onChange={() => onChange({ ...group, match: 'any' })} />{__('Any one rule is enough', 'wconvert')}</label>
    </fieldset>}
    <RuleRows rows={group.rules.map((rule, index) => ({ key: String(rule.id ?? index),
      label: types.find(type => type.type === rule.type)?.label ?? __('unavailable rule', 'wconvert'),
      content: <RuleRow rule={rule as Rule} at={offset + index} types={types} onChange={next => onChange({ ...group, rules: group.rules.map((old, at) => at === index ? { ...next, id: old.id } : old) })} />,
      onRemove: () => onChange({ ...group, rules: group.rules.filter((_old, at) => at !== index) }),
    }))} empty={__('Add at least one rule', 'wconvert')} attention />
    {problems.length > 0 && <ul role="alert" className="text-note text-destructive">{problems.map((problem, index) => <li key={index}>{problem}</li>)}</ul>}
    {group.rules.length < 8 && <AddRule axis={types} label={__('Add a rule', 'wconvert')} onAdd={rule => onChange({ ...group, rules: [...group.rules, freshRule(rule)] })} />}
  </div>;
}

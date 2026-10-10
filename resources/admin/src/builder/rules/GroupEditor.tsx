import { type ReactNode } from 'react';
import { groupProblems } from './validation';
import { __ } from '@wordpress/i18n';
import type { RuleGroup } from '@loader/display-rules';
import type { Rule, RuleType } from '../api';
import { NativeSelect } from '../../components/ui/native-select';
import { InfoTip } from '../../shell/InfoTip';
import { RuleRow } from './RuleRow';
import { ruleHelp } from './ruleHelp';
import { RuleRows } from '../RuleRows';
import { AddRule } from './AddRule';
import { freshRule } from './plan';

/** The most rules one group holds; `DisplayPlan::leaves()` refuses a ninth. */
const MAX_RULES = 8;

/**
 * One group of rules, read as a sentence (ADR 0139): a heading that says how
 * they combine — "Match [all ▾] of these", shown even with one rule so the
 * group's grammar is visible before the second arrives — rows joined by "and"
 * or "or" to match, and the limit said in words where Add a rule was.
 *
 * `match` is the heading's words around the select, e.g. "Match" and "of
 * these". Without it (click mode) only the rows show.
 */
export function GroupEditor({ group, types, onChange, offset = 0, match, title, actions, autoOpenAdd = false, onAddClosed }: {
  group: RuleGroup; types: readonly RuleType[]; onChange: (group: RuleGroup) => void; offset?: number;
  match?: { readonly before: string; readonly after: string; readonly label: string; readonly order: readonly ('all' | 'any')[] };
  /** The group's own name, e.g. "Group 1". */
  title?: string;
  /** Beside the heading, e.g. Remove group. */
  actions?: ReactNode;
  /** Open the rule picker as the group appears, as a new group does. */
  autoOpenAdd?: boolean;
  onAddClosed?: () => void;
}) {
  const problems = groupProblems(group, types);
  const words = { all: __('all', 'wconvert'), any: __('any', 'wconvert') };
  const joiner = group.match === 'all' ? __('and', 'wconvert') : __('or', 'wconvert');

  return <section className="wconvert-display-group" aria-label={title}>
    {(title !== undefined || match !== undefined) && <div className="wconvert-display-group__head">
      {title !== undefined && <span className="wconvert-display-group__name">{title}</span>}
      {title !== undefined && match !== undefined && <span aria-hidden="true" className="wconvert-display-group__dot">·</span>}
      {match !== undefined && <span className="wconvert-display-group__match">
        {match.before}{' '}
        <NativeSelect variant="word" aria-label={match.label} value={group.match}
          onChange={event => onChange({ ...group, match: event.target.value === 'any' ? 'any' : 'all' })}>
          {match.order.map(value => <option key={value} value={value}>{words[value]}</option>)}
        </NativeSelect>{' '}
        {match.after}
      </span>}
      {actions}
    </div>}
    <div className="wconvert-display-group__rows">
      <RuleRows joiner={match !== undefined ? joiner : undefined} rows={group.rules.map((rule, index) => ({ key: String(rule.id ?? index),
        label: types.find(type => type.type === rule.type)?.label ?? __('unavailable rule', 'wconvert'),
        help: ruleHelp(rule.type),
        content: <RuleRow rule={rule as Rule} at={offset + index} types={types} onChange={next => onChange({ ...group, rules: group.rules.map((old, at) => at === index ? { ...next, id: old.id } : old) })} />,
        onRemove: () => onChange({ ...group, rules: group.rules.filter((_old, at) => at !== index) }),
      }))} empty={__('Add at least one rule', 'wconvert')} attention />
      {problems.length > 0 && <ul role="alert" className="text-note text-destructive">{problems.map((problem, index) => <li key={index}>{problem}</li>)}</ul>}
      {group.rules.length < MAX_RULES
        ? <AddRule axis={types} label={__('Add a rule', 'wconvert')} autoOpen={autoOpenAdd} onClose={onAddClosed}
          onAdd={rule => onChange({ ...group, rules: [...group.rules, freshRule(rule)] })} />
        : <p className="wconvert-display-limit">{__('Up to 8 rules in a group', 'wconvert')}
          <InfoTip label={__('About the rule limit', 'wconvert')}>{__('A group holds up to eight rules. Add another group, or remove a rule first.', 'wconvert')}</InfoTip></p>}
    </div>
  </section>;
}

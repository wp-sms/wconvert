import { __ } from '@wordpress/i18n';
import { Description } from '../../shell/Description';
import { RuleRows, type Row } from '../RuleRows';
import { AddRule } from './AddRule';
import { RuleRow } from './RuleRow';
import type { Entry } from './axis';
import type { Rule, RuleType } from '../api';

/**
 * *Who* sees it — the [[Condition]] axis, as the Who section's body.
 *
 * The mirror of {@link When}, and separate from it for the reason the two
 * lists were always separate: a rule type is a Trigger or a Condition and
 * never both (CONTEXT.md, Condition). `scroll_depth` means "when they reach
 * half way" and there is no second spelling meaning "if they already had". One
 * list with a kind column would read as a choice the merchant makes.
 *
 * **Every Condition holds**, so the sentence joins them with "and" — again the
 * axis's own connective. The two sections differ in exactly that word and in
 * nothing else, which is why the shared parts are `RuleRow` and `AddRule`
 * rather than one component taking a discriminator.
 */
export interface WhoProps {
  readonly types: readonly RuleType[];
  readonly entries: readonly Entry[];
  readonly replace: (at: number, rule: Rule) => void;
  readonly remove: (at: number) => void;
  readonly add: (rule: Rule) => void;
  readonly all: readonly RuleType[];
}

export function Who({ types, entries, replace, remove, add, all }: WhoProps) {
  const rows: Row[] = entries.map(([rule, at]) => ({
    key: String(at),
    content: <RuleRow rule={rule} at={at} types={all} onChange={(next) => replace(at, next)} />,
    onRemove: () => remove(at),
  }));

  return (
    <>
      <Description>{__('All of these must be true when it fires.', 'wconvert')}</Description>
      <RuleRows rows={rows} empty={__('Nothing yet.', 'wconvert')} />
      <AddRule axis={types} label={__('Add a condition', 'wconvert')} onAdd={add} />
    </>
  );
}

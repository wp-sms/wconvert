import { __ } from '@wordpress/i18n';
import { RuleRows, type Row } from '../RuleRows';
import { AddRule } from './AddRule';
import { RuleRow } from './RuleRow';
import type { Entry } from './axis';
import type { Rule, RuleType } from '../api';

/**
 * *When* it fires — the [[Trigger]] axis, as the When section's body.
 *
 * ============================================================================
 * IT IS HANDED ENTRIES AND THREE CALLBACKS. IT NEVER SEES A FILTERED COPY.
 * ============================================================================
 * The rules are stored FLAT and in the merchant's own order, and every edit
 * lands at the rule's own index. `RulesEditor` kept that invariant by owning
 * both lists in one component; splitting the screen into four files is exactly
 * where it would quietly be lost, so it is made structural instead: this
 * component is given `[rule, index]` pairs and has no array of its own to
 * rebuild. Rebuilding would silently reorder the merchant's list into
 * triggers-then-conditions on every save.
 *
 * **Any one Trigger fires**, so the sentence over this section joins them with
 * "or" — the axis's own connective, never a choice on offer. There is no
 * grouping UI anywhere on this screen and ADR 0005's nesting ceiling is
 * permanent.
 */
export interface WhenProps {
  readonly types: readonly RuleType[];
  readonly entries: readonly Entry[];
  readonly replace: (at: number, rule: Rule) => void;
  readonly remove: (at: number) => void;
  readonly add: (rule: Rule) => void;
  /** Every type on every axis, so a row can name what its rule stands in for. */
  readonly all: readonly RuleType[];
}

export function When({ types, entries, replace, remove, add, all }: WhenProps) {
  // **Every Optin has at least one Trigger** and "shows immediately" is the
  // explicit `page_load` one, never an empty list (CONTEXT.md, Trigger). The
  // last one keeps no remove control, and the save route refuses the same
  // state — one of those is a screen and the other is the guarantee.
  const removable = entries.length > 1;

  const rows: Row[] = entries.map(([rule, at]) => ({
    key: String(at),
    content: <RuleRow rule={rule} at={at} types={all} onChange={(next) => replace(at, next)} />,
    onRemove: removable ? () => remove(at) : null,
  }));

  return (
    <>
      <p className="description">{__('Fires when any of these happens.', 'wconvert')}</p>
      <RuleRows rows={rows} empty={__('Nothing yet.', 'wconvert')} />
      <AddRule axis={types} label={__('Add a trigger', 'wconvert')} onAdd={add} />
    </>
  );
}

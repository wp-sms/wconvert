import type { Rule, RuleType } from '../api';

/**
 * One rule, and **where it sits in the flat list it is stored in**.
 *
 * ============================================================================
 * THE INDEX IS THE WHOLE POINT, AND THE REASON THIS IS A FILE.
 * ============================================================================
 * The rules are stored flat and in the merchant's own order, and the four
 * sections on screen are a VIEW of that list — never four lists. Every edit
 * has to land at the rule's own index, because rebuilding the flat list from
 * the sections would silently reorder it into triggers-then-conditions on
 * every save, and the rule list is a screen the merchant looks at.
 *
 * `RulesEditor` kept that invariant inside one component, where the split into
 * four files could quietly lose it. Handing every section `[rule, index]`
 * pairs instead of a filtered copy makes it structural: a section literally
 * has no filtered array to map over, so it cannot rebuild one.
 */
export type Entry = readonly [Rule, number];

/** The rules on one axis, paired with their flat indices, in stored order. */
export function entriesOn(rules: readonly Rule[], types: readonly RuleType[]): readonly Entry[] {
  return pairs(rules).filter(([rule]) => types.some((type) => type.type === rule.type));
}

/**
 * The rules on NO axis this build knows — which still reach a row.
 *
 * Filtering them away would leave such a rule invisible AND unremovable: still
 * in `config`, still saved back, with nothing on screen to act on. The
 * vocabulary is closed (ADR 0005), so this is rare; "rare and silent" is the
 * combination that earns it a section of its own.
 */
export function entriesOffEveryAxis(rules: readonly Rule[], types: readonly RuleType[]): readonly Entry[] {
  return pairs(rules).filter(([rule]) => !types.some((type) => type.type === rule.type));
}

const pairs = (rules: readonly Rule[]): Entry[] => rules.map((rule, index) => [rule, index] as const);

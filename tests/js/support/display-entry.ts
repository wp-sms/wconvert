import type { PayloadEntry, Rule } from '@loader/types';
import type { DisplayPlan } from '@loader/display-rules';

/** Concise fixture builder. Production accepts only the canonical display plan. */
export function displayPlan(triggers: readonly Rule[] = [], conditions: readonly Rule[] = []): DisplayPlan {
  const rows = (rules: readonly Rule[]) => rules.map((rule, index) => ({ ...rule, id: `r-${rule.type}-${index}` }));
  return { audience: conditions.length ? { mode: 'groups', groups: [{ id: 'audience', match: 'all', rules: rows(conditions) }] } : { mode: 'everyone' },
    opening: triggers.length === 1 && triggers[0].type === 'page_load' ? { mode: 'immediate' }
      : triggers.length && triggers.every(rule => rule.type === 'click_element') ? { mode: 'click', rules: rows(triggers) }
        : { mode: 'automatic', match: 'any', rules: rows(triggers) } };
}
export function displayEntry<T extends Partial<PayloadEntry>>(input: T): T {
  const { triggers, conditions, ...entry } = input;
  const plan = displayPlan(triggers, conditions);
  return { ...entry, display_rules: { audience: conditions === undefined && input.display_rules ? input.display_rules.audience : plan.audience,
    opening: triggers === undefined && input.display_rules ? input.display_rules.opening : plan.opening } } as T;
}

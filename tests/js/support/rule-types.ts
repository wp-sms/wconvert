import manifest from '../../../resources/rules/manifest.json';
import type { Control, RuleType, RuleVocabulary } from '../../../resources/admin/src/builder/api';
import type { Availability } from '../../../resources/admin/src/goals/availability';

/**
 * The rule vocabulary as the builder receives it, built from the manifest that
 * ships.
 *
 * Read from the file rather than hand-written, so a test cannot pass against a
 * vocabulary the product does not have — the same reason
 * `tests/js/renderer-manifest-parity.test.ts` reads the template manifest. The
 * route that serves this in production adds words and [[Availability]]
 * (`src/Rules/RuleCatalogue.php`, asserted in PHP); the words are stood in for
 * here, because nothing in the builder's logic reads them.
 */

interface Declared {
  readonly kind: string;
  readonly tier: string;
  readonly params: Record<string, { control: string; options?: string[]; authored?: boolean }>;
  readonly presets: Record<string, Record<string, unknown>>;
}

/**
 * @param availability How this install resolves each tier — `locked` is what a
 *   free install makes of a `pro` entry, and it is the case the rules panel
 *   has to render as an upsell rather than as a control (ADR 0026).
 */
export function ruleTypes(
  availability: Readonly<Record<string, Availability>> = { free: 'ready', pro: 'ready' },
): RuleVocabulary {
  const axis = (name: 'targeting' | 'triggers' | 'conditions'): RuleType[] =>
    Object.entries(manifest[name] as unknown as Record<string, Declared>).map(([type, entry]) => ({
      type,
      kind: entry.kind,
      label: type,
      tier: entry.tier,
      availability: availability[entry.tier] ?? 'ready',
      params: Object.fromEntries(
        Object.entries(entry.params).map(([name, param]) => [
          name,
          {
            control: param.control as Control,
            label: name,
            authored: param.authored === true,
            options: (param.options ?? []).map((value) => ({ value, label: value })),
          },
        ]),
      ),
      presets: Object.entries(entry.presets).map(([id, fixed]) => ({ id, label: id, fixed })),
    }));

  return { targeting: axis('targeting'), triggers: axis('triggers'), conditions: axis('conditions') };
}

/** Every type across every axis, which is what the row reader is given. */
export const allRuleTypes = (availability?: Readonly<Record<string, Availability>>): RuleType[] =>
  Object.values(ruleTypes(availability)).flat();

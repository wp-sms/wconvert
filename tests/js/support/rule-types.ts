import manifest from '../../../resources/rules/manifest.json';
import type { Control, RuleBundle, RuleType, RuleVocabulary } from '../../../resources/admin/src/builder/api';
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
  readonly requires?: string | null;
  readonly params: Record<string, { control: string; options?: string[]; authored?: boolean }>;
  readonly presets: Record<string, Record<string, unknown>>;
}

/**
 * @param availability How this install resolves each RUNG of the ladder, keyed
 *   by tier slug — `free`, `basic`, `pro`, `elite` (ADR 0056). `locked` is what
 *   a free install makes of a paid entry, and it is the case the rules panel
 *   has to render as an upsell rather than as a control (ADR 0026).
 *
 *   **A rung left out reads as `ready`**, so a caller names only the rungs its
 *   assertion is about. That default is deliberately generous rather than
 *   fail-closed: this is a fixture, and a test that silently rendered every
 *   unnamed rule as an upsell would assert upsells nobody wrote.
 */
export function ruleTypes(
  availability: Readonly<Record<string, Availability>> = {},
): RuleVocabulary {
  const axis = (name: 'targeting' | 'triggers' | 'conditions'): RuleType[] =>
    Object.entries(manifest[name] as unknown as Record<string, Declared>).map(([type, entry]) => ({
      type,
      kind: entry.kind,
      label: type,
      phrase: phraseFor(type, Object.keys(entry.params)),
      tier: entry.tier,
      availability: availability[entry.tier] ?? 'ready',
      requires_label: entry.requires === null || entry.requires === undefined ? null : 'WooCommerce',
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
      presets: Object.entries(entry.presets).map(([id, fixed]) => ({
        id,
        label: id,
        // A preset's phrase takes the params it does NOT fix, in declared
        // order — which is the rule `RuleLabelParityTest` pins in PHP and the
        // one the sentence depends on to substitute the right value.
        phrase: phraseFor(id, Object.keys(entry.params).filter((param) => !(param in fixed))),
        fixed,
      })),
    }));

  return {
    targeting: axis('targeting'),
    triggers: axis('triggers'),
    conditions: axis('conditions'),
    bundles: [],
  };
}

/**
 * A stand-in phrase: the key, then one positional placeholder per open param.
 *
 * ============================================================================
 * GENERATED RATHER THAN COPIED, FOR THE SAME REASON THE REST OF THIS FILE IS.
 * ============================================================================
 * The real phrases are `WConvert\Rules\RuleLabels`', where `make-pot` can see
 * them, and hand-copying English here would let a test pass against words the
 * product does not have. What the summary logic actually depends on is the
 * ARITY and the ORDER of the placeholders — that `time_on_page` takes one and
 * `query_param` takes two, and that `%2$s` is the second declared param — and
 * that is exactly what this reproduces. PHP asserts the shipped phrases have
 * the same arity, from the same manifest.
 */
const phraseFor = (key: string, open: readonly string[]): string =>
  [key, ...open.map((_param, index) => `%${index + 1}$s`)].join(' ');

/** A Starting point, for the one screen that renders them. */
export const ruleBundle = (bundle: Partial<RuleBundle> = {}): RuleBundle => ({
  id: 'after-a-read',
  label: 'Once they have read a while',
  description: 'Waits fifteen seconds.',
  availability: 'ready',
  requires_label: null,
  triggers: [{ type: 'time_on_page', seconds: 15 }],
  ...bundle,
});

/** Every type across every axis, which is what the row reader is given. */
export const allRuleTypes = (availability?: Readonly<Record<string, Availability>>): RuleType[] =>
  Object.values(ruleTypes(availability)).flat();

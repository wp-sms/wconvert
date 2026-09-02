import { entriesOffEveryAxis, entriesOn } from './axis';
import { HowOften } from './HowOften';
import { Section } from './Section';
import { StartingPoints, type BundlePatch } from './StartingPoints';
import { Unknown } from './Unknown';
import { When } from './When';
import { Where } from './Where';
import { Who } from './Who';
import { summarise, type DisplayRulesValue } from './summaries';
import type { Rule, RuleVocabulary } from '../api';

/**
 * Display rules: four questions, four disclosures, one flat list underneath.
 *
 * ============================================================================
 * THE SECTIONS ARE A VIEW. NOTHING ABOUT THE RULE MODEL CHANGES.
 * ============================================================================
 * Where, When, Who and How often are four answers a merchant already has to
 * give; what changed is that they can now see each answer without opening it.
 * Underneath, the rules are still flat, still ANDed across axes and ORed
 * within the Trigger one, and **there is still no ALL/ANY grouping anywhere**.
 * ADR 0005's nesting ceiling is permanent rather than "not in v1": "we'll add
 * OR later" is the path by which an expression language arrives, and a builder
 * that drew the brackets would be that path. The connectives in the summaries
 * are the AXES' own, never the merchant's.
 *
 * ============================================================================
 * THE INVARIANT THAT HAD TO SURVIVE THE SPLIT.
 * ============================================================================
 * `RulesEditor` landed every edit at the rule's own index in the flat list,
 * because rebuilding that list from the filtered views would silently reorder
 * the merchant's rules into triggers-then-conditions on every save — and the
 * rule list is a screen they look at.
 *
 * Four files is where that would quietly be lost, so this component owns
 * `rules` and hands When and Who the same four things: `entries` as
 * `[rule, index]` pairs, `replace(at, rule)`, `remove(at)` and `add(rule)`.
 * Neither section is ever given a filtered array, so neither has one to
 * rebuild. That is strictly stronger than what it replaced, where the
 * invariant was a habit rather than a shape.
 *
 * ============================================================================
 * ONE PATCH OUT, SO A STARTING POINT IS ONE HISTORY ENTRY.
 * ============================================================================
 * Applying a bundle can change Triggers, Conditions, Targeting and the
 * allowance at once. Four callbacks would be four saves and four undo steps
 * for one click, so what leaves here is a patch of everything that changed.
 */
/**
 * **The value moved to `summaries.ts`, which is where the four sentences are
 * now built.** Re-exported here because this is where a caller looks for it,
 * and because moving a name is not the same as moving a screen.
 */
export type { DisplayRulesValue } from './summaries';

export interface DisplayRulesProps {
  readonly vocabulary: RuleVocabulary;
  readonly value: DisplayRulesValue;
  /**
   * Whether this Optin competes for the screen.
   *
   * `arbitrate()` sorts overlays only, so on an `inline` design the priority
   * control decides nothing and is not drawn.
   */
  readonly overlay: boolean;
  readonly onChange: (patch: Partial<DisplayRulesValue>) => void;
}

export function DisplayRules({ vocabulary, value, overlay, onChange }: DisplayRulesProps) {
  const { rules, targeting, frequency, schedule, priority } = value;
  const client = [...vocabulary.triggers, ...vocabulary.conditions];
  const all = [...vocabulary.targeting, ...client];

  const replace = (at: number, rule: Rule) =>
    onChange({ rules: rules.map((each, index) => (index === at ? rule : each)) });
  const remove = (at: number) => onChange({ rules: rules.filter((_each, index) => index !== at) });
  const add = (rule: Rule) => onChange({ rules: [...rules, rule] });

  const triggers = entriesOn(rules, vocabulary.triggers);
  const conditions = entriesOn(rules, vocabulary.conditions);

  /*
   * **Built by `summaries.ts`, which the readiness panel above these tabs
   * reads too.** The four sentences and the four questions were spelled here
   * and would have been spelled a second time up there — same axes, same
   * order, and two chances to call one of them something different.
   */
  const [where, when, who, often] = summarise(value, vocabulary, overlay);

  return (
    <div className="wconvert-sections">
      <Section id={where.id} eyebrow={where.eyebrow} summary={where.text} attention={where.attention}>
        <Where types={vocabulary.targeting} targeting={targeting} onChange={(next) => onChange({ targeting: next })} />
      </Section>

      <Section id={when.id} eyebrow={when.eyebrow} summary={when.text} attention={when.attention}>
        <When
          types={vocabulary.triggers}
          entries={triggers}
          replace={replace}
          remove={remove}
          add={add}
          all={all}
        />
      </Section>

      <Section id={who.id} eyebrow={who.eyebrow} summary={who.text} attention={who.attention}>
        <Who
          types={vocabulary.conditions}
          entries={conditions}
          replace={replace}
          remove={remove}
          add={add}
          all={all}
        />
      </Section>

      <Section id={often.id} eyebrow={often.eyebrow} summary={often.text}>
        <HowOften
          frequency={frequency}
          schedule={schedule}
          priority={priority}
          overlay={overlay}
          onFrequency={(next) => onChange({ frequency: next })}
          onSchedule={(next) => onChange({ schedule: next })}
          onPriority={(next) => onChange({ priority: next })}
        />
      </Section>

      <Unknown entries={entriesOffEveryAxis(rules, client)} remove={remove} all={all} />

      <StartingPoints bundles={vocabulary.bundles} onApply={(patch) => onChange(applied(patch, value, vocabulary))} />
    </div>
  );
}

/**
 * A [[Starting point]] folded into the working draft.
 *
 * **It replaces the sections the bundle names and nothing else.** A bundle
 * carrying only Conditions leaves the merchant's Triggers where they are —
 * wiping them would leave an Optin that can never fire, which the save route
 * refuses outright, so the "improve my rules" button would break the Optin.
 *
 * The flat list is rebuilt HERE, deliberately and once: replacing one axis
 * means removing the rules of that axis and appending the bundle's, which is
 * the one operation that genuinely cannot be expressed as an edit at an index.
 * It is also the one place a reorder is what the merchant asked for.
 */
function applied(patch: BundlePatch, value: DisplayRulesValue, vocabulary: RuleVocabulary): Partial<DisplayRulesValue> {
  const next: { -readonly [K in keyof DisplayRulesValue]?: DisplayRulesValue[K] } = {};

  if (patch.triggers !== undefined || patch.conditions !== undefined) {
    const replaced = [
      ...(patch.triggers === undefined ? [] : vocabulary.triggers),
      ...(patch.conditions === undefined ? [] : vocabulary.conditions),
    ];

    next.rules = [
      ...value.rules.filter((rule) => !replaced.some((type) => type.type === rule.type)),
      ...((patch.triggers ?? []) as Rule[]),
      ...((patch.conditions ?? []) as Rule[]),
    ];
  }

  if (patch.targeting !== undefined) {
    next.targeting = patch.targeting;
  }

  if (patch.frequency !== undefined) {
    next.frequency = patch.frequency;
  }

  return next;
}

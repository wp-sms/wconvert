import type { Rule, RulePreset, RuleType } from './api';

/**
 * The preset ↔ engine-type translation, in both directions.
 *
 * ============================================================================
 * A PRESET CAN NEVER BECOME A SECOND ENGINE TYPE.
 * ============================================================================
 * "One engine type, many UI presets" (ADR 0005): the engine gets the general
 * form — `query_param {key, value}` — and the builder ships the legible
 * shortcuts over it. A rich admin over a small closed vocabulary depends on
 * that being the standing rule, and the standing rule is only as good as the
 * translation that keeps it.
 *
 * Two things make it hold here. A preset is declared INSIDE the entry for the
 * type it fixes params on, so it has no field to name a type with; and
 * {@link toRule} emits the type's OWN name and only the type's OWN params, so
 * a preset carrying anything else contributes nothing rather than smuggling a
 * key past the vocabulary.
 */

/**
 * The general form a preset stands for, with the merchant's values in it.
 *
 * The preset's fixed params win over the merchant's, because they are what the
 * preset IS: a merchant who wants a different `key` has picked the wrong
 * shortcut, and honouring their value would produce a rule the panel would
 * then draw as some other preset.
 */
export function toRule(type: RuleType, preset: RulePreset | null, filled: Record<string, unknown>): Rule {
  const rule: Rule = { type: type.type };

  for (const param of Object.keys(type.params)) {
    const value = preset !== null && param in preset.fixed ? preset.fixed[param] : filled[param];

    if (value !== undefined) {
      rule[param] = value;
    }
  }

  return rule;
}

/**
 * Which preset a stored rule is wearing, and what was filled in beside it.
 *
 * The counterpart of {@link toRule}, and the half that decides whether a
 * preset is a shortcut or a second type: a rule the panel cannot read back is
 * a rule the merchant can only edit as raw params, and a vocabulary with two
 * editing surfaces is two vocabularies.
 *
 * A preset matches when every param it fixes carries the value it fixes. The
 * FIRST match in declaration order wins, so a manifest declaring two presets
 * that fix the same values resolves to the one written first rather than to
 * whichever `Object.keys` happened to yield — an ordering the merchant can see
 * and change.
 *
 * `preset: null` is the general form itself, which is not a failure: a
 * merchant who typed their own `utm_term` is using the engine directly, and
 * the panel draws the params rather than pretending the rule is something
 * else.
 */
export function fromRule(rule: Rule, types: readonly RuleType[]): ReadRule | null {
  const type = types.find((candidate) => candidate.type === rule.type);

  if (type === undefined) {
    return null;
  }

  const preset = type.presets.find((candidate) => fixes(candidate, rule)) ?? null;
  const values: Record<string, unknown> = {};
  const filled: Record<string, unknown> = {};

  for (const param of Object.keys(type.params)) {
    if (!(param in rule)) {
      continue;
    }

    values[param] = rule[param];

    if (!(preset !== null && param in preset.fixed)) {
      filled[param] = rule[param];
    }
  }

  return { type, preset, values, filled };
}

export interface ReadRule {
  readonly type: RuleType;
  readonly preset: RulePreset | null;
  /**
   * Every declared param the rule carries, preset-fixed ones included.
   *
   * This is what a merchant leaving a preset for the general form keeps:
   * dropping to "set it myself" from "came from a particular source" should
   * hand them `utm_source` to edit, not an empty `key` and a rule that matches
   * every visitor. {@link filled} is the other reading of the same rule and
   * both are wanted — one is what to KEEP, the other is what to DRAW.
   */
  readonly values: Record<string, unknown>;
  /** What the merchant supplied beyond the preset — the controls to draw. */
  readonly filled: Record<string, unknown>;
}

/** Does this rule carry everything the preset decides? */
function fixes(preset: RulePreset, rule: Rule): boolean {
  return Object.entries(preset.fixed).every(([param, value]) => same(rule[param], value));
}

/**
 * Value equality, one level of array deep.
 *
 * Which is exactly as deep as the vocabulary goes: a scalar is a string, a
 * number, a boolean or a SET of those — "the real OR cases are set-valued
 * scalars", and there is no nesting, ever (ADR 0005). A general deep-equal
 * would be answering a question the rule model does not ask.
 */
function same(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  return left === right;
}

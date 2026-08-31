import { describe, expect, it } from 'vitest';
import { allRuleTypes } from './support/rule-types';
import { fromRule, toRule } from '../../resources/admin/src/builder/presets';
import type { RuleType } from '../../resources/admin/src/builder/api';

/**
 * **One engine type, many UI presets** (ADR 0005).
 *
 * The engine gets the general form — `query_param {key, value}` — and the
 * builder ships the legible shortcuts over it: the UTM fields, "mobile only".
 * A rich admin over a small closed vocabulary depends on that being the
 * standing rule, so what is asserted here is that a preset can never become a
 * second engine type: it round-trips to its general form and back, and what
 * comes out the far side is a rule of the type it was declared under.
 */

const queryParam: RuleType = {
  type: 'query_param',
  kind: 'condition',
  label: 'Query parameter',
  phrase: '%1$s is %2$s',
  tier: 'pro',
  availability: 'ready',
  requires_label: null,
  params: {
    key: { control: 'text', label: 'Key', authored: false, options: [] },
    value: { control: 'text_set', label: 'Value', authored: false, options: [] },
  },
  presets: [
    { id: 'utm_source', label: 'Came from a campaign source', phrase: 'they came from %1$s', fixed: { key: 'utm_source' } },
  ],
};

describe('a preset, expanded to its general form', () => {
  it('is a rule of the type it was declared under, carrying what the preset fixes and what the merchant filled in', () => {
    const rule = toRule(queryParam, queryParam.presets[0], { value: ['google', 'bing'] });

    expect(rule).toEqual({ type: 'query_param', key: 'utm_source', value: ['google', 'bing'] });
  });
});

describe('a stored rule, read back', () => {
  it('is the preset it is wearing, and what the merchant filled in beside it', () => {
    const read = fromRule({ type: 'query_param', key: 'utm_source', value: ['google'] }, [queryParam]);

    expect(read).toEqual({
      degradedFrom: null,
      type: queryParam,
      preset: queryParam.presets[0],
      values: { key: 'utm_source', value: ['google'] },
      filled: { value: ['google'] },
    });
  });

  /**
   * The general form itself, which is not a failure to recognise a preset. A
   * merchant who typed their own `utm_term` is using the engine directly, and
   * a panel that could not draw that would be offering the presets as the
   * whole vocabulary rather than as shortcuts over it.
   */
  it('is the general form where no preset fits, with every param the merchant filled in', () => {
    const read = fromRule({ type: 'query_param', key: 'utm_term', value: ['sale'] }, [queryParam]);

    expect(read).toEqual({
      degradedFrom: null,
      type: queryParam,
      preset: null,
      values: { key: 'utm_term', value: ['sale'] },
      filled: { key: 'utm_term', value: ['sale'] },
    });
  });

  /**
   * A rule type this install does not have — a premium one on a free install,
   * or one a build removed. Null rather than an invented type: the vocabulary
   * is closed, and a panel that guessed would let a merchant edit a rule
   * nothing can evaluate.
   */
  it('is nothing at all where the vocabulary has no such type', () => {
    expect(fromRule({ type: 'moon_phase', in: ['waxing'] }, [queryParam])).toBeNull();
  });
});

/**
 * The round trip, over the vocabulary as it actually ships.
 *
 * The two tests above pin the translation with one hand-written type; this one
 * is what makes "no preset introduces a type of its own" a property of the
 * manifest rather than of the example. It fails the day a preset is declared
 * that fixes a param its type does not have, or that cannot be read back — the
 * two shapes in which a shortcut stops being a shortcut.
 *
 * The manifest is read here rather than fetched, exactly as the renderer's
 * parity test reads the template manifest: the route that serves it adds
 * words and [[Availability]], neither of which the translation looks at.
 */

/** One value per control, so a preset's remaining params have something to carry. */
const SAMPLE: Readonly<Record<string, unknown>> = {
  text: 'utm',
  text_set: ['google', 'bing'],
  seconds: 10,
  percent: 50,
  selector: '.buy',
  device_set: ['mobile', 'tablet'],
  boolean: true,
  post_id: '12',
  term_id: '3',
  post_type: 'post',
  path_glob: '/shop/*',
};

const TYPES = allRuleTypes();

const WITH_PRESETS = TYPES.flatMap((type) => type.presets.map((preset) => [type, preset] as const));

describe('every preset the manifest ships', () => {
  it('is declared under a type, so there is nowhere for it to name a second one', () => {
    // Not a tautology: it fails the day the manifest grows a top-level preset
    // list, which is exactly the shape in which a preset acquires a `type`
    // field of its own.
    expect(WITH_PRESETS.length).toBeGreaterThan(0);
  });

  it.each(WITH_PRESETS)('round-trips to its general form and back: %s', (type, preset) => {
    const filled = Object.fromEntries(
      Object.entries(type.params)
        .filter(([param]) => !(param in preset.fixed))
        .map(([param, { control }]) => [param, SAMPLE[control]]),
    );

    const rule = toRule(type, preset, filled);

    expect(rule.type).toBe(type.type);
    expect(fromRule(rule, TYPES)).toEqual({ type, preset, values: { ...preset.fixed, ...filled }, filled, degradedFrom: null });
    expect(toRule(type, preset, filled)).toEqual(rule);
  });
});

/**
 * **A preset is a shortcut over the engine type, never a replacement for it**
 * (ADR 0005) — so leaving one has to leave the merchant somewhere they can
 * work, not back at an empty rule.
 *
 * `values` is what makes that possible: it carries every declared param the
 * rule holds, preset-fixed ones included, which is exactly what the panel
 * hands back when the merchant drops to the general form.
 */
describe('leaving a preset for the general form', () => {
  it('keeps what the preset had decided, as something the merchant can now edit', () => {
    const wearing = fromRule({ type: 'query_param', key: 'utm_source', value: ['google'] }, [queryParam]);

    // What the panel does when the preset select moves to "Set it myself".
    expect(toRule(queryParam, null, wearing?.values ?? {})).toEqual({
      type: 'query_param',
      key: 'utm_source',
      value: ['google'],
    });
  });
});

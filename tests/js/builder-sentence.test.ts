import { describe, expect, it } from 'vitest';
import {
  howOftenSummary,
  phraseOf,
  whenSummary,
  whereSummary,
  whoSummary,
} from '../../resources/admin/src/builder/rules/sentence';
import { allRuleTypes, ruleTypes } from './support/rule-types';
import type { Entry } from '../../resources/admin/src/builder/rules/axis';
import type { Rule } from '../../resources/admin/src/builder/api';

/**
 * The four section summaries — pure, so they are tested without a DOM.
 *
 * ============================================================================
 * THE PHRASES ARE STOOD IN FOR, AND THE ARITY IS NOT.
 * ============================================================================
 * The shipped words are `WConvert\Rules\RuleLabels`', where `make-pot` can see
 * them, and `RuleLabelParityTest` asserts each has one positional placeholder
 * per param the rule leaves open — in both directions, against the same
 * manifest. Copying English here would let these pass against words the
 * product does not have, so `support/rule-types.ts` generates a phrase of the
 * right SHAPE instead: the type's key, then `%1$s`, `%2$s`.
 *
 * So `"time_on_page 20"` below is not the sentence a merchant reads. It is the
 * proof that the merchant's 20 landed in the first placeholder of the phrase
 * that belongs to that rule, which is the whole of what this file decides.
 */

const types = allRuleTypes();

/** Rules as the panel hands them over: paired with their flat indices. */
const entries = (...rules: Rule[]): Entry[] => rules.map((rule, index) => [rule, index] as const);

describe('where it shows', () => {
  /**
   * **Counts, never titles.** Turning `{type: 'post', value: '42'}` into
   * "Pricing" is a round trip to `wp/v2/search`, so a summary that named pages
   * would render blank and then flicker into words — on a collapsed row the
   * merchant is reading to decide whether to open it. Counts are synchronous
   * and stay correct when the lookup 500s or the post is unpublished.
   */
  it('counts the rules on each list', () => {
    expect(whereSummary({}).text).toBe('On every page');
    expect(whereSummary({ include: [{ type: 'url', value: '/a' }] }).text).toBe('On 1 page');
    expect(whereSummary({ exclude: [{ type: 'url', value: '/a' }] }).text).toBe('Everywhere except 1 page');
    expect(
      whereSummary({
        include: [
          { type: 'url', value: '/a' },
          { type: 'url', value: '/b' },
        ],
        exclude: [{ type: 'url', value: '/c' }],
      }).text,
    ).toBe('On 2 pages, except 1 page');
  });

  /**
   * `logged_in` is a clause rather than a count, because it is a FIELD beside
   * the two lists rather than a page rule: the lists are a union of page sets,
   * and a visitor predicate in one would widen the Optin to the whole site for
   * anyone matching it (ADR 0005).
   */
  it('adds the visitor predicate as a clause, and only when it is set', () => {
    expect(whereSummary({ logged_in: true }).text).toBe('On every page, signed-in visitors only');
    expect(whereSummary({ logged_in: false }).text).toBe('On every page, signed-out visitors only');
    expect(whereSummary({}).text).not.toMatch(/visitors/);
  });
});

describe('when it fires', () => {
  /**
   * **An Optin with no Trigger can never fire**, and the save route already
   * refuses one. The section says so before the click (ADR 0042 rule 3) and
   * reports itself incomplete, so the merchant's eye lands on it.
   */
  it('says so, and flags itself, when there is no trigger at all', () => {
    const summary = whenSummary([], types);

    expect(summary.text).toBe('Never — it has no trigger yet');
    expect(summary.incomplete).toBe(true);
  });

  /**
   * Any one Trigger fires, so the joiner is the axis's "or".
   *
   * The values are deliberately ones no preset fixes — 5 seconds IS
   * `after_a_moment` and 50% IS `halfway_down`, and reading those back as
   * their presets is the behaviour asserted further down. What is under test
   * here is the joiner.
   */
  it('joins triggers with or', () => {
    expect(whenSummary(entries({ type: 'page_load' }), types).text).toBe('Fires page_load');
    expect(
      whenSummary(entries({ type: 'page_load' }, { type: 'time_on_page', seconds: 20 }), types).text,
    ).toBe('Fires page_load or time_on_page 20');
  });

  it('reads three or more as a list', () => {
    expect(
      whenSummary(
        entries({ type: 'page_load' }, { type: 'time_on_page', seconds: 20 }, { type: 'scroll_depth', percent: 33 }),
        types,
      ).text,
    ).toBe('Fires page_load, time_on_page 20 or scroll_depth 33');
  });
});

describe('who sees it', () => {
  /** Every Condition holds at the instant a Trigger fires, so the joiner is "and". */
  it('joins conditions with and, and says so when there are none', () => {
    expect(whoSummary([], types).text).toBe('Anyone who reaches it');
    expect(
      whoSummary(entries({ type: 'device', in: ['mobile', 'tablet'] }, { type: 'cart_has_items' }), types).text,
    ).toBe('Only when device mobile or tablet and cart_has_items');
  });
});

describe('one rule, read', () => {
  /**
   * ==========================================================================
   * A PRESET'S OWN PHRASE WINS, WHICH IS WHAT MAKES IT A SHORTCUT.
   * ==========================================================================
   * "after a few seconds", not "after 5 seconds on the page" — the second is
   * the general form with extra steps, and it teaches the merchant that the
   * shortcut is `time_on_page` underneath, which is the one thing a preset
   * exists to spare them (ADR 0005).
   */
  it('reads a preset as the preset, not as its general form', () => {
    expect(phraseOf({ type: 'time_on_page', seconds: 5 }, types).text).toBe('after_a_moment');
  });

  /** A preset that leaves a param open takes it, in declared order. */
  it('fills the params a preset leaves open', () => {
    expect(phraseOf({ type: 'query_param', key: 'utm_source', value: ['google'] }, types).text).toBe(
      'utm_source google',
    );
  });

  /** The general form takes every declared param, in declared order. */
  it('fills a general form in declared order', () => {
    expect(phraseOf({ type: 'query_param', key: 'ref', value: ['a', 'b'] }, types).text).toBe('query_param ref a or b');
  });

  /**
   * A closed option set reads as the merchant's own word for it — a custom post
   * type's name is whatever its author registered, and `mobile` is "Mobile".
   */
  it('reads an option set through its labels, joined with or', () => {
    expect(phraseOf({ type: 'device', in: ['mobile', 'tablet'] }, types).text).toBe('device mobile or tablet');
  });

  /**
   * ==========================================================================
   * THE EMPTINESS TEST — A SECOND SPELLING OF `couldFire()`'s, DELIBERATELY
   * STRICTER.
   * ==========================================================================
   * An absent key, an empty string and an empty set all mean "nothing was
   * chosen"; `false` and `0` are values a merchant meant. That half is copied
   * exactly.
   *
   * **The `authored` exemption is NOT copied**, and that is the point. PHP
   * skips authored params so a save is not refused over a selector only the
   * merchant can supply — a `click_element` arriving blank from a [[Playbook]]
   * is the state prefill hands them to complete (ADR 0012). This is the
   * surface that has to TELL them to complete it.
   */
  it('says a rule needs a value rather than reading past a blank one', () => {
    const missing = phraseOf({ type: 'click_element' }, types);

    expect(missing.incomplete).toBe(true);
    expect(missing.text).toBe('click_element — needs selector');
    expect(phraseOf({ type: 'click_element', selector: '' }, types).incomplete).toBe(true);
    expect(phraseOf({ type: 'device', in: [] }, types).incomplete).toBe(true);
  });

  it('treats zero and false as values somebody meant', () => {
    expect(phraseOf({ type: 'scroll_depth', percent: 0 }, types).incomplete).toBe(false);
    expect(phraseOf({ type: 'logged_in', value: false }, types).incomplete).toBe(false);
  });

  /** It names every missing setting, not just the first. */
  it('names both settings when a general form is missing two', () => {
    expect(phraseOf({ type: 'query_param' }, types).text).toBe('query_param — needs key and value');
  });

  /** A type this build has never heard of reads as its raw key, like its row. */
  it('reads an unknown type as its key', () => {
    const unknown = phraseOf({ type: 'moon_phase' }, types);

    expect(unknown.text).toBe('moon_phase');
    expect(unknown.incomplete).toBe(true);
  });
});

describe('how often', () => {
  /**
   * ==========================================================================
   * THE DEFAULT IS NOT "EVERY TIME".
   * ==========================================================================
   * `stopAfterDismiss` and `stopAfterConversion` are both ON when absent —
   * `frequency.ts` tests `!== false`, because closing a popup and completing
   * one are the two strongest "stop showing me this" a visitor has (ADR 0017).
   * So an untouched Optin already stops, and a summary reading "Every time"
   * would be a lie on the commonest Optin there is.
   */
  it('reads an untouched allowance as stopping, not as unlimited', () => {
    expect(howOftenSummary({}, 0, true).text).toBe('Every time, until they close it or they sign up');
  });

  it('reads both switches off as genuinely every time', () => {
    expect(
      howOftenSummary({ stopAfterDismiss: false, stopAfterConversion: false }, 0, true).text,
    ).toBe('Every time, with no limit');
  });

  it('reads the counts, singular and plural', () => {
    expect(howOftenSummary({ maxImpressions: 1 }, 0, true).text).toMatch(/^Shows at most 1 time,/);
    expect(howOftenSummary({ maxImpressions: 3 }, 0, true).text).toMatch(/^Shows at most 3 times,/);
    expect(howOftenSummary({ cooldownDays: 7 }, 0, true).text).toMatch(/^Shows at most once every 7 days,/);
  });

  it('reads both counts and both switches together', () => {
    expect(howOftenSummary({ maxImpressions: 3, cooldownDays: 7 }, 0, true).text).toBe(
      'Shows at most 3 times and at most once every 7 days, and stops once they close it or they sign up',
    );
  });

  it('reads a count with the switches off', () => {
    expect(howOftenSummary({ maxImpressions: 3, stopAfterDismiss: false, stopAfterConversion: false }, 0, true).text)
      .toBe('Shows at most 3 times');
  });

  /**
   * **Every one of the sixteen combinations reads as a sentence.** Four
   * independent fields is where a summary built by string concatenation
   * produces "Shows  and ." on the combination nobody tried.
   */
  it('reads as a sentence for all sixteen combinations of the four fields', () => {
    for (const max of [undefined, 3]) {
      for (const days of [undefined, 7]) {
        for (const dismiss of [undefined, false]) {
          for (const convert of [undefined, false]) {
            const text = howOftenSummary(
              { maxImpressions: max, cooldownDays: days, stopAfterDismiss: dismiss, stopAfterConversion: convert },
              0,
              true,
            ).text;

            expect(text, JSON.stringify({ max, days, dismiss, convert })).toMatch(/^[A-Z]/);
            expect(text).not.toMatch(/\s{2}|,\s*$|\s,|\band\s*$/);
          }
        }
      }
    }
  });

  /**
   * **Priority is named only where it decides something.** `arbitrate()` sorts
   * overlays and leaves an `inline` Optin alone, so on an inline design the
   * number is real, stored and inert.
   */
  it('names the priority on an overlay and never on an inline Optin', () => {
    expect(howOftenSummary({}, 10, true).text).toMatch(/priority 10$/);
    expect(howOftenSummary({}, 10, false).text).not.toMatch(/priority/);
    expect(howOftenSummary({}, 0, true).text).not.toMatch(/priority/);
  });
});

describe('the vocabulary these summaries are read against', () => {
  it('is the one that ships, so a phrase cannot be asserted for a rule the product lacks', () => {
    expect(ruleTypes().triggers.map((type) => type.type)).toContain('exit_intent');
    expect(types.every((type) => typeof type.phrase === 'string')).toBe(true);
  });
});

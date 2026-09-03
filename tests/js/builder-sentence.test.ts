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
   * ==========================================================================
   * `logged_in` IS ON THIS AXIS AND IS NOT IN THIS SENTENCE.
   * ==========================================================================
   * It is stored here because the browser cannot read WordPress's HttpOnly auth
   * cookie, and it is a FIELD beside the two lists rather than a page rule —
   * they are a union of page SETS, and a visitor predicate in one would widen
   * the Optin to the whole site for anyone matching it (ADR 0005).
   *
   * It used to trail this sentence as *", signed-in visitors only"*, which
   * split the answer to *who sees this* across two summaries. It reads out
   * under WHO now, where its control is.
   */
  it('says nothing about the visitor, whichever way it is set', () => {
    expect(whereSummary({ logged_in: true }).text).toBe('On every page');
    expect(whereSummary({ logged_in: false }).text).toBe('On every page');
    expect(whereSummary({}).text).not.toMatch(/signed/);
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
    expect(summary.attention).toBe(true);
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
    expect(whenSummary(entries({ type: 'time_on_page', seconds: 20 }), types).text).toBe(
      'Fires time_on_page 20',
    );
    expect(
      whenSummary(entries({ type: 'time_on_page', seconds: 20 }, { type: 'scroll_up' }), types).text,
    ).toBe('Fires time_on_page 20 or scroll_up');
  });

  it('reads three or more as a list', () => {
    expect(
      whenSummary(
        entries({ type: 'scroll_up' }, { type: 'time_on_page', seconds: 20 }, { type: 'scroll_depth', percent: 33 }),
        types,
      ).text,
    ).toBe('Fires scroll_up, time_on_page 20 or scroll_depth 33');
  });

  // ==========================================================================
  // "SHOWS IMMEDIATELY" SUBSUMES EVERY OTHER TRIGGER, AND THE SENTENCE SAYS SO.
  // ==========================================================================
  // `page_load`'s module is `holds: () => true`. Triggers are ORed, so an Optin
  // carrying it fires the instant its Conditions hold and no other Trigger can
  // ever be the reason it fired. The old summary read *"Fires as soon as the
  // page loads or after 5 seconds on the page"* — true, and useless: it reads
  // as though the five seconds decides something.

  it('reads an immediate Optin as immediate, with nothing after it', () => {
    const summary = whenSummary(entries({ type: 'page_load' }), types);

    expect(summary.text).toBe('Fires page_load');
    expect(summary.attention).toBe(false);
  });

  /**
   * And it counts the rules along for the ride rather than listing them as
   * though they mattered — flagged, because a merchant who set both is looking
   * at rules they believe are doing something.
   */
  it('says how many other triggers never run, and flags the section', () => {
    const one = whenSummary(entries({ type: 'page_load' }, { type: 'time_on_page', seconds: 20 }), types);

    expect(one.text).toBe('Fires page_load — 1 other trigger never runs');
    expect(one.attention).toBe(true);

    const two = whenSummary(
      entries({ type: 'time_on_page', seconds: 20 }, { type: 'page_load' }, { type: 'scroll_up' }),
      types,
    );

    expect(two.text).toBe('Fires page_load — 2 other triggers never run');
  });

  /** Wherever it sits in the merchant's own order. */
  it('finds it whether it was written first or last', () => {
    expect(whenSummary(entries({ type: 'scroll_up' }, { type: 'page_load' }), types).text).toMatch(
      /^Fires page_load/,
    );
  });

  // ==========================================================================
  // AND THE SAME RULE WITHIN ONE TYPE, WHICH IS THE OTHER HALF OF IT.
  // ==========================================================================
  // Triggers are ORed, so the earliest one fires and the rest are along for the
  // ride. ACROSS types that is unknowable — whether `scroll_depth 50` beats
  // `time_on_page 8` is a fact about one visitor — so two types are a real
  // choice. Within one type it is decidable, and the screen has to say so.

  /**
   * A threshold is crossed once, lowest first. *"After 8 seconds or after 20
   * seconds"* is *"after 8 seconds"*: by the time the 20 is true the 8 already
   * was.
   */
  it('reads two thresholds of one type as the lower one', () => {
    const summary = whenSummary(
      entries({ type: 'time_on_page', seconds: 8 }, { type: 'time_on_page', seconds: 20 }),
      types,
    );

    expect(summary.text).toBe('Fires time_on_page 8 — 1 other trigger never runs');
    expect(summary.attention).toBe(true);
  });

  /** Whichever order they were written in. */
  it('finds the lowest threshold wherever it sits', () => {
    expect(
      whenSummary(
        entries({ type: 'time_on_page', seconds: 20 }, { type: 'time_on_page', seconds: 8 }),
        types,
      ).text,
    ).toBe('Fires time_on_page 8 — 1 other trigger never runs');
  });

  it('does the same for a scroll threshold', () => {
    expect(
      whenSummary(
        entries({ type: 'scroll_depth', percent: 80 }, { type: 'scroll_depth', percent: 33 }),
        types,
      ).text,
    ).toBe('Fires scroll_depth 33 — 1 other trigger never runs');
  });

  /**
   * **Two different types are a real choice and are left alone**, because
   * which of them fires first is a fact about the visitor rather than about
   * the rules.
   */
  it('leaves two different types alone, because their order is the visitor’s', () => {
    const summary = whenSummary(
      entries({ type: 'time_on_page', seconds: 20 }, { type: 'scroll_depth', percent: 33 }),
      types,
    );

    expect(summary.text).toBe('Fires time_on_page 20 or scroll_depth 33');
    expect(summary.attention).toBe(false);
  });

  /** A type with no params has one spelling, so a second is the same rule. */
  it('reads two of a parameterless trigger as one', () => {
    expect(whenSummary(entries({ type: 'scroll_up' }, { type: 'scroll_up' }), types).text).toBe(
      'Fires scroll_up — 1 other trigger never runs',
    );
  });

  /**
   * **Two `click_element`s on different selectors are genuinely two
   * triggers.** There is no threshold to compare and they are not duplicates,
   * so nothing here may call either of them idle.
   */
  it('leaves two selectors alone, and folds two identical ones together', () => {
    expect(
      whenSummary(
        entries({ type: 'click_element', selector: '.a' }, { type: 'click_element', selector: '.b' }),
        types,
      ).attention,
    ).toBe(false);

    expect(
      whenSummary(
        entries({ type: 'click_element', selector: '.a' }, { type: 'click_element', selector: '.a' }),
        types,
      ).text,
    ).toBe('Fires click_element .a — 1 other trigger never runs');
  });

  /**
   * A threshold with no value yet can never be the survivor — it cannot fire
   * at all, and `phraseOf` reports that on its own row.
   */
  it('does not let an unfilled threshold win the comparison', () => {
    const summary = whenSummary(
      entries({ type: 'time_on_page' }, { type: 'time_on_page', seconds: 20 }),
      types,
    );

    expect(summary.text).toBe('Fires time_on_page 20 — 1 other trigger never runs');
  });

  /** Three of a kind leave one, and the count says how many did not survive. */
  it('counts every trigger that never runs', () => {
    expect(
      whenSummary(
        entries(
          { type: 'time_on_page', seconds: 30 },
          { type: 'time_on_page', seconds: 8 },
          { type: 'time_on_page', seconds: 20 },
        ),
        types,
      ).text,
    ).toBe('Fires time_on_page 8 — 2 other triggers never run');
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

  /**
   * **The visitor predicate reads out here**, folded into the same join rather
   * than trailing a second sentence — a merchant asking *who sees this* gets
   * one answer. It is still STORED on the targeting axis, which is the one
   * place storage and control answer to different questions ({@see Who}).
   */
  it('folds the visitor predicate into the same clause', () => {
    expect(whoSummary([], types, true).text).toBe('Only when signed in');
    expect(whoSummary([], types, false).text).toBe('Only when signed out');
    expect(whoSummary(entries({ type: 'cart_has_items' }), types, true).text).toBe(
      'Only when cart_has_items and signed in',
    );
  });

  /** Undefined is "do not ask", which is not the same as false. */
  it('says anyone where it is not asked', () => {
    expect(whoSummary([], types, undefined).text).toBe('Anyone who reaches it');
  });
});

describe('who sees it, when a kind is set twice', () => {
  /**
   * **Conditions are ANDed, so a second of a kind NARROWS the first.** *"On
   * mobile or tablet"* AND *"on desktop"* holds for nobody, and every rule in
   * it is individually fine — which is exactly why the section has to say so.
   * One rule carrying several values is what the merchant meant (ADR 0005).
   */
  it('flags the section, even though each rule on its own is fine', () => {
    const summary = whoSummary(
      entries({ type: 'device', in: ['mobile'] }, { type: 'device', in: ['desktop'] }),
      types,
    );

    expect(summary.attention).toBe(true);
  });

  /** Two of a kind that says WHICH thing are two real conditions. */
  it('says nothing of the sort about two different parameters', () => {
    expect(
      whoSummary(
        entries(
          { type: 'query_param', key: 'utm_source', value: ['a'] },
          { type: 'query_param', key: 'utm_medium', value: ['b'] },
        ),
        types,
      ).attention,
    ).toBe(false);
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

    expect(missing.attention).toBe(true);
    expect(missing.text).toBe('click_element — needs selector');
    expect(phraseOf({ type: 'click_element', selector: '' }, types).attention).toBe(true);
    expect(phraseOf({ type: 'device', in: [] }, types).attention).toBe(true);
  });

  it('treats zero and false as values somebody meant', () => {
    expect(phraseOf({ type: 'scroll_depth', percent: 0 }, types).attention).toBe(false);
    expect(phraseOf({ type: 'logged_in', value: false }, types).attention).toBe(false);
  });

  /** It names every missing setting, not just the first. */
  it('names both settings when a general form is missing two', () => {
    expect(phraseOf({ type: 'query_param' }, types).text).toBe('query_param — needs key and value');
  });

  /** A type this build has never heard of reads as its raw key, like its row. */
  it('reads an unknown type as its key', () => {
    const unknown = phraseOf({ type: 'moon_phase' }, types);

    expect(unknown.text).toBe('moon_phase');
    expect(unknown.attention).toBe(true);
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
    expect(howOftenSummary({}, {}, 0, true).text).toBe('Every time, until they close it or sign up');
  });

  it('reads both switches off as genuinely every time', () => {
    expect(
      howOftenSummary({ stopAfterDismiss: false, stopAfterConversion: false }, {}, 0, true).text,
    ).toBe('Every time, with no limit');
  });

  it('reads the counts, singular and plural', () => {
    expect(howOftenSummary({ maxImpressions: 1 }, {}, 0, true).text).toMatch(/^Shows at most 1 time,/);
    expect(howOftenSummary({ maxImpressions: 3 }, {}, 0, true).text).toMatch(/^Shows at most 3 times,/);
    expect(howOftenSummary({ cooldownDays: 7 }, {}, 0, true).text).toMatch(/^Shows at most once every 7 days,/);
  });

  it('reads both counts and both switches together', () => {
    expect(howOftenSummary({ maxImpressions: 3, cooldownDays: 7 }, {}, 0, true).text).toBe(
      'Shows at most 3 times and at most once every 7 days, and stops once they close it or sign up',
    );
  });

  it('reads a count with the switches off', () => {
    expect(howOftenSummary({ maxImpressions: 3, stopAfterDismiss: false, stopAfterConversion: false }, {}, 0, true).text)
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
              {},
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
    expect(howOftenSummary({}, {}, 10, true).text).toMatch(/priority 10$/);
    expect(howOftenSummary({}, {}, 10, false).text).not.toMatch(/priority/);
    expect(howOftenSummary({}, {}, 0, true).text).not.toMatch(/priority/);
  });
});

describe('the vocabulary these summaries are read against', () => {
  it('is the one that ships, so a phrase cannot be asserted for a rule the product lacks', () => {
    expect(ruleTypes().triggers.map((type) => type.type)).toContain('exit_intent');
    expect(types.every((type) => typeof type.phrase === 'string')).toBe(true);
  });
});

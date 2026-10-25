import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  datesSummary,
  phraseOf,
  whereSummary,
} from '../../resources/admin/src/builder/rules/sentence';
import { allRuleTypes, ruleTypes } from './support/rule-types';

afterEach(() => vi.unstubAllGlobals());

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
    expect(whereSummary({ include: [{ type: 'url', value: '/a' }] }).text).toBe('Matches 1 page rule');
    expect(whereSummary({ exclude: [{ type: 'url', value: '/a' }] }).text).toBe('Everywhere except 1 page rule');
    expect(
      whereSummary({
        include: [
          { type: 'url', value: '/a' },
          { type: 'url', value: '/b' },
        ],
        exclude: [{ type: 'url', value: '/c' }],
      }).text,
    ).toBe('Matches 2 page rules, except 1 page rule');
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

  /** "Phone" heads a checkbox; inside a sentence it is "a phone" (ADR 0139). */
  it('reads an option by its phrase where it has one', () => {
    const phrased = types.map(type => type.type !== 'device' ? type : {
      ...type,
      params: { in: { ...type.params.in, options: [
        { value: 'mobile', label: 'Phone', phrase: 'a phone' },
        { value: 'desktop', label: 'Computer', phrase: 'a computer' },
      ] } },
    });

    expect(phraseOf({ type: 'device', in: ['mobile', 'desktop'] }, phrased).text).toBe('device a phone or a computer');
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
    expect(phraseOf({ type: 'logged_in', value: false }, types)).toEqual({ text: 'signed out of this site', attention: false });
  });

  /** It names every missing setting, not just the first. */
  it('requires the query key while an empty value means any value', () => {
    expect(phraseOf({ type: 'query_param' }, types).text).toBe('query_param — needs key');
    for (const value of [undefined, []]) {
      expect(phraseOf({ type: 'query_param', key: 'utm_campaign', value }, types)).toEqual({
        text: 'URL contains the “utm_campaign” parameter (any value)', attention: false,
      });
    }
  });

  /**
   * ==========================================================================
   * A DAILY WINDOW IS ONE PARAM, AND THIS IS THE SENTENCE THAT DECIDED IT.
   * ==========================================================================
   * Declared as a `from` and a `to`, a merchant who had filled one would read
   * *"time_of_day — needs to"* on the collapsed row, and the rule would be
   * SAVEABLE in that state — a window with one end that holds for nobody. One
   * param has no such half: the control writes a whole window or nothing, so
   * the row either reads out the hours or says it needs them.
   */
  it('says a daily window needs its hours until both ends are chosen', () => {
    const missing = phraseOf({ type: 'time_of_day' }, types);

    expect(missing.attention).toBe(true);
    expect(missing.text).toBe('time_of_day — needs between');
    expect(phraseOf({ type: 'time_of_day', between: '' }, types).attention).toBe(true);
  });

  /**
   * Hours the presets do not fix, so this reads the general form. What a
   * merchant sees is the window they set — which is why neither preset carries
   * a phrase of its own in PHP: a label reading *"During office hours"* is a
   * starting point, not a claim about this merchant's hours, and a sentence
   * repeating the label would hide the window behind it
   * (`RuleLabelParityTest`).
   *
   * **Spelled in the reader's own clock**, because the control that writes it
   * already is: an `<input type="time">` renders in the reader's locale, so a
   * 12-hour merchant types into a box saying "4:00 PM" and must not then read
   * `16:00` in the sentence above it. Asserted as both ends rather than as an
   * exact string, so this does not fail on an ICU update that moves a space.
   */
  it('reads a whole window as one value, in the reader’s own clock', () => {
    const whole = phraseOf({ type: 'time_of_day', between: '10:00-16:00' }, types);

    expect(whole.attention).toBe(false);
    expect(whole.text).toMatch(/^time_of_day 10:00/);
    expect(whole.text).toContain('4:00');
    expect(whole.text).not.toContain('16:00');
  });

  /** A window it cannot read prints what is stored rather than nothing. */
  it('falls back to the stored value where the window is not a whole one', () => {
    expect(phraseOf({ type: 'time_of_day', between: '09:00-' }, types).text).toBe('time_of_day 09:00-');
  });

  /** A type this build has never heard of reads as its raw key, like its row. */
  it('reads an unknown type as its key', () => {
    const unknown = phraseOf({ type: 'moon_phase' }, types);

    expect(unknown.text).toBe('moon_phase');
    expect(unknown.attention).toBe(true);
  });
});

describe('how often', () => {
  it('waits for a known site timezone before calling a window finished', () => {
    expect(datesSummary({ ends_at: '2020-08-03 12:00' }).text).not.toContain('Stopped');
    vi.stubGlobal('wconvertAdmin', { timezone: 'Pacific/Honolulu', exportUrl: '' });
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-10T18:00:00Z'));
    expect(datesSummary({ ends_at: '2026-09-10 09:00' }).attention).toBe(false);
    vi.restoreAllMocks();
  });

  /**
   * ==========================================================================
   * A WINDOW THAT HAS CLOSED SAYS SO, BECAUSE NOTHING ELSE DOES.
   * ==========================================================================
   * An Optin past its `ends_at` stays **Published**, shows nothing and records
   * no Impression (ADR 0050) — correctly, and silently. The Optin list gives it
   * no badge and this sentence read *"Runs 27 Nov to 30 Nov"* about a sale that
   * finished last week.
   *
   * `attention` is not a defect being flagged: a campaign ending is what a
   * campaign does. It is ADR 0042 rule 2 — extending it or unpublishing it is
   * the next thing the merchant does, and they cannot decide either without
   * knowing. Under the rules panel's own rule it also opens the section.
   */
  it('reads a finished window in the past tense, and asks to be looked at', () => {
    vi.stubGlobal('wconvertAdmin', { timezone: 'UTC', exportUrl: '' });
    const done = datesSummary({ starts_at: '2020-07-01 09:00', ends_at: '2020-08-03 12:00' });

    expect(done.text).toMatch(/^Stopped running on .*2020/);
    expect(done.attention).toBe(true);
  });

  /** And a window still ahead of the clock reads as the plan it is. */
  it('says nothing of the sort about a window that has not closed', () => {
    const running = datesSummary({ starts_at: '2099-11-27 09:00', ends_at: '2099-11-30 23:59' });

    expect(running.text).toMatch(/^Runs .*2099.* to .*2099/);
    expect(running.attention).toBe(false);
  });

  /** A schedule with only a start has no window to have closed. */
  it('reads no dates as running until it is paused', () => {
    expect(datesSummary({})).toEqual({ text: 'Runs until you unpublish it', attention: false });
  });

  it('is silent where there is no end date at all', () => {
    expect(datesSummary({ starts_at: '2020-07-01 09:00' }).attention).toBe(false);
  });

});

describe('the vocabulary these summaries are read against', () => {
  it('is the one that ships, so a phrase cannot be asserted for a rule the product lacks', () => {
    expect(ruleTypes().triggers.map((type) => type.type)).toContain('exit_intent');
    expect(types.every((type) => typeof type.phrase === 'string')).toBe(true);
  });
});

/** The menu's summary of a group joins like the sentence: "and", not "AND" (ADR 0139). */
describe('a group’s summary', () => {
  it('joins its rules with a lowercase word', async () => {
    const { groupSummary } = await import('../../resources/admin/src/builder/rules/plan');
    const types = allRuleTypes();
    const rules = [{ type: 'device', in: ['mobile'] }, { type: 'logged_in', value: true }];

    expect(groupSummary({ match: 'all', rules }, types).text).toContain(' and ');
    expect(groupSummary({ match: 'any', rules }, types).text).toContain(' or ');
    expect(groupSummary({ match: 'all', rules }, types).text).not.toMatch(/ AND | OR /);
  });
});

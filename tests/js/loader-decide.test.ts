import { describe, expect, it } from 'vitest';
import { decide } from '@loader/decide';
import type { PayloadEntry, Rule, RuleEvaluator, VisitorState } from '@loader/types';

/**
 * The trigger/condition evaluator, and specifically its INSTANT semantics.
 *
 * "All Conditions must hold at the instant a Trigger fires. They are not
 * evaluated ahead of time and held: an Optin whose cart emptied while its ten
 * second timer ran does not show." (CONTEXT.md, Condition.)
 *
 * That is the case an implementation gets wrong by caching eligibility, and it
 * is the distinction that lets an engine holding several eligible Optins tell
 * "waiting" from "ineligible" (ADR 0005).
 */

/** An evaluator whose answer the test moves under the engine's feet. */
function evaluatorFor(answer: () => boolean): RuleEvaluator {
  return { holds: () => answer() };
}

function evaluators(map: Record<string, () => boolean>): ReadonlyMap<string, RuleEvaluator> {
  return new Map(Object.entries(map).map(([type, answer]) => [type, evaluatorFor(answer)]));
}

const rule = (type: string): Rule => ({ type });

function entry(overrides: Partial<PayloadEntry> = {}): PayloadEntry {
  return {
    id: '01JQ0000000000000000000001',
    display_type: 'popup',
    triggers: [rule('time_on_page')],
    conditions: [rule('device')],
    ...overrides,
  };
}

function input(overrides: Partial<Parameters<typeof decide>[0]> = {}) {
  return {
    entries: [entry()],
    evaluators: evaluators({ time_on_page: () => true, device: () => true }),
    withheld: new Set<string>(),
    state: {} as VisitorState,
    day: 20_000,
    shown: new Set<string>(),
    overlayDone: false,
    ...overrides,
  };
}

const standings = (verdict: ReturnType<typeof decide>) =>
  Object.fromEntries(verdict.candidates.map((c) => [c.id, c.standing]));

describe('decide', () => {
  it('fires an Optin when a trigger fires and every condition holds', () => {
    const verdict = decide(input());

    expect(verdict.show.map((e) => e.id)).toEqual(['01JQ0000000000000000000001']);
    expect(standings(verdict)).toEqual({ '01JQ0000000000000000000001': 'ready' });
  });

  /**
   * THE CASE. The condition held when the timer started and had lapsed by the
   * time it finished. Nothing may have cached the earlier answer.
   */
  it('does not show an Optin whose condition lapsed while its trigger was waiting', () => {
    let onMobile = true;
    let secondsElapsed = 0;

    const live = input({
      evaluators: evaluators({
        time_on_page: () => secondsElapsed >= 10,
        device: () => onMobile,
      }),
    });

    // t=0: the visitor is eligible, and the Optin is waiting for its moment.
    expect(standings(decide(live))).toEqual({ '01JQ0000000000000000000001': 'waiting' });

    // The visitor rotates their tablet at t=5. The condition has lapsed, and
    // the Optin is now ineligible rather than waiting.
    secondsElapsed = 5;
    onMobile = false;
    expect(standings(decide(live))).toEqual({ '01JQ0000000000000000000001': 'ineligible' });

    // t=10: the trigger fires. The condition is re-checked at THIS instant, so
    // nothing shows.
    secondsElapsed = 10;
    const verdict = decide(live);

    expect(verdict.show).toEqual([]);
    expect(standings(verdict)).toEqual({ '01JQ0000000000000000000001': 'ineligible' });
  });

  /**
   * The mirror: a condition that comes to hold later still fires, which is what
   * says the engine re-asks rather than remembering a "no".
   */
  it('shows an Optin whose condition comes to hold after the trigger already could fire', () => {
    let onMobile = false;
    const live = input({ evaluators: evaluators({ time_on_page: () => true, device: () => onMobile }) });

    expect(decide(live).show).toEqual([]);

    onMobile = true;

    expect(decide(live).show.map((e) => e.id)).toEqual(['01JQ0000000000000000000001']);
  });

  it('fires on ANY one trigger', () => {
    const verdict = decide(
      input({
        entries: [entry({ triggers: [rule('scroll_depth'), rule('time_on_page')], conditions: [] })],
        evaluators: evaluators({ scroll_depth: () => false, time_on_page: () => true }),
      }),
    );

    expect(verdict.show).toHaveLength(1);
  });

  it('requires ALL conditions', () => {
    const verdict = decide(
      input({
        entries: [entry({ conditions: [rule('device'), rule('query_param')] })],
        evaluators: evaluators({ time_on_page: () => true, device: () => true, query_param: () => false }),
      }),
    );

    expect(standings(verdict)).toEqual({ '01JQ0000000000000000000001': 'ineligible' });
  });

  /**
   * Every Optin has at least one Trigger; "shows immediately" is the explicit
   * `page_load` Trigger, never an empty list (CONTEXT.md). So an empty list is
   * an Optin that can never fire — the silent, total loss of function ADR 0012
   * substitutes premium triggers to prevent. Reading it as "fires" would hide
   * exactly the bug that substitution exists for.
   */
  it('never fires an Optin with no triggers at all', () => {
    const verdict = decide(input({ entries: [entry({ triggers: [] })] }));

    expect(verdict.show).toEqual([]);
    expect(standings(verdict)).toEqual({ '01JQ0000000000000000000001': 'waiting' });
  });

  /**
   * A rule type this build has no module for fails shut. On a correctly
   * degraded install it cannot arrive — PHP strips what the install is not
   * entitled to — so one that does is a bug, and firing on it would be worse
   * than not.
   */
  it('never holds a rule it has no module for', () => {
    const verdict = decide(
      input({
        entries: [entry({ triggers: [rule('exit_intent')], conditions: [] })],
        evaluators: evaluators({}),
      }),
    );

    expect(verdict.show).toEqual([]);
  });

  describe('the contest between overlays', () => {
    const overlays = (ids: readonly [string, number][]) =>
      ids.map(([id, priority]) => entry({ id, priority, conditions: [] }));

    it('shows at most one overlay per page view, highest priority first', () => {
      const verdict = decide(input({ entries: overlays([['b', 1], ['a', 9]]) }));

      expect(verdict.show.map((e) => e.id)).toEqual(['a']);
    });

    it('breaks a priority tie on id, so the winner is not a property of array order', () => {
      const verdict = decide(input({ entries: overlays([['b', 5], ['a', 5]]) }));

      expect(verdict.show.map((e) => e.id)).toEqual(['a']);
    });

    /**
     * "No runner-up after a dismissal" — a popup that summons another popup
     * when you close it is the most hated pattern in this category, and it is
     * structurally impossible rather than a setting someone can misconfigure.
     * `overlayDone` is set the moment an overlay is SHOWN, so a dismissal
     * cannot un-set it.
     */
    it('shows no runner-up once an overlay has had the page', () => {
      const verdict = decide(input({ entries: overlays([['b', 1], ['a', 9]]), overlayDone: true }));

      expect(verdict.show).toEqual([]);
      expect(verdict.candidates.map((c) => c.standing)).toEqual(['ready', 'ready']);
      // And the page is DONE. An overlay behind a dismissal is ready forever
      // and will never be shown again, so holding the listeners open for it
      // leaks a timer on every page view for the rest of the visit.
      expect(verdict.live).toBe(false);
    });

    /**
     * `inline` is not an overlay: it renders where it was embedded and never
     * competes (CONTEXT.md, Display Type). Suppressing it because an unrelated
     * popup won a priority contest is the bug the prototype's "one, globally"
     * had.
     */
    it('never lets an overlay suppress an inline Optin, or the reverse', () => {
      const verdict = decide(
        input({
          entries: [
            entry({ id: 'a', display_type: 'popup', priority: 9, conditions: [] }),
            entry({ id: 'b', display_type: 'inline', conditions: [] }),
            entry({ id: 'c', display_type: 'inline', conditions: [] }),
          ],
        }),
      );

      expect(verdict.show.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    });

    it('still shows an inline Optin after an overlay has had the page', () => {
      const verdict = decide(
        input({
          entries: [entry({ id: 'b', display_type: 'inline', conditions: [] })],
          overlayDone: true,
        }),
      );

      expect(verdict.show.map((e) => e.id)).toEqual(['b']);
    });

    /**
     * An entry whose display type this build does not recognise competes as an
     * overlay. That is the safe direction: the worst it does is show one fewer
     * thing, where treating it as inline could put two overlays on the screen.
     */
    it('treats an unrecognised display type as an overlay', () => {
      const verdict = decide(
        input({ entries: [entry({ id: 'a', display_type: 'hologram', conditions: [] })], overlayDone: true }),
      );

      expect(verdict.show).toEqual([]);
    });
  });

  it('does not show an Optin twice in one page view', () => {
    const verdict = decide(
      input({
        entries: [entry({ id: 'b', display_type: 'inline', conditions: [] })],
        shown: new Set(['b']),
      }),
    );

    expect(verdict.show).toEqual([]);
    expect(standings(verdict)).toEqual({ b: 'shown' });
  });

  describe('what keeps the page live', () => {
    it('stays live while anything could still become ready', () => {
      const verdict = decide(input({ evaluators: evaluators({ time_on_page: () => false, device: () => true }) }));

      expect(verdict.live).toBe(true);
    });

    /**
     * A capped Optin is the one settled "no" — its answer cannot change on this
     * page view — so an engine holding nothing else may tear its listeners down.
     */
    it('is not live when every candidate is settled', () => {
      const verdict = decide(
        input({
          entries: [entry({ id: 'a', frequency: { stopAfterDismiss: true } })],
          state: { a: { d: 1 } },
        }),
      );

      expect(standings(verdict)).toEqual({ a: 'capped' });
      expect(verdict.live).toBe(false);
    });
  });

  /**
   * "An Optin whose rules need bucket two is NOT evaluated rather than
   * evaluated-as-false — so it can still fire later in the same page view when
   * consent arrives" (issue #11).
   */
  it('holds an Optin whose rule needs consent that has been withheld, rather than failing it', () => {
    const verdict = decide(
      input({
        entries: [entry({ conditions: [rule('total_pageviews')] })],
        evaluators: evaluators({ time_on_page: () => true }),
        withheld: new Set(['total_pageviews']),
      }),
    );

    expect(verdict.show).toEqual([]);
    expect(standings(verdict)).toEqual({ '01JQ0000000000000000000001': 'blocked' });
    expect(verdict.live).toBe(true);
  });
});

/**
 * Nothing one rule does may take the page down with it.
 *
 * `decide` runs inside scroll handlers, timers and the boot path, where a throw
 * is uncatchable from anywhere useful — so an evaluator reaching for something
 * this browser does not have would kill every Optin on the site, silently, with
 * one line in a console nobody reads. That is ADR 0004's failure mode, arrived
 * at from a different direction.
 */
describe('a rule that cannot answer', () => {
  const exploding: RuleEvaluator = {
    holds: () => {
      throw new TypeError('window.matchMedia is not a function');
    },
  };

  it('does not hold, and does not stop the rest of the page deciding', () => {
    const verdict = decide(
      input({
        entries: [
          entry({ id: 'a', conditions: [rule('device')] }),
          entry({ id: 'b', display_type: 'inline', conditions: [] }),
        ],
        evaluators: new Map([
          ['time_on_page', { holds: () => true }],
          ['device', exploding],
        ]),
      }),
    );

    expect(verdict.show.map((e) => e.id)).toEqual(['b']);
    expect(standings(verdict)).toEqual({ a: 'ineligible', b: 'ready' });
  });
});

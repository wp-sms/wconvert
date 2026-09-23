import { displayEntry } from './support/display-entry';
import { describe, expect, it, vi } from 'vitest';
import { explain } from '@loader/inspect/explain';
import type { PayloadEntry, Rule, RuleEvaluator, VisitorState } from '@loader/types';

/**
 * The eligibility inspector's engine half.
 *
 * ============================================================================
 * WHAT IS UNDER TEST IS THAT IT DOES NOT HAVE ITS OWN OPINION.
 * ============================================================================
 * `explain()` wraps each evaluator to record its answer and then calls the
 * REAL `decide()`. There is one spelling of the decision, so drift between the
 * screen and the site is structurally impossible rather than test-enforced —
 * and what is left worth asserting is that the recording is faithful,
 * especially in the three places where "not evaluated" and "false" are
 * different facts.
 */

const rule = (type: string): Rule => ({ type });

function evaluators(map: Record<string, () => boolean>): ReadonlyMap<string, RuleEvaluator> {
  return new Map(Object.entries(map).map(([type, answer]) => [type, { holds: () => answer() }]));
}

function entry(overrides: Partial<PayloadEntry> = {}): PayloadEntry {
  return displayEntry({
    id: 'A',
    display_type: 'popup',
    triggers: [rule('time_on_page')],
    conditions: [rule('device')],
    ...overrides,
  });
}

function input(overrides: Partial<Parameters<typeof explain>[0]> = {}) {
  return {
    entries: [entry()],
    evaluators: evaluators({ time_on_page: () => true, device: () => true }),
    withheld: new Set<string>(),
    state: {} as VisitorState,
    day: 20_000,
    now: Date.UTC(2026, 10, 27, 12, 0, 0),
    shown: new Set<string>(),
    overlayDone: false,
    ...overrides,
  };
}

const only = (report: ReturnType<typeof explain>) => report.entries[0];

describe('the verdict it reports', () => {
  /**
   * The whole design rests on this: the verdict comes back from the same
   * `decide()` the page ran, so the panel can never confidently explain a
   * decision that was not taken.
   */
  it('is the one decide took, standings and all', () => {
    const report = explain(input());

    expect(report.verdict.show.map((each) => each.id)).toEqual(['A']);
    expect(only(report).standing).toBe('ready');
  });

  it('records every rule that was evaluated, with the answer it gave', () => {
    const report = explain(
      input({ evaluators: evaluators({ time_on_page: () => false, device: () => true }) }),
    );

    expect(only(report).standing).toBe('waiting');
    expect(only(report).triggers[0].answer).toBe(false);
    expect(only(report).conditions[0].answer).toBe(true);
  });
});

describe('“not evaluated” is not “failed”', () => {
  /**
   * ==========================================================================
   * A CONSENT PLUGIN WITHHOLDING A CATEGORY MUST NOT PRODUCE A RED CROSS.
   * ==========================================================================
   * `blocked` means the rule was not evaluated. A cross beside it teaches the
   * merchant to go and fix a rule that is perfectly fine — and the rule may
   * well hold the moment consent arrives, in the same page view (issue #11).
   */
  it('reports null only for the withheld leaf and still explains independent leaves', () => {
    const report = explain(input({ withheld: new Set(['device']) }));

    expect(only(report).standing).toBe('blocked');
    expect(only(report).triggers[0].answer).toBe(true);
    expect(only(report).conditions[0].answer).toBeNull();
  });

  /** And it does not even ASK, which is the half a merchant cannot see. */
  it('does not evaluate a withheld rule at all', () => {
    const device = vi.fn(() => true);

    explain(input({ evaluators: new Map([['device', { holds: device }]]), withheld: new Set(['device']) }));

    expect(device).not.toHaveBeenCalled();
  });

  /**
   * A rule type with no module in this build is a different fact again: it is
   * why the Optin is `inert`, and it is fixed by having the module rather than
   * by changing the rule.
   */
  it('says a rule type has no module rather than answering for it', () => {
    const report = explain(input({ entries: [entry({ triggers: [rule('exit_intent')] })] }));

    expect(only(report).standing).toBe('inert');
    expect(only(report).triggers[0].unsupported).toBe(true);
    expect(only(report).triggers[0].answer).toBeNull();
    expect(only(report).conditions[0].unsupported).toBe(false);
  });
});

describe('the rules decide never reached', () => {
  /**
   * `conditions.every()` short-circuits, which IS the answer to which
   * condition failed. The rest are filled in afterwards, where they cannot
   * change a verdict already taken — a merchant looking at an ineligible Optin
   * wants the whole table, not the prefix of it the engine happened to need.
   */
  it('fills in the conditions after the first failure, without changing the verdict', () => {
    const report = explain(
      input({
        entries: [entry({ conditions: [rule('device'), rule('query_param')] })],
        evaluators: evaluators({
          time_on_page: () => true,
          device: () => false,
          query_param: () => true,
        }),
      }),
    );

    expect(only(report).standing).toBe('ineligible');
    expect(only(report).conditions.map((each) => each.answer)).toEqual([false, true]);
  });

  /** Including on an Optin whose allowance is spent before any rule was asked. */
  it('still reports the rules of a capped Optin', () => {
    const report = explain(
      input({
        entries: [entry({ frequency: { maxImpressions: 1 } })],
        state: { A: { i: 1 } } as unknown as VisitorState,
      }),
    );

    expect(only(report).standing).toBe('capped');
    expect(only(report).conditions[0].answer).toBe(true);
  });
});

describe('the gate with no word in the product', () => {
  /**
   * ==========================================================================
   * `arbitrate()` DROPS A READY OVERLAY SILENTLY, AND THIS IS THE ONLY PLACE
   * THAT SAYS SO.
   * ==========================================================================
   * "Ready but not shown" is exactly what a merchant is looking at when they
   * ask why their popup did not appear. It is DERIVED from `verdict.show`
   * against the standing rather than being an eighth `Standing`, because the
   * standing is a fact about one Optin and this is a fact about the page.
   */
  it('reports the ready overlay that lost the page view', () => {
    const report = explain(
      input({
        entries: [
          entry({ id: 'A', priority: 1 }),
          entry({ id: 'B', priority: 9 }),
        ],
      }),
    );

    expect(report.verdict.show.map((each) => each.id)).toEqual(['B']);

    const [a, b] = report.entries;

    expect(a.standing).toBe('ready');
    expect(a.lostArbitration).toBe(true);
    expect(b.lostArbitration).toBe(false);
  });

  /** An inline Optin never competes, so it never loses. */
  it('says nothing of the sort about an inline Optin', () => {
    const report = explain(
      input({ entries: [entry({ id: 'A', display_type: 'popup' }), entry({ id: 'B', display_type: 'inline' })] }),
    );

    expect(report.entries[1].overlay).toBe(false);
    expect(report.entries[1].lostArbitration).toBe(false);
  });
});

describe('a rule that throws', () => {
  /**
   * `decide` catches it and fails the rule shut (ADR 0004) — one rule reaching
   * for something this browser does not have must not take every Optin on the
   * page down with it. The report says the same thing, because that is what
   * happened.
   */
  it('is reported as the false the engine acted on', () => {
    const report = explain(
      input({
        evaluators: new Map([
          ['time_on_page', { holds: () => true }],
          ['device', { holds: () => { throw new Error('no matchMedia'); } }],
        ]),
      }),
    );

    expect(only(report).standing).toBe('ineligible');
    expect(only(report).conditions[0].answer).toBe(false);
  });
});

/**
 * ============================================================================
 * "SCHEDULED, STARTS IN THREE DAYS" — WHICH SIDE OF THE WINDOW, NOT A SEVENTH
 * `Standing`.
 * ============================================================================
 * `decide` answers `capped` for an Optin outside its window, exactly as it
 * does for one whose allowance is spent, and the vocabulary stays closed
 * (ADR 0047). The distinction the merchant needs is a fact about the ENTRY,
 * derived here the way `lostArbitration` is — from the same inputs the
 * decision was taken on, after it was taken, where it cannot change one.
 */
describe('which side of its window', () => {
  const NOW = Date.UTC(2026, 10, 27, 12, 0, 0);
  const day = 24 * 60 * 60 * 1000;

  const scheduleOf = (over: Partial<PayloadEntry>) =>
    explain(input({ entries: [entry(over)], now: NOW })).entries[0].schedule;

  it('says nothing about an Optin with no schedule', () => {
    expect(scheduleOf({})).toBeNull();
  });

  it('says nothing about an Optin inside its window', () => {
    expect(scheduleOf({ starts_at: NOW - day, ends_at: NOW + day })).toBeNull();
  });

  it('reports an Optin that has not started yet', () => {
    expect(scheduleOf({ starts_at: NOW + 3 * day })).toBe('before');
  });

  it('reports an Optin whose window has closed', () => {
    expect(scheduleOf({ ends_at: NOW - day })).toBe('after');
  });

  /**
   * Both boundaries in the past is AFTER, not before. The two are asked in
   * order and the closed end is the one the merchant needs told about.
   */
  it('reports a finished campaign as finished rather than as not started', () => {
    expect(scheduleOf({ starts_at: NOW - 3 * day, ends_at: NOW - day })).toBe('after');
  });
});


/**
 * The site-wide allowance, reported as **one fact about the page**.
 *
 * `decide` answers `capped` for a site-vetoed Optin exactly as it does for one
 * whose own allowance is spent, and deliberately (ADR 0047). The distinction
 * is derived here, from the same predicate the decision was taken with — not
 * re-implemented, and not per row: the site's allowance is spent or it is not,
 * and rows cannot disagree about it.
 */
describe('the allowance the whole site shares', () => {
  const spent = { siteFrequency: { stopAfterDismiss: true }, state: { site: { d: 1 } } as VisitorState };

  it('says nothing about a site that has configured no allowance', () => {
    expect(explain(input()).siteCapped).toBe(false);
  });

  it('says nothing while a configured allowance is unspent', () => {
    expect(explain(input({ siteFrequency: { maxImpressions: 3 } })).siteCapped).toBe(false);
  });

  it('reports a spent site allowance beside the standing it produced', () => {
    const report = explain(input(spent));

    expect(report.siteCapped).toBe(true);
    expect(only(report).standing).toBe('capped');
  });

  /** The site is a veto, so it is true whatever the Optin's own allowance says. */
  it('reports it for an Optin whose own allowance is spent too', () => {
    const report = explain(
      input({
        ...spent,
        entries: [entry({ frequency: { stopAfterDismiss: true } })],
        state: { site: { d: 1 }, A: { d: 1 } } as VisitorState,
      }),
    );

    expect(report.siteCapped).toBe(true);
  });

  /** A capped Optin still gets its rules read out, exactly as before. */
  it('still reports the rules of an Optin the site vetoed', () => {
    const report = explain(input(spent));

    expect(only(report).conditions[0].answer).toBe(true);
    expect(only(report).triggers[0].answer).toBe(true);
  });
});

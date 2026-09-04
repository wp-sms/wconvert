import { describe, expect, it } from 'vitest';
import { GATES, funnel, type ServerOptin, type ServerReport } from '@loader/inspect/report';
import type { Arrival } from '@loader/inspect/arrival';
import type { EntryReport } from '@loader/inspect/explain';

/**
 * The funnel: **the first gate that closes is the answer**, and the order is
 * the whole content of this file.
 *
 * An Optin that is both a draft and suspended is a DRAFT — telling its author
 * it is suspended sends them to reactivate a plugin when what they needed was
 * the Publish button. Every assertion here is one of those precedences.
 */
const ARRIVAL: Arrival = {
  payloadFound: true,
  entries: 1,
  loaderFound: true,
  loaderBeforePayload: false,
  deferred: true,
};

const optin = (over: Partial<ServerOptin> = {}): ServerOptin => ({
  id: 'A',
  name: 'Welcome discount',
  published: true,
  suspended: null,
  schedule: null,
  targeting: { admits: true, reason: null, logged_in: null, include: [], exclude: [] },
  ...over,
});

const server = (...optins: ServerOptin[]): ServerReport => ({ request: {}, optins, labels: {} });

const entry = (over: Partial<EntryReport> = {}): EntryReport => ({
  id: 'A',
  standing: 'ready',
  overlay: true,
  triggers: [],
  conditions: [],
  lostArbitration: false,
  schedule: null,
  ...over,
});

const first = (
  optins: ServerOptin[],
  entries: EntryReport[] = [entry()],
  reached = new Set(entries.map((each) => each.id)),
  siteCapped = false,
) => funnel(server(...optins), { entries, siteCapped }, reached, ARRIVAL).rows[0];

describe('the first gate that closes', () => {
  /**
   * ==========================================================================
   * A DRAFT IS THE COMMONEST ANSWER OF ALL, AND IT IS ASKED FIRST.
   * ==========================================================================
   * A merchant asking "why doesn't my popup show" has very often not published
   * it. `summaries()` returns drafts, so the funnel can answer it — a screen
   * built from the published set alone would be silent about the likeliest
   * cause.
   */
  it('says a draft is a draft, even when it would also be suspended', () => {
    expect(first([optin({ published: false, suspended: 'Suspended — needs Pro' })]).stopped).toBe('draft');
  });

  /** Suspension beats Targeting: a rule the site cannot evaluate stops it everywhere. */
  it('says suspended before it says anything about this page', () => {
    const row = first([
      optin({
        suspended: 'Suspended — the “Has something in their cart” rule needs WooCommerce',
        targeting: { admits: false, reason: 'not_included', logged_in: null, include: [], exclude: [] },
      }),
    ]);

    expect(row.stopped).toBe('suspended');
  });

  it('names the Targeting gate that closed', () => {
    for (const reason of ['excluded', 'not_included']) {
      const row = first([
        optin({ targeting: { admits: false, reason, logged_in: null, include: [], exclude: [] } }),
      ]);

      expect(row.stopped).toBe(reason);
    }
  });

  /**
   * ==========================================================================
   * THE ONE QUESTION THIS SCREEN CANNOT ANSWER, REPORTED RATHER THAN FAKED.
   * ==========================================================================
   * The merchant is signed in — that is what let them open the panel — so
   * "what does a signed-out visitor see" is unanswerable here. The two keys
   * say which direction it is, as a fact about THIS request.
   */
  it('reports the visitor predicate as a fact about this request, both ways', () => {
    const wants = (wanted: boolean) =>
      first([
        optin({
          targeting: {
            admits: false,
            reason: 'wrong_visitor',
            logged_in: { wanted, holds: false },
            include: [],
            exclude: [],
          },
        }),
      ]).stopped;

    expect(wants(false)).toBe('wants_signed_out');
    expect(wants(true)).toBe('wants_signed_in');
  });

  /**
   * Targeting admitted it and the payload does not carry it — something
   * between the two dropped it, and the honest report is that it did not
   * arrive rather than a guess about which cache did it.
   */
  it('says it never arrived when Targeting admitted it and the payload has not got it', () => {
    expect(first([optin()], [], new Set()).stopped).toBe('not_in_payload');
  });

  it('carries the engine’s own word for a browser-side stop', () => {
    for (const standing of ['capped', 'blocked', 'inert', 'ineligible', 'waiting', 'shown'] as const) {
      expect(first([optin()], [entry({ standing })]).stopped).toBe(standing);
    }
  });

  it('says nothing at all about one that is showing', () => {
    expect(first([optin()]).stopped).toBeNull();
  });
});

describe('the gate with no word in the product', () => {
  /**
   * `arbitrate()` silently drops a `ready` overlay when a higher-priority one
   * won, and there is no `Standing` that says so. The panel names the WINNER
   * rather than saying "priority": two overlays at equal priority are broken
   * by the ULID, which is creation order, and telling a merchant they lost on
   * priority when both were zero sends them to change a number that decides
   * nothing.
   */
  it('names the Optin that took the page view', () => {
    const rows = funnel(
      server(optin({ id: 'A', name: 'Runner up' }), optin({ id: 'B', name: 'Welcome' })),
      { entries: [entry({ id: 'A', lostArbitration: true }), entry({ id: 'B' })], siteCapped: false },
      new Set(['A', 'B']),
      ARRIVAL,
    ).rows;

    expect(rows[0].stopped).toBe('lost');
    expect(rows[0].subject).toBe('Welcome');
    expect(rows[1].stopped).toBeNull();
    expect(rows[1].subject).toBeNull();
  });
});

describe('how far it got', () => {
  /**
   * ==========================================================================
   * THE GATE AND THE REASON ARE DIFFERENT QUESTIONS.
   * ==========================================================================
   * They were one value, and it was a string that named a STAGE for some stops
   * (`draft`, `not_in_payload`) and a CAUSE for others (`excluded`, `capped`).
   * So there was nowhere to put "how far did it get", the funnel had no
   * renderer, and ten minted gate labels shipped with no reader at all.
   */
  it.each([
    ['published', () => first([optin({ published: false })], [], new Set())],
    ['suspended', () => first([optin({ suspended: 'Suspended — needs Pro' })], [], new Set())],
    [
      'targeting',
      () =>
        first([
          optin({ targeting: { admits: false, reason: 'excluded', logged_in: null, include: [], exclude: [] } }),
        ], [], new Set()),
    ],
    ['payload', () => first([optin()], [], new Set())],
    ['frequency', () => first([optin()], [entry({ standing: 'capped' })])],
    ['consent', () => first([optin()], [entry({ standing: 'blocked' })])],
    ['trigger', () => first([optin()], [entry({ standing: 'inert' })])],
    ['conditions', () => first([optin()], [entry({ standing: 'ineligible' })])],
    ['fired', () => first([optin()], [entry({ standing: 'waiting' })])],
    ['won', () => first([optin()], [entry({ lostArbitration: true })])],
  ])('reports %s as the gate that closed', (gate, build) => {
    expect(build().gate).toBe(gate);
  });

  /** Every gate opened, so there is no gate to name. */
  it('names no gate for one that is showing', () => {
    expect(first([optin()]).gate).toBeNull();
  });

  /**
   * The sequence is the order the gates are actually applied, and the panel
   * renders it in that order — so a gate map naming something outside it would
   * silently render nothing.
   */
  it('only ever names a gate the sequence contains', () => {
    const rows = funnel(
      server(optin({ published: false }), optin({ suspended: 'x' }), optin()),
      { entries: [entry({ id: 'A' })], siteCapped: false },
      new Set(['A']),
      ARRIVAL,
    ).rows;

    for (const row of rows) {
      if (row.gate !== null) {
        expect(GATES).toContain(row.gate);
      }
    }
  });
});

describe('an Optin stopped on the server', () => {
  /** It has no browser half, and the panel says so rather than drawing an empty table. */
  it('carries no browser report at all', () => {
    expect(first([optin({ published: false })], [], new Set()).browser).toBeNull();
  });

  it('keeps the browser report for one that reached the page', () => {
    expect(first([optin()]).browser).not.toBeNull();
  });
});

/**
 * ============================================================================
 * "SCHEDULED, STARTS IN THREE DAYS" — A GATE, AND NOT A SEVENTH `Standing`.
 * ============================================================================
 * The engine says `capped` for an Optin outside its window and for one whose
 * allowance is spent, because both mean *the allowance is spent and this
 * cannot change on this page view* (ADR 0047). The funnel is where the two
 * part company: a merchant told *"this browser has already had its
 * allowance"* about a sale that starts on Friday goes looking for a cookie.
 *
 * **The magnitude is the server's word and the direction is the browser's.**
 * The panel carries no `@wordpress/i18n` (ADR 0048), so "3 days" is minted in
 * PHP with `human_time_diff()`; which side of the boundary the visitor is on
 * is the same reading the verdict was taken against.
 */
describe('a scheduled Optin', () => {
  const scheduled = (over: Partial<ServerOptin> = {}) =>
    optin({ schedule: { starts: '3 days', ends: '10 days' }, ...over });

  it('says it has not started yet, and how long', () => {
    const row = first([scheduled()], [entry({ standing: 'capped', schedule: 'before' })]);

    expect(row.gate).toBe('schedule');
    expect(row.stopped).toBe('before_window');
    expect(row.subject).toBe('3 days');
  });

  it('says its window has closed, and how long ago', () => {
    const row = first([scheduled()], [entry({ standing: 'capped', schedule: 'after' })]);

    expect(row.gate).toBe('schedule');
    expect(row.stopped).toBe('after_window');
    expect(row.subject).toBe('10 days');
  });

  /**
   * The allowance is still the allowance. A scheduled Optin INSIDE its window
   * whose device has had its fill stops at `frequency`, with the sentence that
   * gate already has.
   */
  it('still says the allowance is spent for an Optin inside its window', () => {
    const row = first([scheduled()], [entry({ standing: 'capped', schedule: null })]);

    expect(row.gate).toBe('frequency');
    expect(row.stopped).toBe('capped');
    expect(row.subject).toBeNull();
  });

  /**
   * The schedule gate sits AFTER the payload gate, and that is the ordering
   * the whole feature turns on: a scheduled Optin is IN the published set and
   * DOES reach the browser before its window opens, so a merchant reading this
   * screen is told the nine things that are fine before the one that is not.
   */
  it('sits between reaching the browser and the allowance', () => {
    expect(GATES.indexOf('schedule')).toBe(GATES.indexOf('payload') + 1);
    expect(GATES.indexOf('schedule')).toBe(GATES.indexOf('frequency') - 1);
  });

  /**
   * A draft with a schedule is a DRAFT. The precedence this file exists to
   * pin, applied to the new gate.
   */
  it('says a draft is a draft, schedule or no schedule', () => {
    expect(first([scheduled({ published: false })], [entry({ standing: 'capped', schedule: 'before' })]).stopped)
      .toBe('draft');
  });
});


/**
 * ============================================================================
 * SITE-CAPPED AND OPTIN-CAPPED ARE ONE WORD AND TWO SENTENCES.
 * ============================================================================
 * The engine says `capped` for an Optin whose own allowance is spent and for
 * one the SITE's allowance vetoed, because both mean *the allowance is spent
 * and this cannot change on this page view*. A seventh `Standing` to tell them
 * apart is the thing ADR 0047 argues at length against; the distinction is a
 * sentence beside the word this screen already uses.
 *
 * It matters because the two send a merchant to different screens: one is a
 * setting on the Optin they are looking at, the other is a setting for the
 * whole site that is stopping every Optin on the page at once.
 */
describe('an Optin the site-wide allowance vetoed', () => {
  it('names the frequency gate, with the site’s own sentence', () => {
    const row = first([optin()], [entry({ standing: 'capped' })], new Set(['A']), true);

    expect(row.gate).toBe('frequency');
    expect(row.stopped).toBe('site_capped');
  });

  /** The site is a veto, so it is what the merchant is told about. */
  it('says the site stopped it even where the Optin’s own allowance is spent too', () => {
    expect(first([optin()], [entry({ standing: 'capped' })], new Set(['A']), true).stopped).toBe(
      'site_capped',
    );
  });

  /** Without one, nothing changes: this is still the sentence it has today. */
  it('leaves an Optin capped by its own allowance saying exactly that', () => {
    expect(first([optin()], [entry({ standing: 'capped' })], new Set(['A']), false).stopped).toBe(
      'capped',
    );
  });

  /**
   * The schedule still wins. A sale that starts on Friday is a date the
   * merchant set, and telling them about a site-wide cap sends them to a
   * setting that is not why this one is quiet.
   */
  it('yields to a schedule, which is the more actionable answer', () => {
    const row = first(
      [optin({ schedule: { starts: '3 days', ends: null } })],
      [entry({ standing: 'capped', schedule: 'before' })],
      new Set(['A']),
      true,
    );

    expect(row.gate).toBe('schedule');
    expect(row.stopped).toBe('before_window');
  });

  /** No new gate. The funnel is the same eleven steps it was. */
  it('adds no gate to the sequence', () => {
    expect(GATES).toHaveLength(11);
  });
});

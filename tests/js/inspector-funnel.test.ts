import { describe, expect, it } from 'vitest';
import { funnel, type ServerOptin, type ServerReport } from '@loader/inspect/report';
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
  ...over,
});

const first = (
  optins: ServerOptin[],
  browser: EntryReport[] = [entry()],
  reached = new Set(browser.map((each) => each.id)),
) => funnel(server(...optins), browser, reached, ARRIVAL).rows[0];

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
      [entry({ id: 'A', lostArbitration: true }), entry({ id: 'B' })],
      new Set(['A', 'B']),
      ARRIVAL,
    ).rows;

    expect(rows[0].stopped).toBe('lost');
    expect(rows[0].subject).toBe('Welcome');
    expect(rows[1].stopped).toBeNull();
    expect(rows[1].subject).toBeNull();
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

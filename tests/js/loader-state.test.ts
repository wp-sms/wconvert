import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { persistentStore } from '@loader/storage';
import { STATE_KEY, dayOf, loadState, saveState, withDismissal, withImpression } from '@loader/state';
import { isAllowed } from '@loader/frequency';
import type { VisitorState } from '@loader/types';

/**
 * Per-visitor state: the ladder it lives on, and what it is allowed to be.
 *
 * Two properties are asserted here rather than described. **Frequency capping
 * holds across days** — the property the loader prototype proved behind a
 * byte-identical cached page, and the one a refactor breaks silently. And
 * **nothing stored is a visitor identifier** (ADR 0017): the record itself,
 * never a key to one.
 */

const clearCookies = () => {
  for (const pair of document.cookie.split(';')) {
    document.cookie = pair.split('=')[0].trim() + '=;path=/;max-age=0';
  }
};

beforeEach(() => {
  localStorage.clear();
  clearCookies();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the storage ladder', () => {
  it('round-trips through localStorage when it is available', () => {
    const store = persistentStore(STATE_KEY);

    store.write('{"a":{"d":1}}');

    expect(localStorage.getItem(STATE_KEY)).toBe('{"a":{"d":1}}');
    expect(persistentStore(STATE_KEY).read()).toBe('{"a":{"d":1}}');
  });

  /**
   * ITP, private browsing, a quota'd-out origin. The cap must still hold, or
   * every visitor in that state looks new on every page view.
   */
  it('falls to a cookie when localStorage refuses to write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    persistentStore(STATE_KEY).write('{"a":{"d":1}}');

    expect(document.cookie).toContain(STATE_KEY);
    expect(persistentStore(STATE_KEY).read()).toBe('{"a":{"d":1}}');
  });

  /**
   * Fail OPEN, not shut. With both stores blocked the visitor looks new on the
   * next page view and sees the Optin again — annoying. Failing shut would mean
   * a privacy-refusing visitor sees nothing at all, which for a free plugin is
   * a large silent loss of function (issue #3).
   */
  it('keeps the page view consistent in memory when nothing can be persisted', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });

    const store = persistentStore(STATE_KEY);
    store.write('{"a":{"d":1}}');

    expect(store.read()).toBe('{"a":{"d":1}}');
    // A NEW page view has nothing, which is the fail-open end of the ladder.
    expect(persistentStore(STATE_KEY).read()).toBeNull();
  });

  it('reads a cookie written before localStorage was reachable', () => {
    document.cookie = STATE_KEY + '=' + encodeURIComponent('{"a":{"d":1}}') + ';path=/';

    expect(persistentStore(STATE_KEY).read()).toBe('{"a":{"d":1}}');
  });

  it('treats a blob it cannot parse as no state at all', () => {
    localStorage.setItem(STATE_KEY, 'not json');

    expect(loadState(persistentStore(STATE_KEY))).toEqual({});
  });
});

describe('frequency capping across days', () => {
  const DAY = 86_400_000;
  const march1 = Date.UTC(2026, 2, 1);

  it('keeps a dismissed Optin dismissed across page views and across days', () => {
    const store = persistentStore(STATE_KEY);

    saveState(store, withDismissal(loadState(store), 'a'));

    // A month later, on a page served byte-identically from the full-page
    // cache: nothing on the server knows this visitor, and the answer still
    // has to be no.
    const later = loadState(persistentStore(STATE_KEY));

    expect(isAllowed({ stopAfterDismiss: true }, later.a, dayOf(march1 + 30 * DAY))).toBe(false);
  });

  it('lets a cooldown expire on the day it says it will, and not before', () => {
    const store = persistentStore(STATE_KEY);

    saveState(store, withImpression(loadState(store), 'a', dayOf(march1)));

    const record = loadState(persistentStore(STATE_KEY)).a;

    expect(isAllowed({ cooldownDays: 7 }, record, dayOf(march1 + 6 * DAY))).toBe(false);
    expect(isAllowed({ cooldownDays: 7 }, record, dayOf(march1 + 7 * DAY))).toBe(true);
  });

  it('counts impressions towards maxImpressions across page views', () => {
    let state: VisitorState = {};

    for (let view = 0; view < 3; view++) {
      state = withImpression(state, 'a', dayOf(march1 + view * DAY));
    }

    expect(isAllowed({ maxImpressions: 3 }, state.a, dayOf(march1))).toBe(false);
    expect(isAllowed({ maxImpressions: 4 }, state.a, dayOf(march1))).toBe(true);
  });

  /**
   * Dismissing and converting are the two things a visitor DOES that mean
   * "stop showing me this", so both caps are on unless a merchant turns them
   * off. The two numbers are pacing decisions and default off.
   */
  it('stops after a dismissal or a conversion unless the merchant said otherwise', () => {
    expect(isAllowed(undefined, { d: 1 }, 0)).toBe(false);
    expect(isAllowed({ stopAfterDismiss: false }, { d: 1 }, 0)).toBe(true);

    expect(isAllowed(undefined, { c: 1 }, 0)).toBe(false);
    expect(isAllowed({ stopAfterConversion: false }, { c: 1 }, 0)).toBe(true);
  });

  it('caps nothing by number until a merchant asks for one', () => {
    expect(isAllowed(undefined, { i: 99, l: 0 }, 20_000)).toBe(true);
  });

  it('allows an Optin this device has never seen', () => {
    expect(isAllowed({ maxImpressions: 1, stopAfterDismiss: true }, undefined, 0)).toBe(true);
  });
});

/**
 * ADR 0017, asserted rather than described. Whatever this writes must be the
 * dismissal record itself — never a key pointing at one, and never a value that
 * would identify this browser to the next page view.
 */
describe('what reaches the visitor device', () => {
  it('writes nothing but per-Optin counters keyed by the ids already in the payload', () => {
    const store = persistentStore(STATE_KEY);
    let state = withImpression({}, '01JQ0000000000000000000001', 20_000);
    state = withDismissal(state, '01JQ0000000000000000000001');
    saveState(store, state);

    const written: unknown = JSON.parse(localStorage.getItem(STATE_KEY) as string);

    expect(written).toEqual({ '01JQ0000000000000000000001': { i: 1, l: 20_000, d: 1 } });

    // Every key is an Optin id the page already carried, and every value is a
    // number. There is nowhere for a minted identifier to hide.
    for (const [id, record] of Object.entries(written as Record<string, Record<string, unknown>>)) {
      expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(Object.keys(record).every((field) => ['i', 'l', 'd', 'c'].includes(field))).toBe(true);
      expect(Object.values(record).every((value) => typeof value === 'number')).toBe(true);
    }
  });

  it('sets no cookie at all while localStorage works', () => {
    saveState(persistentStore(STATE_KEY), withDismissal({}, 'a'));

    expect(document.cookie).toBe('');
  });
});

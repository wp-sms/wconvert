import { afterEach, describe, expect, it, vi } from 'vitest';
import { FREE_MODULES } from '@loader/modules';
import type { LoaderModule, Rule } from '@loader/types';

/**
 * The four rule implementations free's tier owns.
 *
 * Each is asserted through the module interface rather than its internals,
 * because the interface is what the shell relies on: `create` may attach, and
 * `holds` must answer for RIGHT NOW every time it is asked.
 */

const moduleFor = (id: string): LoaderModule => {
  const found = FREE_MODULES.find((module) => module.id === id);

  if (found === undefined) {
    throw new Error(`no free module for ${id}`);
  }

  return found;
};

/** Instantiate, ask, tear down — one page view's worth. */
function ask(id: string, rule: Rule, changed: () => void = () => {}): boolean {
  const evaluator = moduleFor(id).create(changed);
  const answer = evaluator.holds(rule);

  evaluator.stop?.();

  return answer;
}

const viewport = (width: number): void => {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === '(max-width: 767px)' ? width <= 767 : width <= 1023,
      }) as MediaQueryList,
  );
};

const document_ = (scrollHeight: number, innerHeight: number, scrollY: number): void => {
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(innerHeight);
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(scrollY);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('page_load', () => {
  it('holds unconditionally, which is what makes it a rule rather than an empty list', () => {
    expect(ask('page_load', { type: 'page_load' })).toBe(true);
  });
});

describe('time_on_page', () => {
  it('measures from navigation start, not from when this script ran', () => {
    vi.spyOn(performance, 'now').mockReturnValue(5_100);

    expect(ask('time_on_page', { type: 'time_on_page', seconds: 5 })).toBe(true);
    expect(ask('time_on_page', { type: 'time_on_page', seconds: 6 })).toBe(false);
  });

  it('asks the shell to decide again while it waits, and stops when torn down', () => {
    vi.useFakeTimers();
    const changed = vi.fn();

    const evaluator = moduleFor('time_on_page').create(changed);
    vi.advanceTimersByTime(1_000);
    expect(changed.mock.calls.length).toBeGreaterThan(0);

    const ticks = changed.mock.calls.length;
    evaluator.stop?.();
    vi.advanceTimersByTime(1_000);

    expect(changed.mock.calls.length).toBe(ticks);
    vi.useRealTimers();
  });
});

describe('scroll_depth', () => {
  /**
   * Read at instantiation, before any listener is attached: under delayed JS
   * the visitor has already scrolled and the events we missed are never
   * replayed.
   */
  it('reads the position it arrived at, without waiting for a scroll event', () => {
    document_(2_000, 1_000, 500);

    expect(ask('scroll_depth', { type: 'scroll_depth', percent: 50 })).toBe(true);
  });

  /** Or a rule saying "half way down" can never fire on a short page. */
  it('counts a document shorter than the viewport as fully scrolled', () => {
    document_(600, 1_000, 0);

    expect(ask('scroll_depth', { type: 'scroll_depth', percent: 100 })).toBe(true);
  });

  it('keeps a high-water mark, so scrolling back up does not un-reach a depth', () => {
    document_(2_000, 1_000, 0);

    const evaluator = moduleFor('scroll_depth').create(() => {});
    expect(evaluator.holds({ type: 'scroll_depth', percent: 50 })).toBe(false);

    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(500);
    window.dispatchEvent(new Event('scroll'));
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0);
    window.dispatchEvent(new Event('scroll'));

    expect(evaluator.holds({ type: 'scroll_depth', percent: 50 })).toBe(true);
    evaluator.stop?.();
  });
});

describe('device', () => {
  it.each([
    [375, 'mobile'],
    [800, 'tablet'],
    [1440, 'desktop'],
  ])('reads %ipx as %s', (width, bucket) => {
    viewport(width);

    expect(ask('device', { type: 'device', in: [bucket] })).toBe(true);
  });

  /** The set-valued scalar is how ADR 0005 answers "mobile or tablet". */
  it('holds for any bucket in the set', () => {
    viewport(800);

    expect(ask('device', { type: 'device', in: ['mobile', 'tablet'] })).toBe(true);
    expect(ask('device', { type: 'device', in: ['desktop'] })).toBe(false);
  });

  it('holds for nothing when the rule carries no set at all', () => {
    viewport(1_440);

    expect(ask('device', { type: 'device' })).toBe(false);
  });

  /**
   * No listener: `holds` reads `matchMedia` live, so a visitor who rotates a
   * tablet between a Trigger being armed and firing is answered at the instant
   * that matters.
   */
  it('re-reads the viewport on every question', () => {
    viewport(1_440);
    const evaluator = moduleFor('device').create(() => {});

    expect(evaluator.holds({ type: 'device', in: ['mobile'] })).toBe(false);

    viewport(375);

    expect(evaluator.holds({ type: 'device', in: ['mobile'] })).toBe(true);
  });
});

/**
 * `time_of_day` — a recurring window, **on the SITE's clock**.
 *
 * ============================================================================
 * THE TWO CASES THAT ARE NOT ARITHMETIC.
 * ============================================================================
 * A window that crosses midnight is not `from <= at < to`, and a site that
 * observes daylight saving is not "the offset we shipped". Both are the whole
 * reason this rule is worth a test rather than a line: the first is an
 * off-by-a-day that only shows up at night, and the second is an hour wrong
 * for half the year on a page a cache may serve for weeks.
 *
 * The zone reaches the browser on the payload tag and the browser's own tzdata
 * resolves it, so the site's clock stays right across a transition without
 * anything being rebuilt.
 */
describe('time_of_day', () => {
  const inZone = (zone: string): void => {
    const tag = document.createElement('script');

    tag.id = 'wconvert-payload';
    tag.setAttribute('data-tz', zone);
    document.body.append(tag);
  };

  const holdsAt = (between: string, instant: number, zone = 'UTC'): boolean => {
    document.body.innerHTML = '';
    inZone(zone);
    vi.setSystemTime(instant);

    return ask('time_of_day', { type: 'time_of_day', between });
  };

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('holds inside an ordinary window and not outside it', () => {
    expect(holdsAt('09:00-17:00', Date.UTC(2026, 5, 15, 12, 0))).toBe(true);
    expect(holdsAt('09:00-17:00', Date.UTC(2026, 5, 15, 8, 59))).toBe(false);
    expect(holdsAt('09:00-17:00', Date.UTC(2026, 5, 15, 20, 0))).toBe(false);
  });

  /** Half-open, like a schedule: live AT nine and over AT five. */
  it('opens at its start and closes at its end', () => {
    expect(holdsAt('09:00-17:00', Date.UTC(2026, 5, 15, 9, 0))).toBe(true);
    expect(holdsAt('09:00-17:00', Date.UTC(2026, 5, 15, 17, 0))).toBe(false);
  });

  /**
   * THE MIDNIGHT CASE. *"Only overnight"* is a window whose end is smaller
   * than its start, and the arithmetic every implementation gets wrong first
   * is `at >= from && at < to`, which holds for nobody.
   */
  it('holds across midnight, on both sides of it', () => {
    expect(holdsAt('22:00-02:00', Date.UTC(2026, 5, 15, 23, 30))).toBe(true);
    expect(holdsAt('22:00-02:00', Date.UTC(2026, 5, 15, 1, 30))).toBe(true);
    expect(holdsAt('22:00-02:00', Date.UTC(2026, 5, 15, 22, 0))).toBe(true);
    expect(holdsAt('22:00-02:00', Date.UTC(2026, 5, 15, 2, 0))).toBe(false);
    expect(holdsAt('22:00-02:00', Date.UTC(2026, 5, 15, 12, 0))).toBe(false);
  });

  /**
   * THE DST CASE. One UTC instant, one site, two answers — because London is
   * an hour ahead of UTC in June and level with it in January.
   *
   * Nothing is recomputed on the server for this: the zone travels and the
   * browser's own tzdata resolves it, so a page cached before a transition is
   * still right after one.
   */
  it('follows the site’s clock across a daylight-saving transition', () => {
    // 12:00 UTC is 13:00 in London in June, and 12:00 in January.
    expect(holdsAt('13:00-14:00', Date.UTC(2026, 5, 15, 12, 0), 'Europe/London')).toBe(true);
    expect(holdsAt('13:00-14:00', Date.UTC(2026, 0, 15, 12, 0), 'Europe/London')).toBe(false);
    expect(holdsAt('12:00-13:00', Date.UTC(2026, 0, 15, 12, 0), 'Europe/London')).toBe(true);
  });

  /** And it is the SITE's clock, never the visitor's. */
  it('answers for the site even where the visitor is a day away', () => {
    // 23:00 UTC on the 15th is 08:00 on the 16th in Tokyo.
    expect(holdsAt('08:00-09:00', Date.UTC(2026, 5, 15, 23, 0), 'Asia/Tokyo')).toBe(true);
    expect(holdsAt('23:00-23:59', Date.UTC(2026, 5, 15, 23, 0), 'Asia/Tokyo')).toBe(false);
  });

  /**
   * A site with no city chosen stores a fixed offset, which never observes
   * daylight saving — so it is arithmetic and needs no tzdata at all.
   */
  it('reads a fixed offset, half-hours included', () => {
    expect(holdsAt('17:00-18:00', Date.UTC(2026, 5, 15, 12, 0), '+05:30')).toBe(true);
    expect(holdsAt('07:00-08:00', Date.UTC(2026, 5, 15, 12, 0), '-05:00')).toBe(true);
    // Past midnight the other way: 01:00 UTC is 20:00 the previous day.
    expect(holdsAt('20:00-21:00', Date.UTC(2026, 5, 15, 1, 0), '-05:00')).toBe(true);
  });

  /**
   * **Everything it cannot read holds for nobody**, which is the same fail-shut
   * rule `decide.ts` gives a rule that throws. The safe direction here is
   * showing nothing rather than showing at the wrong hour: a merchant who set
   * opening hours meant them.
   */
  it.each([
    ['a rule with no window at all', undefined],
    ['a window it cannot parse', 'evenings'],
    ['an hour that does not exist', '25:00-26:00'],
    ['a minute that does not exist', '09:60-17:00'],
    ['a window with no end', '09:00-'],
    ['a window of no length', '09:00-09:00'],
  ])('holds for nobody given %s', (_case, between) => {
    document.body.innerHTML = '';
    inZone('UTC');
    vi.setSystemTime(Date.UTC(2026, 5, 15, 12, 0));

    expect(ask('time_of_day', { type: 'time_of_day', between })).toBe(false);
  });

  /** A page carrying no zone cannot answer, so it answers no. */
  it('holds for nobody where the page carries no timezone', () => {
    document.body.innerHTML = '';
    vi.setSystemTime(Date.UTC(2026, 5, 15, 12, 0));

    expect(ask('time_of_day', { type: 'time_of_day', between: '00:00-23:59' })).toBe(false);
  });

  /** And a zone string nothing recognises is the same answer. */
  it('holds for nobody where the zone cannot be read', () => {
    expect(holdsAt('00:00-23:59', Date.UTC(2026, 5, 15, 12, 0), 'Middle/Earth')).toBe(false);
  });
});

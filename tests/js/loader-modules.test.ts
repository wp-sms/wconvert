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

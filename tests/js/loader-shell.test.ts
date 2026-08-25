import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLoader } from '@loader/engine';
import { FREE_MODULES } from '@loader/modules';
import { start } from '@loader/shell';
import type { Store } from '@loader/storage';
import type { LoaderModule, PayloadEntry, Presenter } from '@loader/types';

/**
 * The shell, driven the way a cached page drives it.
 *
 * The page is served byte-identically to every visitor — PHP is not running at
 * all on a cache hit — so every difference between two page views has to come
 * out of this device's own state. That is the property the loader prototype
 * proved against a real reverse-proxy cache, and the one a refactor breaks
 * silently.
 */

const DAY = 86_400_000;
const march1 = Date.UTC(2026, 2, 1);

const loader = createLoader(FREE_MODULES);

/** One store, surviving across page views, the way a real one does. */
function fakeStore(): Store {
  let held: string | null = null;

  return {
    read: () => held,
    write: (value) => void (held = value),
  };
}

function recordingPresenter(): Presenter & { shown: string[]; dismiss(id: string): void } {
  const shown: string[] = [];
  const controls = new Map<string, { dismiss(): void; convert(): void }>();

  return {
    shown,
    show(entry, entryControls) {
      shown.push(entry.id);
      controls.set(entry.id, entryControls);
    },
    dismiss(id) {
      controls.get(id)?.dismiss();
    },
  };
}

const optin = (overrides: Partial<PayloadEntry> = {}): PayloadEntry => ({
  id: 'a',
  display_type: 'popup',
  triggers: [{ type: 'page_load' }],
  conditions: [],
  ...overrides,
});

/** One page view over an unchanging payload — the cached HTML, re-parsed. */
function pageView(entries: readonly PayloadEntry[], store: Store, at: number) {
  const presenter = recordingPresenter();
  const stop = start({ loader, entries, presenter, store, now: () => at });

  return { presenter, stop };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('one payload, many page views', () => {
  it('keeps a dismissed Optin dismissed on the next page view and a month later', () => {
    const store = fakeStore();
    const entries = [optin({ frequency: { stopAfterDismiss: true } })];

    const first = pageView(entries, store, march1);
    expect(first.presenter.shown).toEqual(['a']);
    first.presenter.dismiss('a');

    // Same HTML, same second: the server cannot have learnt anything.
    expect(pageView(entries, store, march1).presenter.shown).toEqual([]);
    expect(pageView(entries, store, march1 + 30 * DAY).presenter.shown).toEqual([]);
  });

  it('honours a cooldown to the day, then shows again', () => {
    const store = fakeStore();
    const entries = [optin({ frequency: { cooldownDays: 7 } })];

    expect(pageView(entries, store, march1).presenter.shown).toEqual(['a']);
    expect(pageView(entries, store, march1 + 6 * DAY).presenter.shown).toEqual([]);
    expect(pageView(entries, store, march1 + 7 * DAY).presenter.shown).toEqual(['a']);
  });

  it('spends an impression allowance across page views and then stops', () => {
    const store = fakeStore();
    const entries = [optin({ frequency: { maxImpressions: 2 } })];

    expect(pageView(entries, store, march1).presenter.shown).toEqual(['a']);
    expect(pageView(entries, store, march1).presenter.shown).toEqual(['a']);
    expect(pageView(entries, store, march1).presenter.shown).toEqual([]);
  });

  /**
   * The whole point of the delivery model: three visitors, one byte-identical
   * page, three different and correct behaviours.
   */
  it('gives two devices over one cached page their own answers', () => {
    const entries = [optin({ frequency: { stopAfterDismiss: true } })];
    const dismissed = fakeStore();
    const fresh = fakeStore();

    pageView(entries, dismissed, march1).presenter.dismiss('a');

    expect(pageView(entries, dismissed, march1).presenter.shown).toEqual([]);
    expect(pageView(entries, fresh, march1).presenter.shown).toEqual(['a']);
  });
});

describe('the contest for the screen', () => {
  it('shows no runner-up when the visitor dismisses the winner', () => {
    const { presenter } = pageView(
      [optin({ id: 'a', priority: 9 }), optin({ id: 'b', priority: 1 })],
      fakeStore(),
      march1,
    );

    expect(presenter.shown).toEqual(['a']);

    presenter.dismiss('a');

    expect(presenter.shown).toEqual(['a']);
  });

  it('shows every eligible inline Optin, and one overlay beside them', () => {
    const { presenter } = pageView(
      [
        optin({ id: 'a', display_type: 'popup', priority: 1 }),
        optin({ id: 'b', display_type: 'inline' }),
        optin({ id: 'c', display_type: 'inline' }),
        optin({ id: 'd', display_type: 'slide_in', priority: 9 }),
      ],
      fakeStore(),
      march1,
    );

    expect(presenter.shown.sort()).toEqual(['b', 'c', 'd']);
  });
});

describe('what the page pays for', () => {
  /**
   * Lazy subscription (issue #3): the scroll listener and the timer are dead
   * weight on a page whose payload contains no rule needing them.
   */
  it('attaches no scroll listener when nothing on the page scrolls', () => {
    const listen = vi.spyOn(window, 'addEventListener');

    pageView([optin()], fakeStore(), march1);

    expect(listen).not.toHaveBeenCalledWith('scroll', expect.anything(), expect.anything());
  });

  it('attaches no timer when nothing on the page is time-based', () => {
    const timer = vi.spyOn(globalThis, 'setInterval');

    pageView([optin()], fakeStore(), march1);

    expect(timer).not.toHaveBeenCalled();
  });

  it('attaches the scroll listener when something does scroll', () => {
    const listen = vi.spyOn(window, 'addEventListener');

    pageView([optin({ triggers: [{ type: 'scroll_depth', percent: 50 }] })], fakeStore(), march1);

    expect(listen).toHaveBeenCalledWith('scroll', expect.anything(), expect.anything());
  });

  /**
   * Once every candidate is settled, no later signal can change the answer.
   * Tearing down is what stops a 250ms timer running for the rest of a visit
   * on a page that has already made up its mind.
   */
  it('releases every listener once nothing is left to decide', () => {
    const forget = vi.spyOn(window, 'removeEventListener');
    const clear = vi.spyOn(globalThis, 'clearInterval');

    pageView(
      [optin({ triggers: [{ type: 'scroll_depth', percent: 0 }, { type: 'time_on_page', seconds: 0 }] })],
      fakeStore(),
      march1,
    );

    expect(forget).toHaveBeenCalledWith('scroll', expect.anything());
    expect(clear).toHaveBeenCalled();
  });

  it('keeps them while something is still waiting for its moment', () => {
    const clear = vi.spyOn(globalThis, 'clearInterval');

    pageView([optin({ triggers: [{ type: 'time_on_page', seconds: 3_600 }] })], fakeStore(), march1);

    expect(clear).not.toHaveBeenCalled();
  });
});

/**
 * Storage Consent, on the two installs that exist: one with no consent plugin
 * at all, and one with a CMP the visitor has answered.
 */
describe('storage consent', () => {
  /** A stand-in for the premium rules whose storage falls in the strict bucket. */
  const countsPageviews: LoaderModule = {
    id: 'total_pageviews',
    kind: 'condition',
    consentCategory: 'statistics',
    create: () => ({ holds: () => true }),
  };

  const gated = createLoader([...FREE_MODULES, countsPageviews]);

  const withGatedCondition = optin({ conditions: [{ type: 'total_pageviews', min: 2 }] });

  afterEach(() => {
    delete window.wp_has_consent;
  });

  /**
   * The API is absent on most installs, so `wp_has_consent` is undefined and
   * the gate fails open — correct, because a site with no CMP has made no
   * determination for us to honour. The plugin is never bundled or required.
   */
  it('fails open where no consent plugin is installed', () => {
    const presenter = recordingPresenter();
    start({ loader: gated, entries: [withGatedCondition], presenter, store: fakeStore(), now: () => march1 });

    expect(presenter.shown).toEqual(['a']);
  });

  it('does not show an Optin whose rule needs a category the visitor withheld', () => {
    window.wp_has_consent = (category) => category !== 'statistics';

    const presenter = recordingPresenter();
    start({ loader: gated, entries: [withGatedCondition], presenter, store: fakeStore(), now: () => march1 });

    expect(presenter.shown).toEqual([]);
  });

  /**
   * "An Optin whose rules need bucket two is NOT evaluated rather than
   * evaluated-as-false — so it can still fire later in the same page view when
   * consent arrives" (issue #11). Evaluated-as-false would need a page reload
   * to recover, which is a banner click the visitor already made.
   */
  it('fires it later in the same page view when the visitor accepts', () => {
    let granted = false;
    window.wp_has_consent = () => granted;

    const presenter = recordingPresenter();
    start({ loader: gated, entries: [withGatedCondition], presenter, store: fakeStore(), now: () => march1 });

    expect(presenter.shown).toEqual([]);

    granted = true;
    document.dispatchEvent(new Event('wp_listen_for_consent_change'));

    expect(presenter.shown).toEqual(['a']);
  });

  /**
   * Dismissal storage is `functional` and is NEVER withheld: it records a
   * choice the visitor made by clicking the close button, and withholding it
   * means the popup reappears after they closed it. The prototype's single gate
   * covered all storage including dismissal, which is exactly that bug.
   */
  it('still remembers a dismissal when the visitor refused every category', () => {
    window.wp_has_consent = () => false;

    const store = fakeStore();
    const entries = [optin({ frequency: { stopAfterDismiss: true } })];

    const first = pageView(entries, store, march1);
    expect(first.presenter.shown).toEqual(['a']);
    first.presenter.dismiss('a');

    expect(pageView(entries, store, march1 + DAY).presenter.shown).toEqual([]);
  });
});

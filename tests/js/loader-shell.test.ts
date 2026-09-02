import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Beacon } from '@loader/beacon';
import { createLoader } from '@loader/engine';
import { FREE_MODULES } from '@loader/modules';
import { start } from '@loader/shell';
import type { Store } from '@loader/storage';
import type { LoaderModule, PayloadEntry } from '@loader/types';
import { recordingPresenter, silentPresenter } from './support/presenter';

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
  /**
   * With NO frequency block at all — the shape a merchant gets by not thinking
   * about it. A dismissal that only sticks when configured makes the record
   * something written, read and ignored, and ADR 0017's justification for
   * writing anything to the device at all is that it stops the popup coming
   * back.
   */
  it('keeps a dismissed Optin dismissed by default', () => {
    const store = fakeStore();
    const entries = [optin()];

    pageView(entries, store, march1).presenter.dismiss('a');

    expect(pageView(entries, store, march1).presenter.shown).toEqual([]);
    expect(pageView(entries, store, march1 + 30 * DAY).presenter.shown).toEqual([]);
  });

  it('lets a merchant turn that off deliberately', () => {
    const store = fakeStore();
    const entries = [optin({ frequency: { stopAfterDismiss: false } })];

    pageView(entries, store, march1).presenter.dismiss('a');

    expect(pageView(entries, store, march1).presenter.shown).toEqual(['a']);
  });

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

/**
 * The Impression is the presenter's to report, and the frequency cap is spent
 * against it rather than against the decision to show.
 */
describe('who spends the allowance', () => {
  it('spends nothing when the renderer never reported the Optin as seen', () => {
    const store = fakeStore();
    const entries = [optin({ frequency: { maxImpressions: 1 } })];

    // An `inline` Optin rendered far below the fold that the visitor never
    // scrolled to. It has not been seen, so it has not been spent.
    const unseen = silentPresenter();
    start({ loader, entries, presenter: unseen, store, now: () => march1 });
    expect(unseen.shown).toEqual(['a']);

    expect(pageView(entries, store, march1).presenter.shown).toEqual(['a']);
  });
});

/**
 * **Two records, one act.**
 *
 * The device's record answers "should this Optin show again here" and the
 * site's counters answer "how is it doing" — neither is derivable from the
 * other. The first is `functional` storage the visitor's consent never gates,
 * because it exists to honour a choice they made by clicking close; the second
 * is no storage on the device at all, because the beacon is stateless
 * (ADR 0017).
 */
describe('what the site is told', () => {
  /** A beacon that records rather than posts. */
  function recordingBeacon(): Beacon & { reported: string[] } {
    const reported: string[] = [];

    return {
      reported,
      report: (id, kind) => void reported.push(`${id}:${kind}`),
      flush: () => undefined,
      stop: () => undefined,
    };
  }

  it('reports every act the presenter reports, against the Optin it happened to', () => {
    const beacon = recordingBeacon();
    const presenter = recordingPresenter();

    start({ loader, entries: [optin()], presenter, store: fakeStore(), now: () => march1, beacon });
    presenter.convert('a');
    presenter.dismiss('a');

    expect(beacon.reported).toEqual(['a:impression', 'a:conversion', 'a:dismiss']);
  });

  /**
   * A presenter that never reported the Impression — an `inline` Optin far
   * below the fold that the visitor never scrolled to — tells the site nothing
   * either. An Optin nobody saw has not been seen, and counting it would put a
   * denominator under a conversion rate that never had a chance.
   */
  it('says nothing about an Optin that was never actually seen', () => {
    const beacon = recordingBeacon();

    start({ loader, entries: [optin()], presenter: silentPresenter(), store: fakeStore(), now: () => march1, beacon });

    expect(beacon.reported).toEqual([]);
  });

  /**
   * The listeners come off the moment every candidate is settled — on a page
   * with one `page_load` Optin that is immediately — and the Conversion has not
   * happened yet at that point. So teardown must not take the beacon with it.
   */
  it('still reports a Conversion after the rule listeners have been torn down', () => {
    const beacon = recordingBeacon();
    const presenter = recordingPresenter();

    const stop = start({ loader, entries: [optin()], presenter, store: fakeStore(), now: () => march1, beacon });

    stop();
    presenter.convert('a');

    expect(beacon.reported).toContain('a:conversion');
  });
});

/**
 * ============================================================================
 * OUTSIDE ITS WINDOW: NOTHING ON SCREEN, AND **NO ROW**.
 * ============================================================================
 * Not a zero-valued one — no row at all. That is the reading ADR 0027 takes of
 * a [[Suspended]] Optin and ADR 0050 takes of a scheduled one, for the same
 * reason: a campaign contributing zeroes against a live denominator makes two
 * periods incomparable, and ADR 0019's counters cannot be recomputed
 * afterwards.
 *
 * It falls out of the presenter never being reached rather than from a filter,
 * which is exactly why it is pinned here: the reasoning lives in prose and the
 * only thing that can hold it is a test that drives the real shell over a real
 * payload.
 */
describe('an Optin outside its scheduled window', () => {
  function recordingBeacon(): Beacon & { reported: string[] } {
    const reported: string[] = [];

    return {
      reported,
      report: (id, kind) => void reported.push(`${id}:${kind}`),
      flush: () => undefined,
      stop: () => undefined,
    };
  }

  /** The three cases on one page, so the negatives have a positive beside them. */
  const entries = [
    optin({ id: 'not-started', starts_at: march1 + 3 * DAY, display_type: 'inline' }),
    optin({ id: 'finished', ends_at: march1 - DAY, display_type: 'inline' }),
    optin({ id: 'running', starts_at: march1 - DAY, ends_at: march1 + DAY, display_type: 'inline' }),
  ];

  it('is never shown, while the one inside its window is', () => {
    const presenter = recordingPresenter();

    start({ loader, entries, presenter, store: fakeStore(), now: () => march1 });

    expect(presenter.shown).toEqual(['running']);
  });

  it('tells the site nothing at all, and the one that showed tells it once', () => {
    const beacon = recordingBeacon();

    start({ loader, entries, presenter: recordingPresenter(), store: fakeStore(), now: () => march1, beacon });

    expect(beacon.reported).toEqual(['running:impression']);
  });

  /**
   * And it spends no allowance either, so the day its window opens it is a
   * visitor who has never seen it — which is what makes a schedule and a
   * [[Frequency]] cap composable rather than one quietly eating the other.
   */
  it('spends none of its own allowance while it waits', () => {
    const store = fakeStore();

    start({ loader, entries, presenter: recordingPresenter(), store, now: () => march1 });

    expect(store.read() ?? '').not.toContain('not-started');
  });
});


import { afterEach, describe, expect, it } from 'vitest';
import { start } from '@loader/shell';
import { DOCUMENT_STYLE_ID } from '@renderer/mount';
import type { Store } from '@loader/storage';
import type { PayloadEntry } from '@loader/types';
import proLoader from '../../resources/loader/src/elite';
import { proPresenter } from '../../modules/display-types/loader';

/**
 * Three overlays now, and still one per page view.
 *
 * ============================================================================
 * THE TWO PREMIUM TYPES COMPETE. THEY DO NOT GET A LANE OF THEIR OWN.
 * ============================================================================
 * `popup`, `floating_bar` and `slide_in` are all overlays — they compete for
 * the visitor's screen, so at most one is shown per page view — and `inline`
 * is not, because it renders where it was embedded (CONTEXT.md, Display Type).
 * Pro adding two containers must not add two exceptions: a bar and a popup on
 * one page is a contest with one winner, not a bar AND a popup.
 *
 * **`decide()` already answers this and it is deliberately not asked again
 * here.** `isOverlay` reads anything that is not `inline` as an overlay, which
 * is why the two types arrived pre-arbitrated the day they were named. What
 * this file holds is that the property survived the containers landing —
 * because the shape a regression takes is a list of Display Types added
 * somewhere to route the rendering, and then read by mistake to route the
 * contest.
 *
 * It runs on the REAL composed Pro loader and the REAL presenter, so what is
 * asserted is the page a merchant would get.
 */

const TEMPLATE = {
  tree: {
    steps: [
      {
        type: 'stack',
        children: [
          { type: 'heading', text: 'Ten percent off' },
          { type: 'field', name: 'email' },
          { type: 'button', label: 'Go', action: 'submit' },
        ],
      },
      { type: 'stack', children: [{ type: 'heading', role: 'success_headline', text: 'Check your inbox' }] },
    ],
  },
  tokens: { bg: '#fff' },
};

const optin = (id: string, displayType: string, priority?: number): PayloadEntry => ({
  id,
  display_type: displayType,
  template: TEMPLATE,
  priority,
  triggers: [{ type: 'page_load' }],
  conditions: [],
});

/** A store that starts with whatever this test seeded and never touches localStorage. */
const fakeStore = (held: string | null = null): Store => ({
  read: () => held,
  write: (value) => void (held = value),
});

const pageView = (entries: readonly PayloadEntry[], store: Store = fakeStore()) =>
  start({
    loader: proLoader,
    entries,
    presenter: proPresenter,
    store,
    now: () => Date.UTC(2026, 8, 2),
  });

afterEach(() => {
  document.querySelectorAll('dialog').forEach((dialog) => dialog.close());
  document.body.innerHTML = '';
  document.getElementById(DOCUMENT_STYLE_ID)?.remove();
});

const popovers = () => document.querySelectorAll('[popover]');
const dialogs = () => document.querySelectorAll('dialog');

it('fullscreen competes for the same single overlay slot', () => {
  const stop = pageView([
    optin('full', 'fullscreen', 20), optin('bar', 'floating_bar', 10), optin('pop', 'popup', 1),
  ]);
  expect(dialogs()).toHaveLength(1);
  expect(popovers()).toHaveLength(0);
  expect(dialogs()[0].style.blockSize).toBe('100dvh');
  stop();
});

it('a dismissed fullscreen uses the existing allowance and lets the next overlay compete', () => {
  const stop = pageView(
    [optin('full', 'fullscreen', 20), optin('bar', 'floating_bar', 1)],
    fakeStore(JSON.stringify({ full: { i: 1, l: 20_698, d: 1 } })),
  );
  expect(dialogs()).toHaveLength(0);
  expect(popovers()).toHaveLength(1);
  stop();
});

describe('a bar and a popup, both eligible on one page view', () => {
  it('shows one overlay and not two', () => {
    const stop = pageView([optin('bar', 'floating_bar', 10), optin('pop', 'popup', 1)]);

    expect(popovers()).toHaveLength(1);
    expect(dialogs()).toHaveLength(0);
    stop();
  });

  /**
   * **Priority first, then id** — deterministic, so the winner is never a
   * property of the order the published set happened to be built in. The
   * Display Type decides nothing: a popup outranking a bar and a bar
   * outranking a popup are the same rule read twice.
   */
  it('lets the higher priority win whichever type it is', () => {
    const stop = pageView([optin('bar', 'slide_in', 1), optin('pop', 'popup', 10)]);

    expect(dialogs()).toHaveLength(1);
    expect(popovers()).toHaveLength(0);
    stop();
  });

  /**
   * **`inline` is not in the contest**, so a bar winning it does not suppress
   * an inline Optin the merchant embedded on the same page. It renders where
   * it was put and never competes for the screen.
   */
  it('leaves an inline Optin on the same page alone', () => {
    const anchor = document.createElement('div');

    anchor.setAttribute('data-wconvert-optin', 'embedded');
    document.body.appendChild(anchor);

    const stop = pageView([optin('bar', 'floating_bar'), optin('embedded', 'inline')]);

    expect(popovers()).toHaveLength(1);
    expect(anchor.children).toHaveLength(1);
    stop();
  });
});

describe('the dismissal record', () => {
  /**
   * **A visitor who closed the bar is not handed the popup instead.**
   *
   * The record is honoured before any rule is evaluated: it is not a question
   * about this page view, it is what this device has already been shown
   * (CONTEXT.md, Frequency). `stopAfterDismiss` defaults ON per Optin, because
   * a visitor who closed something said stop showing me *this* — so nothing in
   * the payload has to ask for it.
   *
   * Seeded rather than performed, because the record is what is under test.
   * The press that WRITES one is `popover-container.test.ts`'s, and the whole
   * round trip is the browser pass's.
   */
  it('suppresses the bar it was written for, and lets the runner-up through', () => {
    const dismissed = fakeStore(JSON.stringify({ bar: { i: 1, l: 20_698, d: 1 } }));
    const stop = pageView([optin('bar', 'floating_bar', 10), optin('pop', 'popup', 1)], dismissed);

    // The bar is capped, so the contest it would have won is one it is not in.
    expect(popovers()).toHaveLength(0);
    expect(dialogs()).toHaveLength(1);
    stop();
  });

  /**
   * And the other direction, which is the one that would silently over-show:
   * a dismissed POPUP must not let a bar through on a page view the popup had
   * already spent — it must let it through only because the popup is capped,
   * never because the bar is a different kind of thing.
   */
  it('is read the same way whichever type wrote it', () => {
    const dismissed = fakeStore(JSON.stringify({ pop: { i: 1, l: 20_698, d: 1 } }));
    const stop = pageView([optin('pop', 'popup', 10), optin('bar', 'slide_in', 1)], dismissed);

    expect(dialogs()).toHaveLength(0);
    expect(popovers()).toHaveLength(1);
    stop();
  });
});

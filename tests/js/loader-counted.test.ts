import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Beacon, BeaconKind } from '@loader/beacon';
import { reporting } from '@loader/beacon';
import { INLINE_ANCHOR_ATTRIBUTE, templatePresenter } from '@loader/present';
import { DOCUMENT_STYLE_ID } from '@renderer/mount';
import type { PayloadEntry } from '@loader/types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * **What actually gets counted, from the gesture to the beacon.**
 *
 * The pieces each have their own tests — `loader-present` proves the presenter
 * reports the two Impression moments, `loader-shell` proves the shell's controls
 * reach the beacon, `loader-beacon` proves how a batch travels. What none of
 * them proves is the COMPOSITION, and the composition is what two of #26's
 * acceptance criteria are actually about: *"Overlay impressions fire on render;
 * `inline` impressions fire on viewport entry"* and *"All four dismissal
 * gestures record one `dismiss`, and leaving without converting records
 * nothing"*.
 *
 * Inferring a chain from three tests that each hold one link is how a chain
 * gets broken in the middle.
 */

const OPTIN = '01JQ0000000000000000000001';

const TEMPLATE = {
  tree: {
    steps: [
      {
        type: 'stack',
        children: [
          { type: 'heading', text: 'Join the list' },
          { type: 'field', name: 'email' },
          { type: 'button', label: 'Go', action: 'submit' },
        ],
      },
      { type: 'stack', children: [{ type: 'heading', role: 'success_headline', text: 'Check your inbox' }] },
    ],
  },
  tokens: { bg: '#fff' },
};

const entry = (over: Partial<PayloadEntry> = {}): PayloadEntry => ({
  id: OPTIN,
  display_type: 'popup',
  template: TEMPLATE,
  ...over,
});

/** A beacon that records what it was told, in order. */
function countingBeacon(): Beacon & { counted: BeaconKind[] } {
  const counted: BeaconKind[] = [];

  return {
    counted,
    report: (_id, kind) => void counted.push(kind),
    flush: () => undefined,
    stop: () => undefined,
  };
}

/**
 * The shell's own controls, reduced to nothing.
 *
 * This file is about what reaches the SITE. What reaches the device is
 * `loader-shell`'s subject, and mixing the two would make a failure here
 * ambiguous about which half broke.
 */
const deviceRecordsNothing = { impression: () => undefined, dismiss: () => undefined, convert: () => undefined };

/** Show one Optin, with its acts wired through to a counting beacon. */
function show(over: Partial<PayloadEntry> = {}) {
  const beacon = countingBeacon();

  templatePresenter.show(entry(over), reporting(beacon, OPTIN, deviceRecordsNothing));

  return beacon;
}

let observed: (() => void)[] = [];

beforeEach(() => {
  observed = [];
});

afterEach(() => {
  document.body.innerHTML = '';
  document.getElementById(DOCUMENT_STYLE_ID)?.remove();
  vi.unstubAllGlobals();
});

/**
 * An `IntersectionObserver` whose intersection a test decides when to fire.
 *
 * **`disconnect()` really stops it.** A stub that kept delivering after
 * disconnect would make the "counted once" test below an assertion about this
 * class rather than about the loader — the real browser stops calling back, and
 * the loader disconnecting before it reports is the whole mechanism.
 */
function observerUnderTestControl(): void {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private stopped = false;

      constructor(private readonly callback: (entries: { isIntersecting: boolean }[]) => void) {}

      observe(): void {
        observed.push(() => {
          if (!this.stopped) {
            this.callback([{ isIntersecting: true }]);
          }
        });
      }

      disconnect(): void {
        this.stopped = true;
      }
    },
  );
}

describe('an Impression has two moments', () => {
  it('counts an overlay the moment it is shown', () => {
    // The three overlays render in the top layer, so being rendered IS being on
    // screen (CONTEXT.md, Impression).
    expect(show().counted).toEqual(['impression']);
  });

  /**
   * **The seam #26 names: an `inline` Optin below the fold records nothing
   * until it enters the viewport.**
   *
   * An inline Optin renders where it was embedded and may sit far below the
   * fold, so the moment it is MOUNTED is not the moment it was seen. Counting
   * at mount would put a denominator under a conversion rate for an Optin
   * nobody looked at.
   */
  it('counts an inline Optin only when it enters the viewport', () => {
    observerUnderTestControl();

    const anchor = document.createElement('div');

    anchor.setAttribute(INLINE_ANCHOR_ATTRIBUTE, OPTIN);
    document.body.appendChild(anchor);

    const beacon = show({ display_type: 'inline' });

    expect(anchor.querySelector('div')).not.toBeNull();
    expect(beacon.counted).toEqual([]);

    observed.forEach((intersect) => intersect());

    expect(beacon.counted).toEqual(['impression']);
  });

  /**
   * Once. An Optin scrolled past twice was seen once (CONTEXT.md, Impression),
   * and a counter that cannot be recomputed must not be able to double.
   */
  it('counts it once however often it re-enters', () => {
    observerUnderTestControl();

    const anchor = document.createElement('div');

    anchor.setAttribute(INLINE_ANCHOR_ATTRIBUTE, OPTIN);
    document.body.appendChild(anchor);

    const beacon = show({ display_type: 'inline' });
    const intersect = observed[0];

    intersect();
    intersect();

    expect(beacon.counted).toEqual(['impression']);
  });

  /**
   * An inline Optin whose anchor is not on this page renders nothing and
   * reports nothing — the safe direction, because an Optin nobody saw has not
   * been seen.
   */
  it('counts nothing for an inline Optin with no anchor on the page', () => {
    expect(show({ display_type: 'inline' }).counted).toEqual([]);
  });
});

/**
 * **The four ways of dismissing are one thing, not four.** No merchant acts
 * differently on "closed with Escape" than on "clicked the X" (CONTEXT.md,
 * Dismissal), so all four produce the same single `dismiss`.
 *
 * They are one thing **structurally**, which is stronger than four tests
 * agreeing. Every gesture reaches the dialog's `close` event and there is
 * exactly one `onDismiss` call site behind it: the close button's handler calls
 * `dialog.close()`, the backdrop handler calls `dialog.close()`, and `Esc` and
 * the browser's own light-dismiss are the user agent calling it. There is no
 * per-gesture branch to disagree, and the last test here is what keeps it that
 * way.
 *
 * The close BUTTON is not clicked from out here, and cannot be: it lives inside
 * a `closed` shadow root, which is exactly as closed to a test as it is to a
 * theme script (ADR 0009). Reaching in to click it would be testing a boundary
 * this design is built on breaking. What is observable from outside — the
 * backdrop click, and the `close` event every gesture funnels into — is what is
 * asserted.
 */
describe('the four dismissal gestures', () => {
  const dialog = (): HTMLDialogElement => {
    const found = document.querySelector('dialog');

    expect(found).not.toBeNull();

    return found as HTMLDialogElement;
  };

  /**
   * The funnel. `Esc`, the close button and the browser's light-dismiss all
   * arrive here — jsdom supplies none of the native behaviour behind them
   * (`tests/js/setup.ts` says so at length), so each is exercised as what it
   * DOES, which is close the dialog.
   */
  it('counts exactly one dismiss when the dialog closes', () => {
    const beacon = show();

    dialog().close();

    expect(beacon.counted).toEqual(['impression', 'dismiss']);
  });

  it('counts one dismiss for a click on the backdrop', () => {
    const beacon = show();

    // A click that lands on the dialog ITSELF landed outside the panel: the
    // panel is inside the host div and the dialog has no padding of its own.
    // This is the one gesture whose own handler is observable from out here,
    // so it is the one that proves a gesture really routes through the funnel
    // rather than having a path of its own.
    dialog().dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(beacon.counted).toEqual(['impression', 'dismiss']);
  });

  it('counts one dismiss and not two when a close follows a backdrop click', () => {
    const beacon = show();

    dialog().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    dialog().close();

    // The second `close()` is a no-op on a closed dialog, which is what stops
    // one act becoming two counts on a counter nobody can ever recompute.
    expect(beacon.counted).toEqual(['impression', 'dismiss']);
  });

  /**
   * **Leaving without converting is not a Dismissal.** It is not an act at all,
   * and it is already `impressions − conversions − dismissals` (CONTEXT.md) —
   * so nothing is reported for it, and there is no fourth kind that would let a
   * screen report two numbers where one is the arithmetic of the other.
   */
  it('counts nothing at all for a visitor who simply leaves', () => {
    const beacon = show();

    window.dispatchEvent(new Event('pagehide'));

    expect(beacon.counted).toEqual(['impression']);
  });

  /**
   * **And there is exactly one place a Dismissal can come from.**
   *
   * Four gestures with four emit sites would be four chances for one of them to
   * grow its own `kind`, or to stop reporting, without any test above noticing
   * — each of them would still pass on its own path. This is the assertion that
   * makes "the four are one thing" a property of the source rather than of the
   * three that happen to be reachable from jsdom. `WConvert` closing the Optin
   * itself goes through the same `close()` behind a `dismissible` flag, which
   * `tests/js/renderer-mount.test.ts` covers.
   */
  it('has one dismissal emit site in the renderer, and only one', () => {
    // Read from the project root rather than from `import.meta.url`: these
    // run in jsdom, where the module URL is not a file one.
    const source = readFileSync(resolve(process.cwd(), 'resources/renderer/src/mount.ts'), 'utf8');

    expect(source.match(/onDismiss\?\.\(\)/g)).toHaveLength(1);
  });
});

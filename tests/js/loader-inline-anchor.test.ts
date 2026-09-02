import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Beacon, BeaconKind } from '@loader/beacon';
import { createLoader } from '@loader/engine';
import { FREE_MODULES } from '@loader/modules';
import { INLINE_ANCHOR_ATTRIBUTE, templatePresenter } from '@loader/present';
import { start } from '@loader/shell';
import { DOCUMENT_STYLE_ID } from '@renderer/mount';
import type { PayloadEntry } from '@loader/types';

/**
 * **What the page does with the anchors on it** — the other half of the block
 * and the shortcode, and the half neither of them can be tested for.
 *
 * `src/Frontend/InlineAnchor.php` is a string of markup and a PHPUnit test
 * proves the two authoring surfaces agree on it. What that cannot reach is the
 * two cases a merchant produces by accident and nothing warns them about: an
 * anchor left behind by an [[Optin]] that is no longer served, and the same
 * Optin placed twice on one page. Both have to be harmless, and "harmless"
 * here means a specific number — zero [[Impression]]s and one — because an
 * Impression is the denominator of every conversion rate the merchant reads
 * and a counter cannot be recomputed afterwards (ADR 0019).
 *
 * Driven through `start()` with the REAL presenter rather than a recording
 * stand-in, because the questions are about what actually reaches the DOM.
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
    ],
  },
  tokens: { bg: '#fff' },
};

const inlineOptin = (id: string): PayloadEntry => ({
  id,
  display_type: 'inline',
  template: TEMPLATE,
  triggers: [{ type: 'page_load' }],
  conditions: [],
});

/** A beacon that records what it was told about whom, in order. */
function countingBeacon(): Beacon & { counted: [string, BeaconKind][] } {
  const counted: [string, BeaconKind][] = [];

  return {
    counted,
    report: (id, kind) => void counted.push([id, kind]),
    flush: () => undefined,
    stop: () => undefined,
  };
}

/** The anchor exactly as `InlineAnchor::html()` writes it. */
function anchor(id: string): HTMLElement {
  const element = document.createElement('div');

  element.setAttribute(INLINE_ANCHOR_ATTRIBUTE, id);
  document.body.appendChild(element);

  return element;
}

let observed: (() => void)[] = [];

/** An `IntersectionObserver` whose intersection this file decides when to fire. */
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

function run(entries: readonly PayloadEntry[]) {
  const beacon = countingBeacon();

  start({ loader: createLoader(FREE_MODULES), entries, presenter: templatePresenter, beacon });

  return beacon;
}

beforeEach(() => {
  observed = [];
  localStorage.clear();
  observerUnderTestControl();
});

afterEach(() => {
  document.body.innerHTML = '';
  document.getElementById(DOCUMENT_STYLE_ID)?.remove();
  vi.unstubAllGlobals();
});

/**
 * **An anchor whose Optin is absent from the payload renders nothing and
 * records nothing.**
 *
 * This is the ordinary end of an Optin's life rather than an error: it was
 * unpublished, deleted, [[Suspended]], switched to another [[Display Type]],
 * or simply does not target this page — and every one of those leaves the
 * block or shortcode sitting in post content that nobody edited. The page it
 * is on is a page WConvert was asked to leave alone (ADR 0004).
 *
 * The mechanism is that the loader walks the PAYLOAD and looks for an anchor
 * per entry, never the other way round, so an anchor with no entry is never
 * looked at. That is worth pinning rather than assuming: reversing the walk is
 * a plausible-looking change that would make every stale anchor on a site a
 * silent, unreportable nothing OR — worse — something.
 */
describe('an anchor whose Optin is not in the payload', () => {
  it('renders nothing into it and records nothing, on a page with no Optins at all', () => {
    const stale = anchor(OPTIN);

    const beacon = run([]);

    expect(stale.childElementCount).toBe(0);
    expect(beacon.counted).toEqual([]);
  });

  /**
   * **The discriminating case, and the one a stale anchor is actually in.**
   *
   * The page above has no payload, so the loader does nothing whatever it
   * believes about anchors. Here it is running — another Optin matched this
   * page and is being drawn — and the stale anchor has to survive that
   * untouched. A loader that walked the DOM for anchors rather than the
   * payload for entries passes the test above and fails this one.
   */
  it('stays empty while the page\'s real Optins render', () => {
    const stale = anchor('01JQ0000000000000000000009');
    const live = anchor(OPTIN);

    const beacon = run([inlineOptin(OPTIN)]);

    observed.forEach((intersect) => intersect());

    expect(stale.childElementCount).toBe(0);
    expect(live.childElementCount).toBe(1);
    expect(beacon.counted).toEqual([[OPTIN, 'impression']]);
  });
});

/**
 * **Two anchors for one Optin on one page do not produce two Impressions.**
 *
 * One [[Optin]] appearing to one visitor, ONCE (CONTEXT.md, Impression). A
 * merchant who wants the same signup form at the top and the bottom of a long
 * post has done nothing wrong, and the number they read must not double
 * because of it.
 *
 * It holds because the presenter resolves ONE anchor per entry — the first
 * match — and the shell shows an entry once. Two mechanisms, one outcome, and
 * this asserts the outcome: the second anchor stays empty, and exactly one
 * Impression is reported.
 */
describe('two anchors for one Optin on one page', () => {
  it('renders into the first and leaves the second empty', () => {
    const first = anchor(OPTIN);
    const second = anchor(OPTIN);

    run([inlineOptin(OPTIN)]);

    expect(first.childElementCount).toBe(1);
    expect(second.childElementCount).toBe(0);
  });

  it('reports one Impression, not two', () => {
    anchor(OPTIN);
    anchor(OPTIN);

    const beacon = run([inlineOptin(OPTIN)]);

    observed.forEach((intersect) => intersect());

    expect(beacon.counted).toEqual([[OPTIN, 'impression']]);
  });
});

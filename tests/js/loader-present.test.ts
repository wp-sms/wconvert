import { afterEach, describe, expect, it, vi } from 'vitest';
import { INLINE_ANCHOR_ATTRIBUTE, templatePresenter } from '@loader/present';
import { DOCUMENT_STYLE_ID } from '@renderer/mount';
import type { OptinControls, PayloadEntry } from '@loader/types';

/**
 * The presenter: the join between deciding WHETHER to show an Optin and
 * knowing HOW to draw one.
 *
 * Everything upstream of it was already real — the rules are evaluated, the
 * contest is settled, the frequency cap holds across days. This is the part
 * that was a stub.
 */

const TEMPLATE = {
  tree: {
    steps: [
      { type: 'stack', children: [{ type: 'heading', text: 'Join the list' }, { type: 'field', name: 'email' }, { type: 'button', label: 'Go', action: 'submit' }] },
      { type: 'stack', children: [{ type: 'heading', role: 'success_headline', text: 'Check your inbox' }] },
    ],
  },
  tokens: { bg: '#fff' },
};

const entry = (over: Partial<PayloadEntry> = {}): PayloadEntry => ({
  id: '01JQ0000000000000000000001',
  display_type: 'popup',
  template: TEMPLATE,
  ...over,
});

const controls = (): OptinControls & { impressions: number; dismissals: number; conversions: number } => {
  const seen = {
    impressions: 0,
    dismissals: 0,
    conversions: 0,
    impression: () => void (seen.impressions += 1),
    dismiss: () => void (seen.dismissals += 1),
    convert: () => void (seen.conversions += 1),
  };

  return seen;
};

afterEach(() => {
  document.body.innerHTML = '';
  document.getElementById(DOCUMENT_STYLE_ID)?.remove();
});

describe('showing a popup', () => {
  it('renders it and reports the Impression at once', () => {
    const seen = controls();

    templatePresenter.show(entry(), seen);

    // For the three overlays the Impression IS being rendered: they are in the
    // top layer, so being rendered is being on screen (CONTEXT.md).
    expect(seen.impressions).toBe(1);
    expect(document.querySelector('dialog')?.open).toBe(true);
  });

  it('reports a Dismissal when the visitor closes it', () => {
    const seen = controls();

    templatePresenter.show(entry(), seen);
    document.querySelector('dialog')?.close();

    expect(seen.dismissals).toBe(1);
  });
});

describe('an Optin with nothing to draw', () => {
  it('shows nothing and spends no allowance', () => {
    const seen = controls();

    templatePresenter.show(entry({ template: undefined }), seen);

    // A presenter that never reports the Impression has not spent the Optin's
    // allowance, so it shows again on the next page view — the safe direction:
    // an Optin nobody saw has not been seen.
    expect(seen.impressions).toBe(0);
    expect(document.querySelector('dialog')).toBeNull();
  });
});

describe('an inline Optin', () => {
  const anchored = (id: string) => {
    const anchor = document.createElement('div');

    anchor.setAttribute(INLINE_ANCHOR_ATTRIBUTE, id);
    document.body.appendChild(anchor);

    return anchor;
  };

  it('renders where it was embedded and nowhere else', () => {
    const seen = controls();
    const item = entry({ display_type: 'inline' });
    const anchor = anchored(item.id);

    templatePresenter.show(item, seen);

    expect(anchor.children).toHaveLength(1);
    expect(document.querySelector('dialog')).toBeNull();
  });

  /**
   * `inline` renders where it was embedded and may sit far below the fold, so
   * its Impression is the moment it ENTERS THE VIEWPORT — one name, two
   * moments (CONTEXT.md, Impression).
   */
  it('waits for the viewport before reporting the Impression', () => {
    const observed: Element[] = [];
    const scroll: { fire?: (entries: { isIntersecting: boolean }[]) => void } = {};

    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          scroll.fire = callback;
        }
        observe(element: Element) {
          observed.push(element);
        }
        disconnect() {}
      },
    );

    const seen = controls();
    const item = entry({ display_type: 'inline' });
    const anchor = anchored(item.id);

    templatePresenter.show(item, seen);

    expect(observed).toEqual([anchor]);
    expect(seen.impressions).toBe(0);

    scroll.fire?.([{ isIntersecting: true }]);

    expect(seen.impressions).toBe(1);

    vi.unstubAllGlobals();
  });

  it('reports nothing at all when the page carries no anchor for it', () => {
    const seen = controls();

    templatePresenter.show(entry({ display_type: 'inline' }), seen);

    expect(seen.impressions).toBe(0);
    expect(document.body.children).toHaveLength(0);
  });
});

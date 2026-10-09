import { treeFixture } from './support/journey';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_STYLE_ID, mount } from '@renderer/mount';
import { DOCUMENT_CSS, SHADOW_CSS } from '@renderer/css';
import type { Template } from '@renderer/types';

/**
 * The containers.
 *
 * Two of them, because they solve two different problems and neither solves
 * the other's: a modal `<dialog>` for the top layer, and a closed shadow root
 * for the CSS fight (ADR 0009). `inline` gets the second only — it renders
 * where it was embedded, so it is outside the top-layer decision entirely
 * (ADR 0011).
 */

const TEMPLATE: Template = {
  tree: treeFixture({ steps: [{ type: 'stack', children: [{ type: 'heading', text: 'Join the list' }] }] }),
  tokens: { bg: '#fff', backdrop: 'rgba(0,0,0,.6)' },
};

afterEach(() => {
  document.body.innerHTML = '';
  document.getElementById(DOCUMENT_STYLE_ID)?.remove();
});

const dialog = () => document.querySelector('dialog');

describe('a popup', () => {
  it('is a modal dialog promoted with showModal(), not show()', () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    const show = vi.spyOn(HTMLDialogElement.prototype, 'show');

    mount({ displayType: 'popup', template: TEMPLATE }).show();

    expect(showModal).toHaveBeenCalledOnce();
    expect(show).not.toHaveBeenCalled();

    showModal.mockRestore();
    show.mockRestore();
  });

  /**
   * `<dialog>` cannot host a shadow root, hence the inner div — and the dialog
   * is armoured with inline `!important` styles, which is the only protection
   * available to an element with no shadow root of its own (ADR 0009).
   */
  it('hosts a CLOSED shadow root on an inner div, not on the dialog', () => {
    mount({ displayType: 'popup', template: TEMPLATE }).show();

    const host = dialog()?.firstElementChild as HTMLElement;

    expect(host.tagName).toBe('DIV');
    // Closed, so nothing outside can reach in — which is the point: a theme
    // script sweeping document.querySelectorAll('input') cannot rebind the
    // capture field.
    expect(host.shadowRoot).toBeNull();
    expect(dialog()?.shadowRoot).toBeNull();
  });

  it('armours the dialog with inline !important declarations', () => {
    mount({ displayType: 'popup', template: TEMPLATE }).show();

    const style = dialog()?.getAttribute('style') ?? '';

    expect(style).toContain('!important');
    expect(dialog()?.style.getPropertyPriority('position')).toBe('important');
  });

  it.each([undefined, '80%', '32rem', 'calc(100vw - 6rem)', 'clamp(18rem, 80vw, 40rem)'])(
    'resolves the popup width once on the dialog, including %s',
    (width) => {
      const template: Template = {
        ...TEMPLATE,
        tokens: { ...TEMPLATE.tokens, ...(width === undefined ? {} : { width }) },
      };
      const mounted = mount({ displayType: 'popup', template });

      mounted.show();

      expect(dialog()?.style.getPropertyValue('--wc-width')).toBe(width ?? '');
      expect(dialog()?.style.getPropertyValue('inline-size')).toBe('var(--wc-width,28rem)');
      expect(dialog()?.style.getPropertyPriority('inline-size')).toBe('important');
      expect(dialog()?.style.getPropertyValue('max-inline-size')).toBe('calc(100% - 2rem)');
      expect(mounted.root?.style.getPropertyValue('--wc-width')).toBe('100%');
      mounted.close();
    },
  );

  it('keeps every popup screen full-width without changing authored or narrow scopes', () => {
    const template: Template = {
      tree: treeFixture({
        steps: ['Leave your details', 'Details received'].map((text) => ({
          type: 'stack',
          tokens: { width: '70%', pad: '2rem' },
          narrow: { width: '90%', pad: '1rem' },
          children: [{ type: 'heading', text }],
        })),
      }),
      tokens: Object.freeze({ width: '80%', bg: '#fff' }),
    };
    const authored = JSON.stringify(template);
    const mounted = mount({ displayType: 'popup', template });

    mounted.show();

    for (const [step, text] of ['Leave your details', 'Details received'].entries()) {
      if (step > 0) mounted.showStep(step);

      const root = mounted.root;
      const scope = root?.querySelector<HTMLElement>('.wc-stack');

      expect(root?.textContent).toContain(text);
      expect(root?.style.getPropertyValue('--wc-width')).toBe('100%');
      expect(root?.style.getPropertyValue('--wc-bg')).toBe('#fff');
      expect(scope?.style.getPropertyValue('--wc-width')).toBe('70%');
      expect(scope?.style.getPropertyValue('--wc-n-width')).toBe('90%');
      expect(scope?.style.getPropertyValue('--wc-n-pad')).toBe('1rem');
      expect(dialog()?.style.getPropertyValue('--wc-width')).toBe('80%');
    }

    expect(JSON.stringify(template)).toBe(authored);
    mounted.close();
  });

  it('reports a dismissal when the visitor closes it, and not when we do', () => {
    const onDismiss = vi.fn();
    const mounted = mount({ displayType: 'popup', template: TEMPLATE, onDismiss });

    mounted.show();
    dialog()?.close();

    expect(onDismiss).toHaveBeenCalledOnce();

    mounted.close();

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  /**
   * `<dialog>` and `showModal()` are Baseline since March 2022, so this is the
   * long tail rather than a supported configuration. It still must not throw:
   * the presenter runs inside scroll handlers and timers, where a throw is
   * uncatchable from anywhere useful and takes every Optin on the page with it
   * (ADR 0004).
   */
  it('mounts nothing on a browser with no showModal, rather than throwing', () => {
    const showModal = HTMLDialogElement.prototype.showModal;

    // @ts-expect-error — modelling a browser that never had it.
    delete HTMLDialogElement.prototype.showModal;

    try {
      const mounted = mount({ displayType: 'popup', template: TEMPLATE });

      expect(mounted.mounted).toBe(false);
      expect(() => mounted.show()).not.toThrow();
      expect(dialog()).toBeNull();
    } finally {
      HTMLDialogElement.prototype.showModal = showModal;
    }
  });
});

describe('an inline Optin', () => {
  it('lets every inline screen grow with the page instead of inheriting the popup height cap', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const template = { ...TEMPLATE, tree: treeFixture({ steps: [
      { type: 'text' as const, text: 'A long embedded story' },
      { type: 'text' as const, text: 'A follow-up story' },
    ] }) };
    const mounted = mount({ displayType: 'inline', template, anchor });
    mounted.show();
    expect(mounted.root?.style.maxBlockSize).toBe('none');
    mounted.showStep(1);
    expect(mounted.root?.style.maxBlockSize).toBe('none');
    const popup = mount({ displayType: 'popup', template });
    expect(popup.root?.style.maxBlockSize).toBe('');
    mounted.close();
    popup.close();
  });

  it('keeps its authored percentage width relative to its placement', () => {
    const anchor = document.createElement('div');
    const template: Template = { ...TEMPLATE, tokens: { ...TEMPLATE.tokens, width: '80%' } };
    const mounted = mount({ displayType: 'inline', template, anchor });

    document.body.appendChild(anchor);
    mounted.show();

    expect(mounted.root?.style.getPropertyValue('--wc-width')).toBe('80%');
    expect(dialog()).toBeNull();
    mounted.close();
  });

  it('renders in flow inside its anchor, with no dialog and no backdrop', () => {
    const anchor = document.createElement('div');

    document.body.appendChild(anchor);
    mount({ displayType: 'inline', template: TEMPLATE, anchor }).show();

    expect(dialog()).toBeNull();
    expect(anchor.firstElementChild?.shadowRoot).toBeNull();
    expect(anchor.children).toHaveLength(1);
  });

  it('mounts nothing when there is nowhere on the page to mount it', () => {
    const mounted = mount({ displayType: 'inline', template: TEMPLATE, anchor: null });

    mounted.show();

    expect(document.body.children).toHaveLength(0);
    expect(mounted.mounted).toBe(false);
  });
});

/**
 * A face declared inside a shadow root is silently ignored and the element
 * falls back — identical computed `font-family`, different glyphs — and
 * `document.fonts.check()` cannot detect it. So the isolation is never total,
 * and exactly one document-level `<style>` is part of the design (ADR 0009).
 */
describe('the document-level style', () => {
  it('is inserted exactly once however many Optins mount', () => {
    mount({ displayType: 'popup', template: TEMPLATE }).show();
    mount({ displayType: 'popup', template: TEMPLATE }).show();
    mount({ displayType: 'inline', template: TEMPLATE, anchor: document.body }).show();

    expect(document.querySelectorAll(`#${DOCUMENT_STYLE_ID}`)).toHaveLength(1);
  });

  it('holds the backdrop rule and every @font-face; the shadow stylesheet holds neither', () => {
    expect(DOCUMENT_CSS).toContain('::backdrop');
    expect(SHADOW_CSS).not.toContain('::backdrop');

    // The guard, live from the first commit: the day a face is added to the
    // shadow stylesheet it fails here rather than in a browser, silently, in
    // the wrong glyphs.
    expect(SHADOW_CSS).not.toContain('@font-face');
  });
});

/**
 * The two visitor acts the container owns beside dismissal.
 *
 * They live here rather than in the presenter because a CLOSED shadow root is
 * exactly as closed to a test as it is to a theme script — the handle the
 * container hands back is the only way in, and it is the same handle capture
 * will bind to.
 */
/**
 * =============================================================================
 * THE COUNTDOWN, WHICH IS THE ONE THING IN THIS RENDERER THAT IS NOT PURE.
 * =============================================================================
 * `render()` draws a countdown's SHAPE and no time at all — it asks nothing of
 * the world it will be attached to, including what time it is — so the tick
 * lives here, in the shell every container shares. That is what keeps the
 * renderer a function of (tree, tokens) while the display is live.
 *
 * The deadline is the Optin's `ends_at` and nothing else (ADR 0052), so it
 * arrives as a mount option rather than as a node param: a timer that can
 * disagree with the schedule it counts to is the zombie countdown, and it is
 * not expressible.
 */
describe('a countdown', () => {
  const NOW = Date.UTC(2026, 10, 27, 9, 0, 0);
  const WITH_A_CLOCK: Template = {
    tree: treeFixture({
      steps: [
        { type: 'stack', children: [{ type: 'countdown' }, { type: 'button', label: 'Go', action: 'link' }] },
      ],
    }),
    tokens: {},
  };

  const shown = (endsAt?: number) => {
    const anchor = document.createElement('div');

    anchor.setAttribute('data-wconvert-optin', 'x');
    document.body.appendChild(anchor);

    // `inline` mounts into an anchor whose shadow root is closed exactly as the
    // popup's is; the querySelector above therefore reaches nothing, so the
    // handle is the way in — the same argument every other test here makes.
    const mounted = mount({ displayType: 'inline', template: WITH_A_CLOCK, anchor, endsAt });

    mounted.show();

    return mounted;
  };

  const said = (mounted: { root: HTMLElement | null }) =>
    mounted.root?.querySelector('.wc-count')?.textContent;

  it('shows the time left the frame it appears, without waiting a second', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    try {
      // Two hours, fourteen minutes and five seconds out.
      expect(said(shown(NOW + (2 * 3600 + 14 * 60 + 5) * 1000))).toBe('02:14:05');
    } finally {
      vi.useRealTimers();
    }
  });

  it('says the days only where there are days to say', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    try {
      expect(said(shown(NOW + (3 * 86400 + 60) * 1000))).toBe('3d 00:01:00');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ticks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    try {
      const mounted = shown(NOW + 90 * 1000);

      expect(said(mounted)).toBe('00:01:30');
      vi.advanceTimersByTime(31_000);
      expect(said(mounted)).toBe('00:00:59');
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * A window that has shut takes the Optin off the page entirely (ADR 0050), so
   * a negative number is only reachable on a page cached WHILE the window was
   * open — where the honest reading is that the offer is over.
   */
  it('floors at zero rather than counting up from the other side', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    try {
      expect(said(shown(NOW - 60_000))).toBe('00:00:00');
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * **An Optin with no end draws the shape and no time.** Inventing a deadline
   * would be the manufactured urgency the whole decision refuses, and
   * `builder/structure/problems.ts` is where the merchant is told, on the tab
   * that fixes it.
   */
  it('draws nothing and starts no timer for an Optin with no end', () => {
    const interval = vi.spyOn(globalThis, 'setInterval');

    try {
      expect(said(shown())).toBe('');
      expect(interval).not.toHaveBeenCalled();
    } finally {
      interval.mockRestore();
    }
  });

  /**
   * ==========================================================================
   * THE LEAK THIS WAS ALWAYS GOING TO BE, IF THE TICK HAD NO END.
   * ==========================================================================
   * The builder rebuilds its preview on EVERY KEYSTROKE and the gallery mounts
   * one of these per card. A naive interval would leak one per letter and forty
   * per gallery — which is why the tick lives in the shell, where every
   * container's `close()` already reaches it.
   */
  it('stops when the mount does', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    try {
      const mounted = shown(NOW + 90 * 1000);

      mounted.close();
      vi.advanceTimersByTime(10_000);

      // The element is gone with the mount, so what is being asserted is that
      // advancing the clock threw nothing at a detached tree — a timer still
      // running would be painting into it.
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the visitor acting on a mounted Optin', () => {
  it('cannot navigate the page away by submitting the form', () => {
    const submitting = {
      tree: treeFixture({ steps: [{ type: 'stack', children: [{ type: 'field', name: 'email' }, { type: 'button', label: 'Go', action: 'submit' }] }] }),
      tokens: {},
    } as Template;

    const mounted = mount({ displayType: 'popup', template: submitting });

    mounted.show();

    const submit = new Event('submit', { bubbles: true, cancelable: true });

    mounted.root?.dispatchEvent(submit);

    expect(submit.defaultPrevented).toBe(true);
  });

  /**
   * A click-metered Optin's converting act is the CTA itself: the click
   * navigates the visitor away, which is why its template has one step and no
   * success state left to render (ADR 0025).
   */
  it('converts a click-metered Optin by clicking its CTA', () => {
    const onConvert = vi.fn();
    const clicking = {
      tree: treeFixture({ steps: [{ type: 'stack', children: [{ type: 'button', label: 'Back to your cart', action: 'link', href: '/cart' }] }] }),
      tokens: {},
    } as Template;

    const mounted = mount({ displayType: 'popup', template: clicking, onConvert });

    mounted.show();
    (mounted.root?.querySelector('a') as HTMLAnchorElement).click();

    expect(onConvert).toHaveBeenCalledOnce();
  });

  it('converts newly rendered product links without counting unrelated or non-element targets', () => {
    const onConvert = vi.fn();
    const mounted = mount({ displayType: 'popup', template: TEMPLATE, onConvert });
    mounted.show();
    const link = document.createElement('a');
    link.dataset.convert = '';
    const label = document.createElement('strong');
    label.textContent = 'View product';
    link.append(label);
    mounted.root!.append(link);
    mounted.root!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    label.firstChild!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onConvert).not.toHaveBeenCalled();
    label.click();
    expect(onConvert).toHaveBeenCalledOnce();
  });

  it('swaps to the terminal step in place', () => {
    const twoStep = {
      tree: treeFixture({
        steps: [
          { type: 'stack', children: [{ type: 'heading', text: 'Join the list' }] },
          { type: 'stack', children: [{ type: 'heading', role: 'success_headline', text: 'Check your inbox' }] },
        ],
      }),
      tokens: {},
    } as Template;

    const mounted = mount({ displayType: 'popup', template: twoStep });

    mounted.show();
    mounted.showStep(1);

    expect(mounted.root?.textContent).toContain('Check your inbox');
    expect(mounted.root?.textContent).not.toContain('Join the list');
  });
});

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
  tree: { steps: [{ type: 'stack', children: [{ type: 'heading', text: 'Join the list' }] }] },
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
describe('the visitor acting on a mounted Optin', () => {
  it('cannot navigate the page away by submitting the form', () => {
    const submitting = {
      tree: { steps: [{ type: 'stack', children: [{ type: 'field', name: 'email' }, { type: 'button', label: 'Go', action: 'submit' }] }] },
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
      tree: { steps: [{ type: 'stack', children: [{ type: 'button', label: 'Back to your cart', action: 'link', href: '/cart' }] }] },
      tokens: {},
    } as Template;

    const mounted = mount({ displayType: 'popup', template: clicking, onConvert });

    mounted.show();
    (mounted.root?.querySelector('a') as HTMLAnchorElement).click();

    expect(onConvert).toHaveBeenCalledOnce();
  });

  it('swaps to the terminal step in place', () => {
    const twoStep = {
      tree: {
        steps: [
          { type: 'stack', children: [{ type: 'heading', text: 'Join the list' }] },
          { type: 'stack', children: [{ type: 'heading', role: 'success_headline', text: 'Check your inbox' }] },
        ],
      },
      tokens: {},
    } as Template;

    const mounted = mount({ displayType: 'popup', template: twoStep });

    mounted.show();
    mounted.showStep(1);

    expect(mounted.root?.textContent).toContain('Check your inbox');
    expect(mounted.root?.textContent).not.toContain('Join the list');
  });
});

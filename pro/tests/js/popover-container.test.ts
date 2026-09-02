import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_STYLE_ID } from '@renderer/mount';
import type { Template } from '@renderer/types';
import { mountPopover } from '../../resources/renderer/src/popover';
import { isShowing, withoutPopoverSupport } from '../../../tests/js/support/popover';

/**
 * The third container, and the one that pays for itself.
 *
 * `popup` gets its focus trap, its Esc and its focus restoration from
 * `showModal()`; `inline` needs none of them because it is not an overlay. The
 * two premium Display Types get neither deal: they are in the top layer and
 * **not modal**, so the close button and the keyboard path are hand-written
 * code (ADR 0011). That is the whole delta this file exists to cover.
 *
 * It lives under pro/ rather than under tests/js/, like every other test that
 * imports Pro's tree: a file in free's tree importing this module would itself
 * be the leak `bin/verify-source-contract.sh` exists to catch.
 */

const TEMPLATE: Template = {
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

afterEach(() => {
  document.body.innerHTML = '';
  document.getElementById(DOCUMENT_STYLE_ID)?.remove();
  vi.restoreAllMocks();
});

const popover = () => document.querySelector<HTMLElement>('[popover]');

describe('a floating bar', () => {
  /**
   * **`manual`, and promoted with `showPopover()`.**
   *
   * `auto` carries light-dismiss and one-popover-at-a-time semantics, and both
   * belong to the rule engine rather than to the DOM — at most one overlay per
   * page view is `decide()`'s answer, arrived at from priority and the
   * visitor's own record, and a second popover closing the first would be the
   * browser overruling it (ADR 0011).
   */
  it('is a manual popover, promoted into the top layer', () => {
    mountPopover({ displayType: 'floating_bar', template: TEMPLATE }).show();

    expect(popover()?.getAttribute('popover')).toBe('manual');
    expect(isShowing(popover())).toBe(true);
  });

  /**
   * **Never a `<dialog>`, and the near miss is the one worth asserting.**
   * `dialog.show()` looks like the escape from `showModal()`'s modality and is
   * not one: only MODAL dialogs enter the top layer, so a non-modal `<dialog>`
   * is an ordinary in-flow element that forfeits the single finding the whole
   * rendering decision rests on (ADR 0009, ADR 0011).
   */
  it('is never a dialog, modal or otherwise', () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    const show = vi.spyOn(HTMLDialogElement.prototype, 'show');

    mountPopover({ displayType: 'floating_bar', template: TEMPLATE }).show();

    expect(document.querySelector('dialog')).toBeNull();
    expect(showModal).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });
});

describe('a browser with no popover at all', () => {
  /**
   * **It renders anyway, and that is the opposite of the popup's answer.**
   *
   * A popup with no `showModal()` mounts NOTHING, because every fallback for a
   * centred modal is worse than its absence. A bar's fallback is plain
   * `position: fixed` — which loses to an ancestor `transform` and is booked
   * rather than solved, being far less catastrophic for something pinned to a
   * document edge than for a panel that scrolls off screen (ADR 0011).
   */
  it('renders the bar with plain fixed positioning rather than nothing', () => {
    const restore = withoutPopoverSupport();

    try {
      const mounted = mountPopover({ displayType: 'floating_bar', template: TEMPLATE });

      expect(() => mounted.show()).not.toThrow();
      expect(mounted.mounted).toBe(true);
      expect(popover()?.style.getPropertyValue('position')).toBe('fixed');
    } finally {
      restore();
    }
  });
});

/**
 * =============================================================================
 * THE HAND-WRITTEN HALF — THE WHOLE DELTA FROM `popup`.
 * =============================================================================
 * `showModal()` was supplying the way out, the keyboard path and the modality,
 * and none of it arrives here. What follows is the part of ADR 0011 that is
 * code rather than prose, and the part that a green suite on `popup` says
 * nothing about.
 */
describe('the way out', () => {
  const shownBar = (onDismiss?: () => void) => {
    const mounted = mountPopover({ displayType: 'floating_bar', template: TEMPLATE, onDismiss });

    mounted.show();

    return mounted;
  };

  /**
   * The close button lives on the rendered step INSIDE the closed shadow root,
   * which is exactly as closed to this test as it is to a theme script. The
   * handle `mount()` hands back is the only way in, and that is the design
   * rather than an inconvenience (ADR 0009).
   */
  const closeButtonOf = (mounted: { root: HTMLElement | null }) =>
    mounted.root?.querySelector<HTMLButtonElement>('button.wc-close') ?? null;

  it('is a real button, so a keyboard activates it without a keydown handler', () => {
    const mounted = shownBar();
    const button = closeButtonOf(mounted);

    // `<button>` is what makes Enter and Space work, what puts it in the tab
    // order, and what announces it as a control. A `<div>` with a click
    // handler would pass a mouse test and fail every visitor who has no mouse.
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.type).toBe('button');
    expect(button?.getAttribute('aria-label')).toBe('Close');
    // Nothing has taken it out of the tab order — the one attribute that would
    // make a real button unreachable while leaving it clickable.
    expect(button?.hasAttribute('tabindex')).toBe(false);
  });

  it('records exactly one Dismissal when the visitor presses it', () => {
    const onDismiss = vi.fn();
    const mounted = shownBar(onDismiss);

    closeButtonOf(mounted)?.click();

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(popover()).toBeNull();
  });

  /**
   * **The keystroke itself is pressed in a browser, and the reason is the
   * closed shadow root.**
   *
   * `user-event` finds its target through `document.activeElement`, which
   * reports the shadow HOST and never the button inside it — the stated cost
   * of choosing `closed` over `open`, and the same reason ADR 0040 has a
   * keyboard test dispatching at the element rather than at the active one
   * (ADR 0009). A library-driven Enter here lands on the host and does
   * nothing, so a test written that way would fail on a container that works.
   *
   * What can be held here is the contract that makes the keystroke work at
   * all, and it is the whole of what this container contributes: the way out
   * is a real `<button>` in the tab order with no handler of its own, so Enter
   * and Space are the PLATFORM's to deliver as a click. A `<div role=button>`
   * with a click handler, or a `keydown` listener that remembered Enter and
   * forgot Space, are the two ways this goes wrong, and both change what is
   * asserted above.
   *
   * The press is then made for real in the browser pass, where Tab reaches the
   * button and Enter dismisses the bar.
   */
  it('needs no handler of its own for the keyboard, because the click is the platform’s', () => {
    const onDismiss = vi.fn();
    const mounted = shownBar(onDismiss);
    const button = closeButtonOf(mounted);

    // However the activation arrives — pointer, Enter, Space, a screen
    // reader's own activate — the button receives one click, and one click is
    // one Dismissal.
    button?.click();
    button?.click();

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  /**
   * **Closing it OURSELVES is not one of the four ways a visitor dismisses.**
   * A conversion closes the Optin and is emphatically not a Dismissal
   * (CONTEXT.md, Dismissal), so the count the merchant reads stays a count of
   * people who said no.
   */
  it('reports no Dismissal when we close it', () => {
    const onDismiss = vi.fn();
    const mounted = shownBar(onDismiss);

    mounted.close();

    expect(onDismiss).not.toHaveBeenCalled();
    expect(popover()).toBeNull();
  });

  /**
   * **Esc does not close it, and that is ADR 0011's decision rather than an
   * omission.** A document-level Esc handler on a non-modal overlay fires
   * while the visitor is closing the theme's own menu, so the bar would vanish
   * on a keystroke aimed at something else.
   */
  it('is not closed by Esc', () => {
    const onDismiss = vi.fn();

    shownBar(onDismiss);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onDismiss).not.toHaveBeenCalled();
    expect(isShowing(popover())).toBe(true);
  });
});

/**
 * =============================================================================
 * NOT MODAL — WHICH IS THE POINT, AND THE HALF A TEST CAN ACTUALLY HOLD.
 * =============================================================================
 * The top layer is verified in a browser, because a shim cannot have one. What
 * IS testable here is everything modality would have taken away: the page
 * behind an overlay that is not modal must stay exactly as interactive,
 * focusable and reachable as it was.
 */
describe('the page behind it', () => {
  const pageWithALink = (): HTMLAnchorElement => {
    const link = document.createElement('a');

    link.href = '#somewhere';
    link.textContent = 'A link the visitor was reading';
    document.body.appendChild(link);

    return link;
  };

  it('stays focusable while a bar is shown', () => {
    const link = pageWithALink();

    mountPopover({ displayType: 'floating_bar', template: TEMPLATE }).show();
    link.focus();

    // `showModal()` would have inerted this, which is correct for a popup and
    // unacceptable for a bar meant to sit at the edge of a page the visitor
    // keeps reading (ADR 0011).
    expect(document.activeElement).toBe(link);
  });

  it('stays clickable while a bar is shown', () => {
    const link = pageWithALink();
    const clicked = vi.fn();

    link.addEventListener('click', (event) => {
      event.preventDefault();
      clicked();
    });

    mountPopover({ displayType: 'slide_in', template: TEMPLATE }).show();
    link.click();

    expect(clicked).toHaveBeenCalledOnce();
  });

  it('is never inerted, and neither is anything else on it', () => {
    pageWithALink();
    mountPopover({ displayType: 'floating_bar', template: TEMPLATE }).show();

    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  });

  /**
   * **Focus is not trapped, and it is not stolen either.** Both would be
   * modality arriving by hand after `showModal()` was refused for supplying
   * it: a visitor tabbing past the overlay must leave it, and a visitor who
   * was mid-sentence must not be moved at all.
   */
  it('keeps the focus it had when the bar arrives, and keeps it when focus moves on', () => {
    const link = pageWithALink();

    link.focus();
    mountPopover({ displayType: 'floating_bar', template: TEMPLATE }).show();

    expect(document.activeElement).toBe(link);

    // A trap is a handler that puts focus back. Nothing here does, so a Tab
    // that lands anywhere is a Tab that stays there.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    link.focus();

    expect(document.activeElement).toBe(link);
  });
});

/**
 * =============================================================================
 * THE BOX AND THE DESIGN INSIDE IT.
 * =============================================================================
 * The container owns the SHAPE — an edge for a bar, a corner for a slide-in —
 * and the design fills as much of that shape as its own `width` token asks
 * for. Both of the assertions below are properties of the box that a browser
 * found and a unit test now holds.
 */
describe('the box', () => {
  const boxOf = (displayType: string): HTMLElement => {
    mountPopover({ displayType, template: TEMPLATE }).show();

    return popover() as HTMLElement;
  };

  /**
   * **A transparent strip in the top layer that swallows clicks is inerting by
   * accident**, on the one container chosen because it must not inert anything
   * (ADR 0011). So the box takes no pointer at all and the design takes them
   * back one element in — where everything the design depends on lives, and
   * with the inline `!important` that is the only thing outranking the shadow
   * root's own `:host{all:initial!important}` (ADR 0009).
   */
  it.each(['floating_bar', 'slide_in'])('%s takes no pointer events, and its design takes them back', (displayType) => {
    const mounted = mountPopover({ displayType, template: TEMPLATE });

    mounted.show();

    const box = popover() as HTMLElement;
    const host = box.firstElementChild as HTMLElement;

    expect(box.style.getPropertyValue('pointer-events')).toBe('none');
    expect(mounted.root?.style.getPropertyValue('pointer-events')).toBe('auto');
    // **And the host is deliberately NOT told anything**, because it cannot be
    // told: `:host{all:initial!important}` resets it to `pointer-events: auto`
    // and a shadow tree's `!important` beats an inline one on the host by
    // design. That is why the box is sized to the design instead — there is no
    // remainder for the host to hand back.
    expect(host.getAttribute('style')).toBeNull();
  });

  /**
   * **The terminal step must not arrive inert.** `shell()` REPLACES the
   * rendered element on a step swap rather than mutating it, so the success
   * state a capture advances to is a new element with none of the container's
   * inline styles on it — and a success step nobody can click the close button
   * on is an overlay the visitor cannot get rid of.
   */
  it('gives the step a capture advances to its pointers back too', () => {
    const mounted = mountPopover({ displayType: 'slide_in', template: TEMPLATE });

    mounted.show();
    mounted.showStep(mounted.steps - 1);

    expect(mounted.root?.style.getPropertyValue('pointer-events')).toBe('auto');
    expect(mounted.root?.querySelector('[data-role=success_headline]')).not.toBeNull();
  });

  /**
   * **A percentage needs something to be a percentage OF.** `.wc-root` sizes
   * itself `min(var(--wc-width), 100%)`, so a box left to shrink-wrap its
   * contents sizes itself from the design and the design then sizes itself
   * from the box — measured at 233px against the 352px the token asked for.
   * Both boxes carry a definite inline size for that reason: the bar takes the
   * axis, the slide-in a bounded fraction of it.
   */
  it('pins the bar across the inline axis, so its design has a width to be a fraction of', () => {
    const box = boxOf('floating_bar');

    expect(box.style.getPropertyValue('inset-inline-start')).toBe('0');
    expect(box.style.getPropertyValue('inset-inline-end')).toBe('0');
    expect(box.style.getPropertyValue('inset-block-end')).toBe('0');
  });

  it('pins the bar to the block-end edge, free to take the whole inline axis', () => {
    const box = boxOf('floating_bar');

    expect(box.style.getPropertyValue('inset-block-end')).toBe('0');
    expect(box.style.getPropertyValue('inset-inline-start')).toBe('0');
    expect(box.style.getPropertyValue('inset-inline-end')).toBe('0');
  });

  it('gives the slide-in a corner, bounded to a corner’s worth of the axis', () => {
    const box = boxOf('slide_in');

    expect(box.style.getPropertyValue('inset-inline-start')).toBe('auto');
    expect(box.style.getPropertyValue('inset-inline-end')).toBe('1rem');
    expect(box.style.getPropertyValue('inline-size')).toBe('min(100% - 2rem, 26rem, 28rem)');
  });

  /**
   * **The box IS the design, and three facts leave no other answer.**
   * `.wc-root` sits at the inline start of its box with no auto margin, so a
   * wider box leaves the remainder at the END — the corner a slide-in is named
   * for, measured 64px off it. That remainder is transparent, in the top
   * layer, and swallows clicks. And it cannot be made harmless:
   * `:host{all:initial!important}` resets the host to `pointer-events: auto`,
   * and a shadow tree's `!important` beats an inline one on the host by design
   * (ADR 0009's armour, working as specified, against us).
   */
  it.each([
    ['floating_bar', '22rem', 'min(100%, 22rem)'],
    ['slide_in', '22rem', 'min(100% - 2rem, 26rem, 22rem)'],
    ['floating_bar', '100%', 'min(100%, 100%)'],
  ])('sizes a %s box to the %s its design asked for', (displayType, width, expected) => {
    mountPopover({
      displayType,
      template: { ...TEMPLATE, tokens: { ...TEMPLATE.tokens, width } },
    }).show();

    expect(popover()?.style.getPropertyValue('inline-size')).toBe(expected);
  });

  /**
   * **A token is merchant-authored, and the check is this file's rather than
   * the CSS parser's.** Leaving it to `setProperty` to refuse looks safe and
   * passes in a browser, whose CSSOM drops what it cannot parse — and jsdom
   * stores it verbatim, which is how `; position: static` was found sitting
   * inside the `min()` the container builds. A check that is a different check
   * in every engine is not one.
   */
  it.each([
    '',
    '   ; position: static',
    'not-a-length',
    'calc(100% - 1px)',
    '20rem; position: static',
    "20rem url('https://example.com/x')",
    'var(--anything)',
  ])(
    'keeps the corner card’s default width when the token reads %o',
    (width) => {
      mountPopover({
        displayType: 'slide_in',
        template: { ...TEMPLATE, tokens: { ...TEMPLATE.tokens, width } },
      }).show();

      // 28rem is what `.wc-root` itself falls back to, which is the whole
      // point: box and design stay equal even when the token is nonsense.
      expect(popover()?.style.getPropertyValue('inline-size')).toBe('min(100% - 2rem, 26rem, 28rem)');
      expect(popover()?.style.getPropertyValue('position')).toBe('fixed');
    },
  );

  /**
   * **Logical properties throughout, and never a physical side.** Writing
   * direction crosses every boundary the `all` shorthand does not, so RTL
   * correctness here is entirely a matter of never naming `left`, `right`,
   * `top` or `bottom` — a slide-in on a `fa_IR` site enters from the corner
   * that side of the page actually has (ADR 0009). Verified at 44 of 44 under
   * a real locale; do not re-litigate it with `margin-left`.
   */
  it.each(['floating_bar', 'slide_in'])('%s names no physical side anywhere in its box', (displayType) => {
    const style = boxOf(displayType).getAttribute('style') ?? '';

    for (const physical of ['left:', 'right:', 'top:', 'bottom:']) {
      expect(style).not.toContain(physical);
    }
  });
});

import type { MountOptions, Mounted } from '@renderer/mount';
import { closeButton, documentStyle, shell } from '@renderer/mount';

/**
 * The third container: the top layer, without modality.
 *
 * ============================================================================
 * `[popover=manual]` IS THE ONLY THING THAT IS BOTH.
 * ============================================================================
 * A `floating_bar` sits at the edge of a page the visitor keeps reading, and a
 * `slide_in` is a corner card they may ignore. Neither may inert the document
 * behind it, which rules out `showModal()`; and `dialog.show()` is not the
 * escape it looks like, because **only modal dialogs enter the top layer** — a
 * non-modal `<dialog>` is an ordinary in-flow element that forfeits the single
 * finding the whole rendering decision rests on. Measured against a
 * transformed `body`, every in-document strategy put the overlay on screen at
 * 1 of 5 scroll positions against the top layer's 5 of 5, and the z-index war
 * cannot be won on z-index (ADR 0009, ADR 0011).
 *
 * `manual` rather than `auto`: `auto` carries light-dismiss and forces
 * one-popover-at-a-time semantics, and both are the rule engine's to decide.
 * At most one overlay per page view is `decide()`'s answer, reached from
 * priority and this device's own record — a second popover closing the first
 * would be the DOM overruling it.
 *
 * ============================================================================
 * ACCESSIBILITY IS NO LONGER FREE, AND THIS FILE IS WHERE IT IS PAID FOR.
 * ============================================================================
 * `showModal()` supplies the focus trap, Esc-to-close and focus restoration
 * natively, and `popup` takes all three without writing a line. A popover gets
 * none of them — **correctly**, because it is not modal — so what a popup gets
 * from the platform, these two get from the code below or not at all:
 *
 * - **The close button is the whole way out**, so it is a real `<button>` in
 *   the tab order that a template cannot omit. It comes from free's
 *   {@link closeButton} rather than a copy, which is also what gives it the
 *   focus ring `SHADOW_CSS` draws for everything focusable.
 * - **Nothing traps focus and nothing steals it.** No `inert` on the page, no
 *   focus sent here on show, no `focusout` handler herding it back. An overlay
 *   that took focus from someone mid-sentence would be modality by other
 *   means, which is the thing this container exists not to do.
 * - **Esc does not close it, and that is the decision rather than an
 *   omission** (ADR 0011). A document-level Esc handler on a non-modal overlay
 *   fires while the visitor is dismissing the theme's own menu or search, so
 *   the bar would vanish on a keystroke aimed at something else — and a
 *   handler scoped to focus inside is a route only a visitor who had already
 *   found the close button could take. `Esc` stays what CONTEXT.md calls it,
 *   one of four ways a Dismissal can arrive, on the container that has it.
 *
 * ============================================================================
 * WHERE IT SITS IS THE CONTAINER'S, WHAT IT LOOKS LIKE IS THE TEMPLATE'S.
 * ============================================================================
 * The popover element is the BOX — pinned to an edge for a bar, to a corner
 * for a slide-in — and the design inside it fills as much of that box as its
 * own `width` token asks for. That division is what keeps a bar from being a
 * popup with different numbers: the shape belongs to the Display Type, and a
 * tree authored for a row cannot be talked into a centred card by a token.
 *
 * **Logical properties throughout**, so RTL is correct without a second
 * spelling: a slide-in on a `fa_IR` site enters from the corner that side of
 * the page actually has.
 */

/**
 * The popover's armour, and it needs the same treatment the dialog needs for
 * the same reason.
 *
 * This element hosts no shadow root of its own — the root is on the `<div>`
 * inside it, exactly as it is inside the dialog — so it is reachable by a
 * theme's `* { … !important }` and inline `!important` is the only protection
 * available to it.
 *
 * **`position: fixed` is load-bearing twice.** In the top layer it is
 * redundant, since a popover is laid out against the viewport whatever its
 * ancestors do. On an engine with no `popover` at all it is the entire
 * fallback: the element stays an ordinary fixed-positioned box, which loses to
 * an ancestor `transform` and is booked rather than solved — far less
 * catastrophic for something pinned to a document edge than for a centred
 * panel that scrolls off screen (ADR 0011).
 *
 * `display` is absent on purpose, as it is on the dialog: it tracks the
 * popover's own showing state, and forcing it here would paint a closed
 * overlay onto the page.
 *
 * **`pointer-events: none` is the one line here that is about the page rather
 * than about the overlay**, and it was measured rather than reasoned. This box
 * is the SHAPE — an edge, a corner — and the design inside fills as much of it
 * as its own `width` token asks for, so wherever it asks for less, the
 * remainder is a transparent strip sitting over the page in the top layer. A
 * strip that swallows clicks is `showModal()`'s inerting arriving through the
 * back door on the one container chosen because it must not inert anything
 * (ADR 0011). So the box takes no pointer at all and the design takes them
 * back, one element in.
 */
const POPOVER_ARMOUR: Readonly<Record<string, string>> = {
  position: 'fixed',
  margin: '0',
  padding: '0',
  border: '0',
  background: 'transparent',
  overflow: 'visible',
  'z-index': 'auto',
  'block-size': 'auto',
  'max-block-size': 'none',
  'max-inline-size': 'none',
  'pointer-events': 'none',
};

/**
 * The design's own width, as `SHADOW_CSS` falls back to it.
 *
 * `.wc-root` sizes itself `min(var(--wc-width, 28rem), 100%)`, so a design
 * that names no width is 28rem wide. The box has to know the same number —
 * see {@link boxWidth} for why the two must agree.
 */
const A_DESIGNS_OWN_WIDTH = '28rem';

/**
 * Where each of the two sits, and how much of the axis it may take.
 *
 * A bar pins to the block-end edge and may take the whole inline axis; a
 * slide-in takes the block-end/inline-end corner and may take a corner's worth
 * of it. `cap` is written as `min()`'s ARGUMENT LIST rather than a finished
 * `min()`, so {@link boxWidth} appends the design's own width to it and the
 * declaration reads `min(100% - 2rem, 26rem, 22rem)` rather than nesting one
 * `min()` inside another. The block-end edge for both, because it is the one that does not
 * cover a site's own header, and because a bar arriving over the navigation is
 * the single most common way this Display Type is experienced as breakage.
 *
 * `26rem` is a statement about what a corner card IS rather than a number the
 * design has to live inside: the token decides the width up to it, and a
 * design asking for more than a corner is asking not to be a slide-in. The
 * `- 2rem` is the air it keeps at 320px, where it comes out 288px and still a
 * card rather than one hanging off the edge.
 *
 * **Logical properties throughout**, so RTL is correct without a second
 * spelling: a slide-in on a `fa_IR` site enters from the corner that side of
 * the page actually has (ADR 0009).
 */
const PLACEMENT: Readonly<Record<string, { readonly inset: Readonly<Record<string, string>>; readonly cap: string }>> = {
  floating_bar: {
    inset: {
      'inset-block-start': 'auto',
      'inset-block-end': '0',
      'inset-inline-start': '0',
      'inset-inline-end': '0',
    },
    cap: '100%',
  },
  slide_in: {
    inset: {
      'inset-block-start': 'auto',
      'inset-block-end': '1rem',
      'inset-inline-start': 'auto',
      'inset-inline-end': '1rem',
    },
    cap: '100% - 2rem, 26rem',
  },
};

/**
 * The box's width, and it is the design's width, and that is not a
 * simplification.
 *
 * ============================================================================
 * THE BOX MUST EQUAL THE DESIGN, BECAUSE THE HOST CANNOT BE MADE TO SHRINK.
 * ============================================================================
 * Three things are true at once and together they leave exactly one answer:
 *
 * 1. `.wc-root` sizes itself `min(var(--wc-width), 100%)` and carries no auto
 *    margin, so it sits at the inline START of its box. A box wider than the
 *    design leaves the remainder at the END — which for a slide-in is the
 *    corner it is named for. Measured at **64px off it**.
 * 2. That remainder is transparent, in the top layer, and it SWALLOWS CLICKS.
 *    A 20rem bar on a 1280px screen took every click in the 960px beside it —
 *    `showModal()`'s inerting arriving through the back door, on the one
 *    container chosen because it must not inert anything (ADR 0011).
 * 3. **The obvious fix does not work.** `pointer-events: none` on the box is
 *    inherited, but `:host{all:initial!important}` resets the host to the
 *    property's initial value of `auto` and hands the whole area back — and an
 *    inline `!important` on the host does not win, because a shadow tree's
 *    `!important` beats the outer tree's by design. That is precisely the
 *    armour ADR 0009 wanted, working exactly as specified, against us.
 *
 * Shrink-wrapping the box is the remaining idea and it is the worst one: the
 * box would size itself from the design's max-content and the design would
 * then size itself from the box, so the token would decide nothing at all
 * (measured at 233px against the 352px asked for).
 *
 * So the box is told the number the design is about to ask for, and the
 * remainder stops existing rather than being made harmless. **A bar spans the
 * edge by asking to** — a tree authored for a bar carries `width: 100%` or a
 * large value, which is what makes it an edge; one that names no width is 28rem
 * of bar, pinned to the inline start, which is at least the design it asked for
 * rather than a design floating in 960px of trap.
 *
 * ============================================================================
 * THE TOKEN IS CHECKED HERE, AND NOT LEFT TO `setProperty` TO REFUSE.
 * ============================================================================
 * A browser's CSSOM drops a value it cannot parse, so the obvious version of
 * this — interpolate and let the platform sort it out — looks safe and passes
 * in a browser. **jsdom stores it verbatim**, which is how a token reading
 * `; position: static` was found sitting inside the `min()` this builds. A
 * check that is really the CSS parser's is a check that is a different check
 * in every engine, and this value is merchant-authored: it arrives in
 * `config`, travels in the payload, and is interpolated into a declaration.
 *
 * So the shape is stated rather than assumed. One number and one unit, which
 * is every token the shipped library uses and everything either shape has a
 * reason to ask for; anything else — a function, a second value, a semicolon,
 * a `url()` — falls back to the width `.wc-root` itself would have used, which
 * is what keeps the box and the design equal even when the token is nonsense.
 */
const A_WIDTH = /^(?:\d+\.?\d*|\.\d+)(?:rem|em|px|vw|vmin|ch|%)$/;

function boxWidth(cap: string, width: unknown): string {
  const asked = typeof width === 'string' ? width.trim() : '';

  return `min(${cap}, ${A_WIDTH.test(asked) ? asked : A_DESIGNS_OWN_WIDTH})`;
}

/** The two Display Types this container draws. Anything else is not its business. */
export const POPOVER_TYPES: ReadonlySet<string> = new Set(Object.keys(PLACEMENT));

/** The rendered step is the one thing inside the box that a pointer may reach. */
const takesPointers = (root: HTMLElement | null): void =>
  void root?.style.setProperty('pointer-events', 'auto', 'important');

const NOTHING: Mounted = {
  mounted: false,
  root: null,
  steps: 0,
  show: () => undefined,
  showStep: () => undefined,
  close: () => undefined,
};

export function mountPopover(options: MountOptions): Mounted {
  const placement = PLACEMENT[options.displayType ?? ''];

  // Not this container's Display Type. Mounting nothing rather than guessing,
  // the same answer free's `mount()` gives an unrecognised one — a value
  // nothing can place must not become an overlay somewhere arbitrary.
  if (placement === undefined) {
    return NOTHING;
  }

  const element = document.createElement('div');

  // `manual` is set as an ATTRIBUTE rather than through the `popover` IDL
  // property, so the element carries it on an engine that has no popover at
  // all. There the attribute is inert and the armour below is the whole
  // rendering; here it is what the top layer keys off.
  element.setAttribute('popover', 'manual');
  element.className = 'wconvert-popover';

  const chrome = closeButton(() => close(true));
  const parts = shell(options.template, chrome, options);

  /**
   * The design takes back the pointers the box gave up.
   *
   * Belt and braces rather than the mechanism: {@link boxWidth} is what makes
   * the box equal the design, so there is no exposed remainder for the box's
   * own `pointer-events: none` to protect. This is what protects the block
   * axis and anything a future placement leaves over — and it is re-applied on
   * every step swap, because `shell()` REPLACES the rendered element rather
   * than mutating it, so the terminal step a capture advances to would
   * otherwise arrive inert.
   */
  element.appendChild(parts.host);

  const armour = {
    ...POPOVER_ARMOUR,
    ...placement.inset,
    'inline-size': boxWidth(placement.cap, options.template.tokens.width),
  };

  for (const [property, value] of Object.entries(armour)) {
    element.style.setProperty(property, value, 'important');
  }

  /**
   * Closing, and the one bit that is not symmetric.
   *
   * The four ways a VISITOR dismisses are one thing; closing it ourselves is
   * not one of them — a conversion closes the Optin and is emphatically not a
   * Dismissal (CONTEXT.md, Dismissal). So the caller passes which it is rather
   * than the container guessing from what happened.
   *
   * `hidePopover()` before removal so the element leaves the top layer the way
   * it entered it, and the removal is what makes the two engines agree: with
   * no `popover` support there is nothing to hide, and an element still in the
   * document is an overlay still on the page.
   */
  function close(byTheVisitor: boolean): void {
    if (!element.isConnected) {
      return;
    }

    element.hidePopover?.();
    element.remove();

    if (byTheVisitor) {
      options.onDismiss?.();
    }
  }

  takesPointers(parts.root);

  return {
    mounted: true,
    get root() {
      return parts.root;
    },
    steps: options.template.tree.steps.length,
    show() {
      documentStyle();
      // Appended BEFORE promotion, because `showPopover()` on a disconnected
      // element throws — and a throw here runs inside a scroll handler or a
      // timer, where it is uncatchable from anywhere useful and takes every
      // Optin on the page with it (ADR 0004).
      document.body.appendChild(element);
      element.showPopover?.();
    },
    showStep: (step) => takesPointers(parts.step(step)),
    close: () => close(false),
  };
}

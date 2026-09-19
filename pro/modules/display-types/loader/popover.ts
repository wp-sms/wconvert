import type { MountOptions, Mounted } from '@renderer/mount';
import { NOTHING, closeButton, documentStyle, shell } from '@renderer/mount';
import { A_DESIGNS_OWN_WIDTH } from '@renderer/css';

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
 * **`pointer-events: none` is belt and braces and not the mechanism.** What
 * keeps this box from covering the page with a transparent click-trap is
 * the inline-size declaration below making the box equal the design; this line
 * protects the block axis and anything a later placement leaves over. It does NOT
 * survive the shadow boundary on its own — see the sizing argument below
 * for why, which is the whole reason the sizing carries the argument.
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

/*
 * Where each of the two sits, and how much of the axis it may take.
 *
 * Absence keeps the original positions: block-end for a bar and
 * block-end/inline-end for a slide-in. ADR 0095 adds the other block edge and
 * three logical corners without making a physical left/right value part of
 * the contract.
 *
 * `26rem` is a statement about what a corner card IS rather than a number the
 * design has to live inside: the token decides the width up to it, and a
 * design asking for more than a corner is asking not to be a slide-in. The
 * `- 2rem` is the air it keeps at 320px, where it comes out 288px and still a
 * card rather than one hanging off the edge.
 *
 * ============================================================================
 * THE BLOCK-END EDGE IS WHERE THE PHONE PUTS ITS OWN CHROME.
 * ============================================================================
 * `inset-block-end: 0` is the bottom of the VIEWPORT, and on an iPhone that is
 * underneath the home indicator — and underneath Safari's bottom toolbar when
 * it is expanded. So the bar's CTA and its close button can be untappable on
 * the single most common mobile browser, which is the one control the whole
 * Dismissal model rests on.
 *
 * `env(safe-area-inset-bottom)` is the browser's own number for that strip.
 * The `max()` is what makes it correct on every site either way: `env()`
 * resolves to `0` where the theme has not set `viewport-fit=cover`, so a bar
 * on an ordinary site sits exactly where it did, and a slide-in keeps the
 * `1rem` of air it was authored with rather than collapsing to nothing.
 *
 * **It is the container's and not the design's.** A template cannot know which
 * device it is on, and a token for it would be a number a merchant has to
 * guess — the same argument that puts the close button here rather than in the
 * vocabulary.
 *
 * The width declaration keeps the design token as the final `min()` argument,
 * so a corner reads `min(100% - 2rem, 26rem, var(…))` without nesting one
 * `min()` inside another.
 *
 * **Logical properties throughout**, so RTL is correct without a second
 * spelling: a slide-in on a `fa_IR` site enters from the corner that side of
 * the page actually has (ADR 0009).
 */
/**
 * The motion, and the one place in this product where anything moves.
 *
 * ============================================================================
 * A SLIDE-IN THAT DOES NOT SLIDE IS JUST A SMALL POPUP.
 * ============================================================================
 * A grep for `transition|animation|@keyframes` across the visitor-facing
 * renderer returned nothing before this: popups simply existed, abruptly. The
 * POPUP is where that is hardest to fix — its container sets `display` inline
 * with `!important` twice to track open state, and an inline `!important`
 * cannot be beaten by `@starting-style`. This container sets `display`
 * nowhere, deliberately, so the property tracks the popover's own showing
 * state — which is exactly what makes entry motion possible here and nowhere
 * else today.
 *
 * ============================================================================
 * THE BASE STATE IS THE VISIBLE ONE, AND THAT IS THE FALLBACK WORKING.
 * ============================================================================
 * The obvious spelling is `[popover] { opacity: 0 }` with `:popover-open`
 * turning it on. That would make the bar **permanently invisible** on an engine
 * with no popover support, where nothing is ever `:popover-open` — turning a
 * booked, mild degradation ({@link POPOVER_ARMOUR}: the element stays an
 * ordinary fixed box) into a total one.
 *
 * So the rule reads the other way round: visible by default, with
 * `@starting-style` supplying the OFF-SCREEN first frame for the one style
 * change that matters. An engine that has neither draws the design, at once,
 * in the right place. `translate` rather than `transform`, so nothing here can
 * disturb a containing block or collide with a theme's own transform.
 *
 * ============================================================================
 * REDUCED MOTION IS NOT A PREFERENCE THIS PLUGIN GETS TO WEIGH.
 * ============================================================================
 * Free's stylesheet carries the same blanket rule and cannot reach here: it
 * lives inside the shadow root and this element is outside it. So it is
 * repeated rather than shared, which is the honest shape — two stylesheets on
 * two sides of a boundary, each covering what it can reach.
 *
 * `.01ms` rather than `0`, and it is load-bearing: {@link close} holds the
 * element's REMOVAL behind `transitionend`, and a zero-length transition fires
 * no such event. At `0` a visitor who asked for less motion would press Close
 * on an overlay that never finishes closing.
 */
const MOTION_STYLE_ID = 'wconvert-pro-motion';

const MOTION_CSS =
  '.wcv-p{--wcv-is:env(safe-area-inset-left);--wcv-ie:env(safe-area-inset-right);transition:opacity var(--wcv-m,200ms),translate var(--wcv-m,200ms)}' +
  '.wcv-p:dir(rtl){--wcv-is:env(safe-area-inset-right);--wcv-ie:env(safe-area-inset-left)}' +
  '@starting-style{.wcv-p:popover-open{opacity:0;translate:var(--wcv-f,0 1rem)}}' +
  '.wcv-p[data-leaving]{opacity:0;translate:var(--wcv-f,0 1rem)}' +
  '@media (prefers-reduced-motion:reduce){.wcv-p{transition-duration:.01ms}}';

/**
 * The custom property the box holds the design's width in.
 *
 * Its own name rather than `--wc-width`, so that setting it on the box cannot
 * change what the design inside computes: `render()` writes the tokens onto
 * `.wc-root` itself, which wins over anything inherited, and a container that
 * could silently move a design's own token would be a container editing the
 * design.
 */
const WIDTH = '--wcv-w';

/**
 * The two the motion reads, set on the box for the same reason {@link WIDTH}
 * is: the tokens live on `.wc-root`, one element in and inside a closed shadow
 * root, and this element cannot see them.
 *
 * `motion` is the DESIGN's, so a merchant who slowed their button down slowed
 * the entry with it — one decision, not two. `from` is the CONTAINER's, because
 * where an overlay comes from is what the Display Type means.
 */
const MOTION = '--wcv-m';
const FROM = '--wcv-f';

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
 * 3. **Making the remainder harmless does not work.** `pointer-events: none`
 *    on the box is inherited, but `:host{all:initial!important}` resets the
 *    host to the property's initial value of `auto` and hands the whole area
 *    back — and an inline `!important` on the host does not win, because a
 *    shadow tree's `!important` beats the outer tree's by design. That is
 *    precisely the armour ADR 0009 wanted, working exactly as specified,
 *    against us.
 *
 * Shrink-wrapping the box is the remaining idea and it is the worst one: the
 * box would size itself from the design's max-content and the design would
 * then size itself from the box, so the token would decide nothing at all
 * (measured at 233px against the 352px asked for).
 *
 * ============================================================================
 * SO IT ASKS THE SAME QUESTION THE DESIGN ASKS, RATHER THAN GUESSING AT IT.
 * ============================================================================
 * The first version of this read the `width` token and interpolated it behind
 * an allowlist of units. That was wrong twice over, and the second one is the
 * dangerous one: `render()` writes every token into a custom property
 * **unvalidated**, because a custom property takes any token stream — so a
 * design saying `20vh` is 20vh wide, the allowlist rejected it, the box fell
 * back to {@link A_DESIGNS_OWN_WIDTH}, and the transparent click-swallowing
 * remainder this whole comment is about came straight back. Every allowlist of
 * CSS units is a list of the widths a design is quietly not allowed to have.
 *
 * So the token is put in a custom property of the box's own and referenced
 * through `var()`, which is the same shape `.wc-root` uses and therefore
 * cannot disagree with it: any width CSS accepts, the box accepts. A value
 * CSS does NOT accept makes both declarations invalid at computed-value time,
 * so the box and the design fall over together rather than to different
 * numbers — which is the property that matters, because it is the DIFFERENCE
 * between them that traps clicks.
 *
 * It is also why interpolating the token into the declaration is not needed
 * for safety: a custom property's value cannot introduce a second declaration,
 * which is the same door `mount()` already uses for `tokens.backdrop`.
 */
/**
 * How long a close may take before the element is removed regardless.
 *
 * A backstop rather than a duration: the transition is what normally ends it,
 * and this is what stops an overlay hanging around on an engine where
 * `transitionend` never arrives. Comfortably longer than the slowest `motion`
 * the panel offers (400ms), and short enough that nobody watches it.
 */
const LATEST_A_CLOSE_MAY_TAKE = 1000;
const TOP_BAR_OFFSET = '--wconvert-top-bar-offset';
const TOP_BAR_RESERVATION = 'data-wconvert-top-bar-reservation';

/**
 * Put the top bar's occupied viewport strip back into document flow.
 *
 * The visual box stays in the top layer; this deliberately plain first child
 * is only its flow counterpart. The custom property is the integration point
 * for fixed theme chrome, which no generic loader can reposition safely.
 */
function reserveTopBar(element: HTMLElement): () => void {
  const root = document.documentElement;
  const previous = root.style.getPropertyValue(TOP_BAR_OFFSET);
  const previousPriority = root.style.getPropertyPriority(TOP_BAR_OFFSET);
  const spacer = document.createElement('div');
  spacer.setAttribute(TOP_BAR_RESERVATION, '');
  document.body.prepend(spacer);

  const update = (): void => {
    // `bottom` includes the top safe-area offset as well as the rendered bar,
    // which is the whole viewport strip normal page content must stay below.
    const value = `${Math.max(0, element.getBoundingClientRect().bottom)}px`;

    spacer.style.setProperty('block-size', value, 'important');
    root.style.setProperty(TOP_BAR_OFFSET, value, 'important');
  };

  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);

  observer?.observe(element);
  update();

  return (): void => {
    observer?.disconnect();
    spacer.remove();
    if (previous === '') {
      root.style.removeProperty(TOP_BAR_OFFSET);
    } else {
      root.style.setProperty(TOP_BAR_OFFSET, previous, previousPriority);
    }
  };
}

/**
 * The rendered step is the one thing inside the box that a pointer may reach.
 *
 * **Called again on every step swap**, because `shell()` REPLACES the rendered
 * element rather than mutating it — so the terminal step a capture advances to
 * would otherwise arrive inert, and a success state nobody can press the close
 * button on is an overlay the visitor cannot get rid of.
 */
const takesPointers = (root: HTMLElement | null): void =>
  void root?.style.setProperty('pointer-events', 'auto', 'important');

export function mountPopover(options: MountOptions): Mounted {
  const displayType = options.displayType ?? '';

  // Not this container's Display Type. Mounting nothing rather than guessing,
  // the same answer free's `mount()` gives an unrecognised one — a value
  // nothing can place must not become an overlay somewhere arbitrary.
  const bar = displayType === 'floating_bar';

  if (!bar && displayType !== 'slide_in') {
    return NOTHING;
  }

  const corner = /^block_(start|end)_inline_(start|end)$/.exec(options.placement ?? '');
  const top = bar ? options.placement === 'block_start' : corner?.[1] === 'start';
  const start = !bar && corner?.[2] === 'start';
  const reservesPage = bar && top;

  const element = document.createElement('div');

  // `manual` is set as an ATTRIBUTE rather than through the `popover` IDL
  // property, so the element carries it on an engine that has no popover at
  // all. There the attribute is inert and the armour below is the whole
  // rendering; here it is what the top layer keys off.
  element.setAttribute('popover', 'manual');
  element.className = 'wcv-p';

  const chrome = closeButton(() => close(true));
  const parts = shell(options.template, chrome, options);
  let releaseReservation: (() => void) | null = null;

  element.appendChild(parts.host);

  for (const [property, value] of Object.entries(POPOVER_ARMOUR)) {
    element.style.setProperty(property, value, 'important');
  }

  const width = options.template.tokens.width;
  if (width) {
    element.style.setProperty(WIDTH, width);
  }
  element.style.setProperty(
    `inset-block-${top ? 'start' : 'end'}`,
    `max(${bar ? '0px' : '1rem'}, env(safe-area-inset-${top ? 'top' : 'bottom'}))`,
    'important',
  );
  element.style.setProperty(
    bar ? 'inset-inline' : `inset-inline-${start ? 'start' : 'end'}`,
    bar ? '0' : `max(1rem, var(--wcv-i${start ? 's' : 'e'}, 0px))`,
    'important',
  );
  element.style.setProperty(
    'inline-size',
    `min(${bar ? '100%' : '100% - 2rem, 26rem'}, var(${WIDTH}, ${A_DESIGNS_OWN_WIDTH}))`,
    'important',
  );
  element.style.setProperty(FROM, top ? `0 -${bar ? '100%' : '1rem'}` : `0 ${bar ? '100%' : '1rem'}`);

  // Through a custom property rather than interpolated into a declaration, the
  // same door the width custom property above argues for: a token's value is
  // unvalidated, and a custom property cannot introduce a second declaration
  // however it is written. A value CSS rejects makes the transition invalid
  // and the overlay simply arrives without motion, which is the safe direction.
  const motion = options.template.tokens.motion;

  if (motion) {
    element.style.setProperty(MOTION, motion);
  }

  /**
   * Closing, and the two bits that are not symmetric.
   *
   * The four ways a VISITOR dismisses are one thing; closing it ourselves is
   * not one of them — a conversion closes the Optin and is emphatically not a
   * Dismissal (CONTEXT.md, Dismissal). So the caller passes which it is rather
   * than the container guessing from what happened.
   *
   * ==========================================================================
   * THE DISMISSAL IS RECORDED FIRST, AND THE REMOVAL WAITS. IT USED TO BE THE
   * OTHER WAY ROUND.
   * ==========================================================================
   * Exit motion means the element outlives the press by the length of a
   * transition, and reporting the Dismissal at the END of that would put a
   * beacon behind an animation on the one act most likely to be followed by a
   * navigation — a visitor who closes a bar and immediately clicks a link.
   * What the merchant loses is not an animation, it is the frequency cap: an
   * unrecorded Dismissal is an Optin that comes back.
   *
   * So the fact is recorded at the moment the visitor acts, and the DOM catches
   * up. Nothing downstream reads the DOM, so the two cannot disagree.
   *
   * ==========================================================================
   * `transitionend`, WITH A TIMER BEHIND IT, AND `finish()` IS IDEMPOTENT.
   * ==========================================================================
   * `transitionend` does not fire if the property never transitions — an engine
   * with no support for `translate` transitions, a theme that reset it, a
   * `motion` token CSS rejected — and an overlay that never finishes closing is
   * worse than one that closes instantly. The timer is what makes the failure
   * mode "closes late" instead. A generous one, because it is a backstop rather
   * than the mechanism, and the box takes no pointers while it waits.
   *
   * `hidePopover()` before removal so the element leaves the top layer the way
   * it entered it, and the removal is what makes the two engines agree: with
   * no `popover` support there is nothing to hide, and an element still in the
   * document is an overlay still on the page.
   */
  function close(byTheVisitor: boolean): void {
    if (!element.isConnected || element.hasAttribute('data-leaving')) {
      return;
    }

    if (byTheVisitor) {
      options.onDismiss?.();
    }

    releaseReservation?.();
    releaseReservation = null;

    // At once, and not when the element finally leaves: the overlay is over,
    // and a clock still ticking through the fade is a timer running for nobody.
    parts.stop();

    // Nothing inside it is clickable while it fades. The box already carries
    // `pointer-events: none`; this is the design, which was given them back.
    parts.root.style.setProperty('pointer-events', 'none', 'important');
    element.setAttribute('data-leaving', '');

    const finish = (): void => {
      if (!element.isConnected) {
        return;
      }

      element.hidePopover?.();
      element.remove();
    };

    element.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, LATEST_A_CLOSE_MAY_TAKE);
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
      if (document.getElementById(MOTION_STYLE_ID) === null) {
        const style = document.createElement('style');
        style.id = MOTION_STYLE_ID;
        style.textContent = MOTION_CSS;
        document.head.appendChild(style);
      }
      // Appended BEFORE promotion, because `showPopover()` on a disconnected
      // element throws — and a throw here runs inside a scroll handler or a
      // timer, where it is uncatchable from anywhere useful and takes every
      // Optin on the page with it (ADR 0004).
      document.body.appendChild(element);
      try {
        element.showPopover?.();
      } catch {
        // A broken popover implementation must degrade to the same visible
        // fixed box as an engine with no popover support.
        element.removeAttribute('popover');
      }

      if (reservesPage) {
        releaseReservation = reserveTopBar(element);
      }
    },
    showStep: (step) => {
      takesPointers(parts.step(step));
    },
    close: () => close(false),
  };
}

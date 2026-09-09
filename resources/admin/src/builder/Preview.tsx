import { useEffect, useMemo, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { mount } from '@renderer/mount';
import { SLOT_SELECTOR, keyOfElement, type SlotKey } from './slots';
import { policyUrl, withPolicyLink } from './policy';
import type { Template } from '@renderer/types';

/**
 * A design, drawn by **the renderer the loader imports** — and, in the
 * builder, a surface the merchant works ON rather than only looks at.
 *
 * ============================================================================
 * THERE ARE NO STATIC THUMBNAILS, ANYWHERE IN THIS FLOW.
 * ============================================================================
 * The renderer is a pure function of (tree, tokens) and is dependency-free
 * precisely so two bundles can share it, and the admin is the second one
 * (ADR 0010). A gallery card and the builder's preview are therefore the REAL
 * template rather than a picture of one — so there is nothing to produce when
 * a design is added and nothing to let go stale when one is changed, and what
 * the merchant approves is what a visitor sees.
 *
 * It mounts `inline`, because a card is a card: it wants the closed shadow
 * root that wins the CSS fight against wp-admin's own stylesheet, and none of
 * the top layer (ADR 0009, ADR 0011).
 *
 * ============================================================================
 * SELECTION RIDES ON `Mounted.root`, AND THE ROOT STAYS CLOSED (ADR 0040).
 * ============================================================================
 * Clicking a headline in the preview puts the caret in the block that edits
 * it, and focusing that block outlines the headline. **Neither needs the
 * shadow root opened.** `mount()` already hands the caller the rendered step —
 * *"handed to the caller rather than the shadow root itself, so `closed` still
 * means what it says to everything that did not mount this"* — and the
 * renderer already stamps `data-role` for exactly this reader, its own comment
 * naming *"the settings panel, which edits slot content BY Role"* — the editor
 * that inherited that job. This file simply stopped discarding both.
 *
 * ADR 0009's reason for `closed` is a theme script on a VISITOR's page
 * sweeping `querySelectorAll('input')` and rebinding the capture field. Nothing
 * here is on a visitor's page and nothing here is reachable from one; the
 * boundary is as closed to the outside as it ever was.
 *
 * ADR 0010's boundary holds for the same reason it always did: **this file
 * edits nothing.** A click reports which slot was clicked and stops there. What
 * it hands over is a name for a slot and no way to reach one, which is why the
 * preview can stay a closed shadow root and still be an input.
 *
 * Remounted whenever the design or the step changes, which is every keystroke
 * in the inspector. That is affordable because the renderer builds DOM
 * and reads nothing — no network, no layout measurement, no ambient state —
 * and it is what keeps the preview a render of the current tree rather than a
 * patched copy of an older one. Selection is NOT in that dependency list: it
 * paints an outline over a tree that is already on screen.
 *
 * ============================================================================
 * MOUNTING IS THE CALLER'S TO DEFER, AND THE PICKER DEFERS IT (ADR 0043).
 * ============================================================================
 * There is no gate in here, and there is deliberately not one: this file mounts
 * whatever it is handed, the moment it is rendered. A picker holding forty live
 * renders cannot afford that — forty closed shadow roots, forty stylesheets,
 * forty trees, none of which anybody has scrolled to — so
 * {@see TemplateCard} simply does not RENDER a `Preview` for a card that is far
 * from the viewport, which is the same thing said in the one place that knows
 * whether a card is near one.
 *
 * The remount is what makes that affordable rather than a trade, and the
 * paragraph above is the argument: `mount()` reads nothing ambient — no
 * network, no layout measurement — so a card that leaves the viewport and comes
 * back rebuilds from the same tree and draws the same pixels. There is no
 * scroll position to lose and no state to restore, because a card is a picture.
 */

/**
 * The selected slot's outline.
 *
 * Written inline rather than into the renderer's `SHADOW_CSS`, and that is
 * not a shortcut: that stylesheet is the LOADER's, budgeted at ≤2KB gzipped
 * and shipped to every visitor of every site (ADR 0010). A builder affordance
 * has no business in it. `--ring` is the admin's own focus colour and is
 * repeated here because a custom property set on `#wconvert-admin` does reach
 * across the boundary by inheritance, while a rule matching `.wc-heading` never
 * would.
 */
const OUTLINE = '2px solid var(--ring, #0f6e79)';

/**
 * What the NEXT press would take, drawn under the pointer.
 *
 * ============================================================================
 * WITHOUT IT THE DRILL IS A GUESS, AND THAT IS WHAT MADE BOXES FEEL BROKEN.
 * ============================================================================
 * Every addressable element already gets `cursor: pointer`, so the whole
 * preview says "clickable" — and nothing said WHAT. A merchant aiming at a
 * coloured box hit the headline inside it, got *"this block takes its look
 * from Column"* and pressed again in the same place expecting a different
 * answer. Measured on `split-hero` before this: of 168 points across the
 * preview, 21 selected the Column and none at all reached the design.
 *
 * Dashed rather than a second colour, because the difference being drawn is
 * *chosen* against *would be chosen* — a state and its preview, which is the
 * one distinction a merchant with a colour-vision deficiency must still get
 * (ADR 0038). The selected outline always wins where both would land.
 */
const HINT = '2px dashed var(--ring, #0f6e79)';

/**
 * What is already a control, because the preview is the real render.
 *
 * A design's capture field is an `<input>` and its CTA is a `<button>` or an
 * `<a>` — so those slots are focusable before this file touches them, and
 * wrapping them in a `role="button"` would announce an input as a button.
 */
const FOCUSABLE = 'a[href],button,input,select,textarea';

/**
 * The addressable boxes under a point, outermost first, ending with the
 * element actually pressed.
 *
 * `.wc-pane` is the one thing the renderer draws that is not a node and carries
 * no `data-path`, so it drops out by construction rather than by name — the
 * same reason {@see SLOT_SELECTOR} can be one attribute.
 */
function chainAt(root: HTMLElement, target: Element): SlotKey[] {
  const chain: SlotKey[] = [];

  for (let el: Element | null = target; el !== null && el !== root; el = el.parentElement) {
    const key = el instanceof HTMLElement && el.matches(SLOT_SELECTOR) ? keyOfElement(el) : null;

    if (key !== null) {
      chain.unshift(key);
    }
  }

  return chain;
}

/**
 * What a press at this point selects, given what is selected already.
 *
 * ============================================================================
 * THE OUTER BOX FIRST, THEN ONE LEVEL DEEPER PER PRESS.
 * ============================================================================
 * It used to be `closest()` — the innermost box under the pointer, always. That
 * is the right answer to *"what did I point at"* and the wrong one to *"what am
 * I working on"*: on any real design the innermost thing under a pointer is a
 * leaf, a leaf carries no `tokens` bag, and the Style panel's whole subject is
 * boxes. A box was reachable only through the few-pixel gaps BETWEEN the
 * leaves, and the design's own look was not reachable at all — its children
 * cover every pixel of it.
 *
 * So a press walks the chain instead. The first lands on the outermost box
 * inside the design; each further press in the same place goes one level
 * deeper; and the press after the innermost takes the design itself, which is
 * how the outermost scope became pointer-reachable at all. Pressing somewhere
 * else starts again at the top, because the selection is no longer on the way.
 *
 * **The design is last rather than first**, and that is the whole ordering
 * argument: it is one scope out of every press's chain, so leading with it
 * would put a step between the merchant and every box on the screen. It is
 * also the one scope with two other routes to it — the tree's top row and the
 * Style panel's own link — so it is the cheapest one to put at the end.
 */
function nextInChain(chain: readonly SlotKey[], selected: SlotKey | null): SlotKey | null {
  const [design, ...inside] = chain;

  if (design === undefined) {
    return null;
  }

  const cycle = inside.length === 0 ? [design] : [...inside, design];
  const at = selected === null ? -1 : cycle.indexOf(selected);

  return cycle[(at + 1) % cycle.length] ?? null;
}

/**
 * What a countdown counts to on THIS side of the boundary.
 *
 * ============================================================================
 * THE PREVIEW IS AN INPUT, AND A DEAD CLOCK IS A PREVIEW OF NOTHING.
 * ============================================================================
 * On a real page a `countdown` counts to the Optin's `ends_at` and to nothing
 * else (ADR 0052). The builder has no such instant — the schedule lives on the
 * Rules tab and may well be empty while the merchant is choosing a design — and
 * a preview showing `00:00:00` would tell them their design is broken when it
 * is the schedule that is missing. `structure/problems.ts` is where that is
 * said, in a sentence with a way to the tab that fixes it.
 *
 * So the preview counts to a plausible two hours out. It is a PICTURE of the
 * design, exactly as the placeholder headline beside it is a picture of a
 * headline — nobody reads a gallery card's copy as their own words either.
 *
 * **Module scope, so it does not move.** Computed per render it would change
 * identity on every keystroke and remount the preview each time; computed once
 * per page load it ticks down honestly for as long as the screen is open.
 */
const A_PREVIEW_DEADLINE = Date.now() + 2 * 60 * 60 * 1000;

export interface PreviewProps {
  readonly template: Template;
  readonly step?: number;
  /** The block drawn as selected, addressed the way `slots.ts` addresses one. */
  readonly selected?: SlotKey | null;
  /**
   * A block was clicked. Omitted in the gallery, where a card is a picture and
   * every pointer event is turned off in the stylesheet anyway.
   *
   * **Its presence is what asks the renderer for addresses.** A card that
   * cannot be clicked has nothing to name, so it mounts without them and pays
   * no bytes for the attribute — the same line ADR 0040 draws for a visitor's
   * page, drawn once here rather than at every call site.
   */
  readonly onSelect?: (key: SlotKey) => void;
}

export function Preview({ template, step = 0, selected = null, onSelect }: PreviewProps) {
  const anchor = useRef<HTMLDivElement>(null);
  /*
   * State rather than a ref, because the two effects below have to run again
   * when a remount replaces the tree they painted — and a ref does not
   * re-render, so they would keep decorating a node that is no longer on
   * screen.
   */
  const [root, setRoot] = useState<HTMLElement | null>(null);
  /*
   * Read as a boolean so a caller passing a fresh arrow function on every
   * render does not remount the tree — `onSelect` is in the effects that BIND
   * to it, where a rebind is cheap, and out of the one that builds it.
   */
  const selectable = onSelect !== undefined;
  /** What the next press would take, drawn dashed under the pointer. */
  const [hint, setHint] = useState<SlotKey | null>(null);
  /*
   * **The selection, readable from a listener that must not be rebound.**
   *
   * The press handler is delegated precisely so it survives a tree that is
   * rebuilt on every keystroke; putting `selected` in its dependencies would
   * rebind it on every selection instead, which is the cost the delegation was
   * paying to avoid. A ref is the selection at press time and nothing else.
   */
  const selectedAt = useRef<SlotKey | null>(selected);

  useEffect(() => {
    selectedAt.current = selected;
  }, [selected]);

  /*
   * **The site's own privacy policy, filled in at the render** (#77).
   *
   * Here rather than on the way out of the server, because the builder PATCHes
   * the config it was handed straight back — so an href resolved into a config
   * is an href STORED, frozen at publish, which is what ADR 0032 exists to
   * prevent. What this produces is thrown away with the render.
   *
   * Memoised on the tree's identity because that identity is what the mount
   * below remounts on, and an unresolved tree comes back unchanged by identity
   * — so a site with no policy configured pays nothing at all.
   */
  const url = policyUrl();
  const drawn = useMemo(
    (): Template => {
      const tree = withPolicyLink(template.tree, url);

      return tree === template.tree ? template : { ...template, tree };
    },
    [template, url],
  );

  useEffect(() => {
    const mounted = mount({
      displayType: 'inline',
      template: drawn,
      anchor: anchor.current,
      endsAt: A_PREVIEW_DEADLINE,
      paths: selectable,
    });

    mounted.show();

    // Step 0 is what `show()` already rendered, so only a later step needs
    // swapping — and a step past the end is not asked for, because the caller
    // reads the count off the same tree.
    if (step > 0 && step < mounted.steps) {
      mounted.showStep(step);
    }

    // Read AFTER the swap: `root` is a getter over whichever step is currently
    // rendered, because `showStep` replaces the element rather than editing it.
    setRoot(mounted.root);

    return () => {
      mounted.close();
      setRoot(null);
    };
  }, [drawn, step, selectable]);

  useEffect(() => {
    if (root === null || onSelect === undefined) {
      return;
    }

    const bound: (() => void)[] = [];

    const on = (target: HTMLElement, type: string, handle: (event: Event) => void) => {
      target.addEventListener(type, handle);
      bound.push(() => target.removeEventListener(type, handle));
    };

    /*
     * **Whether a focus arrived on the end of a press.**
     *
     * The events are `pointerdown`, then `focus`, then `click` — so a press on
     * the capture field settles the selection on the field before the press
     * itself has been handled, and the drill below would then step one level
     * PAST where it should. A press decides for itself; a Tab still does not.
     */
    let pressing = false;

    on(root, 'pointerdown', () => {
      pressing = true;
    });

    /*
     * ========================================================================
     * ONE DELEGATED LISTENER, BECAUSE EVERY BOX IS SELECTABLE AND BOXES NEST.
     * ========================================================================
     * A handler per element was right while only LEAVES were addressable —
     * nothing was inside anything else, so nothing bubbled into a second
     * handler. Every node carries an address now (`slots.ts`), and a headline
     * inside a coloured box inside a split is three of them: three handlers
     * would fire on one press and the last to run would win, which is the
     * OUTERMOST box.
     *
     * One listener over the whole chain answers on purpose instead — see
     * {@see nextInChain} for which link in it a press takes.
     */
    on(root, 'click', (event) => {
      const target = event.target;
      const chain = target instanceof Element ? chainAt(root, target) : [];
      const key = nextInChain(chain, selectedAt.current);

      pressing = false;

      if (key === null) {
        return;
      }

      /*
       * The converting act is a real `<a>` or a real submit button, because
       * the preview is the real render. Neither may act: a navigation would
       * take the merchant off the builder mid-edit. `shell()` already guards
       * the submit; this is the other half.
       */
      event.preventDefault();
      onSelect(key);
      /*
       * The hint keeps pointing one press ahead rather than going stale under a
       * pointer that has not moved: the merchant sees where a second press
       * lands before making it, which is the whole of what makes a drill
       * legible rather than a thing that happens to them.
       */
      setHint(nextInChain(chain, key));
    });

    on(root, 'pointerover', (event) => {
      const target = event.target;

      setHint(
        target instanceof Element ? nextInChain(chainAt(root, target), selectedAt.current) : null,
      );
    });

    // `pointerleave` does not bubble, which is exactly why it is bound here:
    // the pointer has left the whole render, not merely one box inside it.
    on(root, 'pointerleave', () => setHint(null));

    for (const slot of root.querySelectorAll<HTMLElement>(SLOT_SELECTOR)) {
      const key = keyOfElement(slot);

      if (key === null) {
        continue;
      }

      slot.style.cursor = 'pointer';

      /*
       * ====================================================================
       * IT IS REACHABLE WITHOUT A MOUSE, AND THE THIRD WAY IS THE BLOCK TREE.
       * ====================================================================
       * A click handler on a heading is a pointer-only affordance, and this is
       * an editing surface rather than a picture — so WCAG 2.1 AA's first
       * criterion applies to it directly (ADR 0038).
       *
       * Which way depends on what the slot ALREADY is. The email field and the
       * CTA are real focusable controls, because the preview is the real
       * render: giving those a `tabindex` and `role="button"` of their own
       * would put a button around an input and announce it as one. They are
       * selected by being focused, which is the same signal a row in the block
       * tree sends from its side.
       *
       * A heading or a line of fine print is focusable by nothing, so it is
       * made so — one tab stop, named for what it says, activated by Enter or
       * Space the way its `role` promises.
       *
       * **A BOX is neither, and its route is the tree.** A `panel` announced
       * as a button would be named by every word inside it, and six nested
       * boxes are six tab stops between one headline and the next. The block
       * tree is a treegrid over the same nodes, in the same region, before the
       * preview in the DOM — a keyboard route to every box that already
       * exists and is already asserted at length. So a box is pointer-only
       * here on purpose, and so is anything else this cannot NAME: an `image`
       * has no words, and *"Edit “”"* is worse than no tab stop.
       */
      const focusable = slot.matches(FOCUSABLE) ? slot : slot.querySelector<HTMLElement>(FOCUSABLE);

      if (focusable !== null) {
        on(focusable, 'focus', () => {
          // A press settles its own selection below, one chain link at a time.
          // A Tab has no press to defer to and selects the control it landed on.
          if (!pressing) {
            onSelect(key);
          }
        });

        continue;
      }

      if (slot.querySelector(SLOT_SELECTOR) !== null) {
        continue;
      }

      const said = (slot.textContent ?? '').trim();

      if (said === '') {
        continue;
      }

      slot.tabIndex = 0;
      slot.setAttribute('role', 'button');
      slot.setAttribute(
        'aria-label',
        sprintf(
          /* translators: %s: what a slot in the preview currently says. */
          __('Edit “%s”', 'wconvert'),
          said,
        ),
      );

      on(slot, 'keydown', (event) => {
        const { key: pressed } = event as KeyboardEvent;

        if (pressed === 'Enter' || pressed === ' ') {
          // Space scrolls the page otherwise, which on a sticky preview moves
          // the thing the merchant was aiming at.
          event.preventDefault();
          onSelect(key);
        }
      });
    }

    return () => {
      for (const off of bound) {
        off();
      }

      setHint(null);
    };
  }, [root, onSelect]);

  useEffect(() => {
    if (root === null) {
      return;
    }

    for (const slot of root.querySelectorAll<HTMLElement>(SLOT_SELECTOR)) {
      const key = keyOfElement(slot);
      const chosen = key === selected;
      // The selection wins where both would land, so the hint never draws over
      // the answer to "what am I working on" with "what would you get next".
      const hinted = !chosen && key !== null && key === hint;

      slot.style.outline = chosen ? OUTLINE : hinted ? HINT : '';
      /*
       * **Inside for a box, outside for a leaf.** A `panel` is often
       * full-bleed against the design's own edge, so an outline offset outward
       * is drawn beyond the popup and clipped by `.wc-root`'s `overflow` — the
       * selected box then reads as unselected on the two sides that matter.
       */
      slot.style.outlineOffset =
        chosen || hinted ? (slot.querySelector(SLOT_SELECTOR) === null ? '2px' : '-2px') : '';
    }
  }, [root, selected, hint]);

  return <div ref={anchor} className="wconvert-preview" />;
}

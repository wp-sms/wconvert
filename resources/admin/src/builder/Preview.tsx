import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { mount } from '@renderer/mount';
import { SLOT_SELECTOR, keyOfElement, type SlotKey } from './slots';
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
 * naming *"the settings panel, which edits slot content BY Role"*. This file
 * simply stopped discarding both.
 *
 * ADR 0009's reason for `closed` is a theme script on a VISITOR's page
 * sweeping `querySelectorAll('input')` and rebinding the capture field. Nothing
 * here is on a visitor's page and nothing here is reachable from one; the
 * boundary is as closed to the outside as it ever was.
 *
 * ADR 0010's boundary holds for the same reason it always did: **selection
 * edits nothing.** A click reports which slot was clicked and stops there. The
 * panel is still the only thing that writes, and it still writes only content,
 * visibility and tokens.
 *
 * Remounted whenever the design or the step changes, which is every keystroke
 * in the settings panel. That is affordable because the renderer builds DOM
 * and reads nothing — no network, no layout measurement, no ambient state —
 * and it is what keeps the preview a render of the current tree rather than a
 * patched copy of an older one. Selection is NOT in that dependency list: it
 * paints an outline over a tree that is already on screen.
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
 * What is already a control, because the preview is the real render.
 *
 * A design's capture field is an `<input>` and its CTA is a `<button>` or an
 * `<a>` — so those slots are focusable before this file touches them, and
 * wrapping them in a `role="button"` would announce an input as a button.
 */
const FOCUSABLE = 'a[href],button,input,select,textarea';

export interface PreviewProps {
  readonly template: Template;
  readonly step?: number;
  /** The slot drawn as selected, named the way `slots.ts` names it. */
  readonly selected?: SlotKey | null;
  /**
   * A slot was clicked. Omitted in the gallery, where a card is a picture and
   * every pointer event is turned off in the stylesheet anyway.
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

  useEffect(() => {
    const mounted = mount({ displayType: 'inline', template, anchor: anchor.current });

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
  }, [template, step]);

  useEffect(() => {
    if (root === null || onSelect === undefined) {
      return;
    }

    const bound: (() => void)[] = [];

    const on = (target: HTMLElement, type: string, handle: (event: Event) => void) => {
      target.addEventListener(type, handle);
      bound.push(() => target.removeEventListener(type, handle));
    };

    for (const slot of root.querySelectorAll<HTMLElement>(SLOT_SELECTOR)) {
      const key = keyOfElement(slot);

      if (key === null) {
        continue;
      }

      slot.style.cursor = 'pointer';

      on(slot, 'click', (event) => {
        /*
         * The converting act is a real `<a>` or a real submit button, because
         * the preview is the real render. Neither may act: a navigation would
         * take the merchant off the builder mid-edit. `shell()` already guards
         * the submit; this is the other half.
         */
        event.preventDefault();
        onSelect(key);
      });

      /*
       * ====================================================================
       * IT IS REACHABLE WITHOUT A MOUSE, AND IN TWO DIFFERENT WAYS.
       * ====================================================================
       * A click handler on a heading is a pointer-only affordance, and this is
       * an editing surface rather than a picture — so WCAG 2.1 AA's first
       * criterion applies to it directly (ADR 0038).
       *
       * Which way depends on what the slot ALREADY is. The email field and the
       * CTA are real focusable controls, because the preview is the real
       * render: giving those a `tabindex` and `role="button"` of their own
       * would put a button around an input and announce it as one. They are
       * selected by being focused, which is the same signal the settings panel
       * sends from its side.
       *
       * A heading or a line of fine print is focusable by nothing, so it is
       * made so — one tab stop, named for what it says, activated by Enter or
       * Space the way its `role` promises.
       */
      const focusable = slot.matches(FOCUSABLE) ? slot : slot.querySelector<HTMLElement>(FOCUSABLE);

      if (focusable !== null) {
        on(focusable, 'focus', () => onSelect(key));

        continue;
      }

      slot.tabIndex = 0;
      slot.setAttribute('role', 'button');
      slot.setAttribute(
        'aria-label',
        sprintf(
          /* translators: %s: what a slot in the preview currently says. */
          __('Edit “%s”', 'wconvert'),
          (slot.textContent ?? '').trim(),
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
    };
  }, [root, onSelect]);

  useEffect(() => {
    if (root === null) {
      return;
    }

    for (const slot of root.querySelectorAll<HTMLElement>(SLOT_SELECTOR)) {
      const chosen = keyOfElement(slot) === selected;

      slot.style.outline = chosen ? OUTLINE : '';
      slot.style.outlineOffset = chosen ? '2px' : '';
    }
  }, [root, selected]);

  return <div ref={anchor} className="wconvert-preview" />;
}

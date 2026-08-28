import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ============================================================================
 * THE CHEAP BELT. THE BROWSER PASS IS THE BRACE.
 * ============================================================================
 * **Vitest runs jsdom with `css: false`, so this suite computes no layout at
 * all.** `getBoundingClientRect()` is `0` for everything — passing and failing
 * alike — which means the three faults this file guards were invisible to every
 * test in the project and were each found by measuring a real browser:
 *
 * - every size slider on the Design tab was **0px wide**, because a 100% rule
 *   on the row starved it;
 * - the builder's two columns started **16px apart**;
 * - every gallery card reserved 192px for a 106px render.
 *
 * A source-text assertion cannot see any of that. What it CAN do is notice the
 * one-line edit that would bring it back — an exclusion deleted, a property
 * swapped — which is worth having for a rule whose whole purpose is invisible
 * to the reader who breaks it. `index.css` says the same thing about itself:
 * *"found in a browser, which is the only place this class of fault is visible
 * at all"*.
 *
 * Vitest 4's Browser Mode is what closes the gap properly, in a pull request of
 * its own.
 */
const CSS = readFileSync(resolve(import.meta.dirname, '../../resources/admin/src/index.css'), 'utf8');

describe('the token row', () => {
  /**
   * `.wconvert-token__exact` declares `inline-size: 7rem` at `0,1,0` and lost to
   * the row's `inline-size: 100%` at `0,1,1` — both added in the same commit —
   * so the text box took the whole row with `flex: none` and left the slider
   * nothing. The only way to set a size was to type `1.625rem` into a box.
   */
  it('excludes the slider and the typed box from the rule that took the whole row', () => {
    expect(CSS).toContain(':not(.wconvert-token__exact, .wconvert-token__slider)');
  });

  /** A floor, so no sibling added later can starve it again. */
  it('gives the slider a width it cannot be squeezed below', () => {
    expect(CSS).toMatch(/\.wconvert-token__slider\s*\{[^}]*min-inline-size:\s*[^;0]/);
  });
});

describe('the gallery preview', () => {
  /**
   * `transform: scale()` does not affect layout, so the wrapper reserved a fixed
   * `12rem` and painted 106px — ~86px of dead white under a clipped design on
   * every card. `zoom` sizes the wrapper to what it draws.
   */
  it('scales with a property that affects layout', () => {
    expect(CSS).toMatch(/\.wconvert-gallery \.wconvert-preview\s*\{[^}]*zoom:/);
    expect(CSS).not.toMatch(/\.wconvert-gallery \.wconvert-preview\s*\{[^}]*transform:\s*scale/);
  });

  /**
   * The reciprocal width and the FIXED height were both compensating for it, and
   * both are gone. A `max-block-size` is a cap rather than a reservation and is
   * the one measurement the lane is still allowed to state.
   */
  it('states neither of the numbers that were compensating for the transform', () => {
    const rule = /\.wconvert-gallery \.wconvert-preview\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';

    expect(rule).not.toContain('calc(100% / 0.55)');
    expect(rule).not.toMatch(/(?<!max-)(?<!min-)\bblock-size:/);
    expect(rule).toMatch(/max-block-size:/);
  });
});

describe('the colour picker’s popover', () => {
  /**
   * Radix keeps closed content mounted until its exit animation ends and then
   * unmounts it in a re-render — the one that never arrives while the Design tab
   * is inside a hidden `<Activity>`. With no exit animation the close and the
   * unmount are one commit.
   *
   * **Inside `@layer utilities`**, because for `!important` declarations the
   * cascade runs layers in reverse and an unlayered rule loses to `animate-out`.
   */
  it('does not animate out, and says so from inside the utilities layer', () => {
    const utilities = [...CSS.matchAll(/@layer utilities \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');

    expect(utilities).toMatch(/\.wconvert-picker-pop\[data-state="closed"\][\s\S]*animation:\s*none/);
  });
});

describe('the builder’s two columns', () => {
  /**
   * **Measured before it was written**: the Content tab's card started at 68px
   * and the preview's stage at 52px, while the Design tab's two agreed exactly.
   *
   * Both design tabs are `forceMount`ed so `<Activity>` can keep their state,
   * and Radix leaves a force-mounted panel WITHOUT `hidden` while `Activity`
   * hides the children rather than the wrapper — so the inactive panel was a
   * `display: block` flex item of height zero between the strip and the visible
   * panel. **A zero-height flex item still consumes a gap**, so the column's
   * `gap-4` fired twice: 36 + 16 + 0 + 16 = 68. It only showed on Content
   * because Design is first, where the empty item's gap falls off the end.
   */
  it('does not let a hidden tab panel keep its slot in the column', () => {
    expect(CSS).toMatch(
      /\[data-slot="tabs-content"\]\[data-state="inactive"\]\s*\{[^}]*display:\s*none/,
    );
  });
});

describe('anything that can be pressed', () => {
  /**
   * 38 of the admin's 98 interactive elements had no hand cursor, counted in a
   * browser: every vendored `Button`, all four tab triggers and the inspector's
   * labels. Tailwind v4 gives `button` `cursor: default` in preflight and
   * shadcn's v4 components dropped the `cursor-pointer` that used to be
   * implicit — so it is the whole component vocabulary rather than a few call
   * sites, and it is stated once for the ROLE.
   */
  it('says so under the pointer, and stops saying so when disabled', () => {
    expect(CSS).toMatch(/\[role="menuitem"\][\s\S]{0,600}cursor:\s*pointer/);
    expect(CSS).toMatch(/:disabled[\s\S]{0,200}cursor:\s*default/);
  });
});

describe('the design picker', () => {
  const utilities = [...CSS.matchAll(/@layer utilities \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');

  /**
   * ==========================================================================
   * A CARD NOBODY HAS SCROLLED TO COSTS NO LAYOUT (ADR 0043).
   * ==========================================================================
   * `TemplateCard`'s observer stops an off-screen card being BUILT; this stops
   * one that already exists — the screenful the merchant just scrolled past,
   * still mounted because it is inside the observer's margin — from being laid
   * out and painted. Neither alone reaches where the pair does, and the suite
   * can see neither: Vitest runs jsdom with `css: false` and has no
   * `IntersectionObserver` at all.
   *
   * `contain-intrinsic-size` is not optional beside it. Without it a skipped
   * card measures zero, the document collapses, and scrolling a library of
   * forty moves the scrollbar under the merchant's thumb.
   */
  it('does not lay out a card that is off screen, and still reserves its height', () => {
    const rule = /\.wconvert-gallery__card\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';

    expect(rule).toMatch(/content-visibility:\s*auto/);
    expect(rule).toMatch(/contain-intrinsic-size:/);
  });

  /**
   * **An override of a vendored utility is `!important` AND layered, or it is
   * decoration** (ADR 0042 rule 6). `DialogContent` ships `grid`, this admin
   * compiles utilities as `!important` (ADR 0035), and for important
   * declarations the cascade runs layers in reverse — so an unlayered rule here
   * loses to a single class however specific it is. This file has now been
   * caught by that five times, which is why it is asserted rather than
   * remembered.
   */
  it('turns the vendored dialog into a column from inside the utilities layer', () => {
    expect(utilities).toMatch(
      /\.wconvert-picker\[data-slot="dialog-content"\]\s*\{[^}]*display:\s*flex\s*!important/,
    );
  });

  /**
   * ==========================================================================
   * THE SMALL-HEIGHT RULE SIZED NOTHING FOR AS LONG AS IT HAS EXISTED.
   * ==========================================================================
   * ADR 0039 states it once — *a toolbar control stands at the small height,
   * here, rather than passed as a class at every call site* — and the
   * declarations were not `!important`, so `h-9` beat every one of them. The
   * only toolbar that existed when it was written passes `size="sm"` at the
   * call site, which is precisely what the rule says nobody should have to do,
   * so nothing looked wrong.
   *
   * Measured in a browser on the design picker: chips at 36px and a search box
   * at 40px under a rule saying 32. That is ADR 0042 rule 6 for the sixth time
   * — an override of a utility is `!important` and layered, or it is
   * decoration — so it is asserted here rather than written down again.
   */
  it('states the toolbar height with enough force to beat a vendored size', () => {
    const rule =
      /:is\(\.wconvert-page-actions[^{]*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';

    expect(rule).toMatch(/min-block-size:\s*var\(--control-height-sm\)\s*!important/);
    expect(rule).toMatch(/block-size:\s*auto\s*!important/);
  });

  /**
   * **A text input in a toolbar is a toolbar control.** The picker's search box
   * is the admin's first, and the vendored `Input` is `h-9` — 40px beside 36px
   * chips on one line reads as a control that failed to line up.
   */
  it('sizes a toolbar input the way it sizes a toolbar button', () => {
    expect(CSS).toContain('[data-slot="select-trigger"], [data-slot="input"]');
  });

  /**
   * ==========================================================================
   * A CAP THAT FIRES ON SOMETHING WE SHIP IS SET FROM THE WRONG NUMBER.
   * ==========================================================================
   * `index.css` says exactly that about the first time this happened, at 22rem.
   * It happened again at 30rem the moment the library went from three designs
   * to twelve: measured in a browser, *Name and email* draws 349px into a 264px
   * lane and *Photo offer* draws 276px, so two shipped designs were clipped
   * mid-button on the screen a merchant chooses from.
   *
   * Asserted as a floor rather than a fixed value, because the number that
   * matters is "above the tallest thing we ship" and that grows.
   */
  it('caps the card lane above the tallest design the library ships', () => {
    const rule = /\.wconvert-gallery \.wconvert-preview\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    const cap = /max-block-size:\s*([\d.]+)rem/.exec(rule)?.[1];

    expect(cap).toBeDefined();
    expect(Number(cap)).toBeGreaterThanOrEqual(40);
  });

  /**
   * ==========================================================================
   * WHAT THE ADMIN OWNS IS NOT ALL INSIDE `#wconvert-admin`.
   * ==========================================================================
   * A Radix dialog portals to `document.body`. Every rule anchored on the
   * admin's id therefore stops at the portal boundary, silently — which is how
   * the picker's chips ended up with neither `--control-height-sm` nor the
   * segmented group's *selected* treatment, and how the confirm dialog's
   * buttons have had no hand cursor since ADR 0039 added them.
   *
   * `:is()` rather than `:where()`, and that is the load-bearing half: every
   * one of these rules is an `!important` utility override whose standing
   * depends on beating a single class inside the same layer, and `:where()`
   * contributes zero specificity.
   */
  it('reaches the controls in a portalled dialog, without giving up specificity', () => {
    const roots = ':is(#wconvert-admin, [data-slot="dialog-content"], [data-slot="alert-dialog-content"])';

    // The one-of-N strip's `selected`, the small control height, and the hand
    // cursor — the three a portalled surface needs and the three that were
    // missing from one.
    expect(CSS).toContain(`${roots} .wconvert-segmented > :is([data-slot="button"])`);
    expect(CSS).toContain(`${roots}\n    :is(.wconvert-page-actions, .wconvert-toolbar`);
    expect(CSS).toMatch(new RegExp(`${roots.replace(/[[\]().*+?^$|\\-]/g, '\\$&')} :is\\(\\s*button,`));
    expect(CSS).not.toContain(':where(#wconvert-admin,');
  });
});

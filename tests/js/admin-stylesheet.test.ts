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

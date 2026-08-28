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

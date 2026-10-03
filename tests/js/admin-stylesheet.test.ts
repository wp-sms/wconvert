import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
const CSS = ['index.css', 'builder/editor.css', 'builder/preview-test.css', 'optins/campaigns.css', 'shell/header.css', '../../../pro/modules/inline-placement/admin/placement.css'].map(file => readFileSync(resolve(import.meta.dirname, '../../resources/admin/src', file), 'utf8')).join('\n');

describe('journey choices', () => {
  it('keeps unchecked controls wide enough when WordPress removes native appearance', () => {
    const checkbox = /\.wconvert-journey-settings__check input[^{}]*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(checkbox).toMatch(/min-inline-size:\s*[^;0]/);
    expect(checkbox).toMatch(/flex-shrink:\s*0/);
  });
});

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

/**
 * ============================================================================
 * THE SPECIFICITY TRAP THAT CAUGHT THE RULES PANEL TWICE IN ONE PULL REQUEST.
 * ============================================================================
 * `.wconvert-editor` sets two blanket rules over the elements inside it —
 * `:is(h2, h3, h4)` for size and `:is(p, h2, h3, h4, table, ul, ol)` for
 * margin — and `#wconvert-admin :is(p, li, td, th, label, legend, …)` forces
 * `font-size: inherit` on top of that. All three are (0,2,0) or (1,1,0).
 *
 * A component rule written as a bare class is (0,1,0) and **loses to every one
 * of them while looking exactly like it works.** It caught the four sections
 * on type first — the eyebrow rendered at body size and `<h4>Show it on</h4>`
 * rendered LARGER than the section containing it — and then again on spacing:
 * every `<p>` in a Starting-point card came out at 12px/12px, which made a
 * 90px card 245px tall.
 *
 * Neither was visible to this suite, because Vitest computes no layout. What a
 * source-text assertion CAN see is the shape of the fix, and that is what these
 * hold: the type role is a Tailwind utility (they are `!important`, ADR 0035),
 * and the box rule carries the ID.
 */
describe('the rules panel against the editor’s blanket rules', () => {
  /** Every selector here sets a margin on an element the editor also matches. */
  const BOXED = [
    '.wconvert-rules__label',
    '.wconvert-rules__group + .wconvert-rules__group',
    // Starting-point cards now live in a dialog portal outside the editor.
    '.wconvert-rule__note',
    // The card gap, which was zero: `.wconvert-rule` at (0,1,0) lost to
    // `#wconvert-admin :not(.wconvert-editor) > ul > li` at (1,1,2), and two
    // cards rendered with their borders touching.
    '.wconvert-rules > .wconvert-rule',
    // Both found by walking every element on every screen and comparing what
    // each component DECLARED against what the browser computed. `.wconvert-rules`
    // asked for `margin: 0` and rendered 12px; `.wconvert-locked__list` asked
    // for no marker indent and rendered 21px of one.
    '.wconvert-rules',
    '.wconvert-allowance',
  ];

  it.each(BOXED)('carries the id on %s, or its margin silently loses', (selector) => {
    const rules = [...CSS.matchAll(new RegExp(`([^\n{}]*${selector.replace(/[.+]/g, '\\$&')})\\s*\\{`, 'g'))];

    expect(rules.length, `${selector} is not in the stylesheet`).toBeGreaterThan(0);

    for (const [, matched] of rules) {
      expect(matched.trim(), selector).toMatch(/#wconvert-admin/);
    }
  });

  /**
   * The type roles are stated as utilities in the components, so the
   * stylesheet must not be trying to state them again — a `font-size` on any
   * of these is a declaration that cannot win.
   */
  it('states no font-size for the roles the components carry as utilities', () => {
    for (const selector of [
      '.wconvert-section__eyebrow',
      '.wconvert-section__sentence',
      '.wconvert-rules__label',
      '.wconvert-starter__name',
      '.wconvert-starter__what',
    ]) {
      const block = new RegExp(`\\${selector}\\s*\\{[^}]*\\}`, 'g');

      for (const [matched] of CSS.matchAll(block)) {
        expect(matched, selector).not.toMatch(/font-size:/);
      }
    }
  });

  /**
   * **One class, one component.** `.wconvert-choice` is the segmented control
   * in `Tokens` and `BlockInspector`; the When section wore it for one commit
   * and inherited a border, a hover and a checked state written for something
   * else.
   */
  it('does not let two components share the segmented control’s class', () => {
    expect([...CSS.matchAll(/^\.wconvert-choice\s*\{/gm)].length).toBe(1);
  });
});

/**
 * ============================================================================
 * SIX ROLES, AND THE ONE THAT ESCAPED WAS INVISIBLE FOR A DIFFERENT REASON.
 * ============================================================================
 * ADR 0037 names type as an axis this admin owns and `index.css` states six
 * roles for it. Nothing enforced that, and the drift was measured: five
 * hardcoded `font-size` values here and nine off-scale classes in the admin's
 * own `.tsx`.
 *
 * **One of the five was a live bug that reads as a typo.** `.wconvert-facets`
 * said `font-size: var(--text-sm, 0.8125rem)` — a scale name from Tailwind
 * with the intended 13px as a fallback. The file does `@import 'tailwindcss'
 * important` with no `--text-*: initial` reset, so Tailwind's OWN `--text-sm`
 * is defined at 0.875rem and the fallback never fired: the chips have been
 * rendering 14px against a 13px intention, and nothing about the source said
 * so. The built `public/admin/main.css` emits `--text-sm:.875rem`, which is
 * where it was confirmed.
 *
 * Both assertions below are about that one line, from the two directions it
 * can come back: a size written as a number, and a size written under a name
 * the admin does not own.
 *
 * **The root-cause fix is closed off**, which is why this is a test. Resetting
 * the namespace with `@theme { --text-*: initial }` would stop an off-scale
 * class compiling at all — and would break 27 usages inside `components/ui/`,
 * which ADR 0036 holds are vendored from upstream. The six-role rule cannot be
 * made total without forking every vendored component, so it is guarded at the
 * one boundary where it IS total: the CSS this project writes by hand.
 */
/**
 * ============================================================================
 * 4,470 LINES AND NOT ONE PHYSICAL DIRECTION PROPERTY. IT STAYS THAT WAY.
 * ============================================================================
 * This is the convention the file holds perfectly and nothing asserted — every
 * box here is `inline-start`/`inline-end`, `block-start`/`block-end`, and the
 * only exception is the one `box-shadow` forces, because that property has no
 * logical form and states its `:dir(rtl)` override in place.
 *
 * The companion assertion over `components/ui/*.tsx` lives in
 * `admin-rtl.test.tsx`, which is where the vendored layer's six violations
 * were: that layer is where every RTL bug in this admin has been found, and
 * ADR 0036 holds those files are WConvert's from the moment they land.
 */
describe('the direction convention', () => {
  /** Declarations only — a comment naming `left` is prose about one. */
  const DECLARATIONS = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

  it('states no physical direction property, and no physical value either', () => {
    /*
      Both halves, because `text-align: left` is the second one and reads as
      innocent: the PROPERTY is logical-looking and the VALUE is what pins it.
      `start`/`end` are the logical values, and this file already uses them.
    */
    const physical = [
      /(?:^|[\s;{])(?:margin|padding|border|inset)?-?(?:left|right)\s*:/gi,
      /(?:text-align|float|clear)\s*:\s*(?:left|right)\b/gi,
    ];

    for (const pattern of physical) {
      expect([...DECLARATIONS.matchAll(pattern)].map(([found]) => found.trim())).toEqual([]);
    }
  });

  /**
   * `box-shadow` has no logical form, so the selected-block rail is physical by
   * necessity — and therefore owes the override that makes it right the other
   * way round. This asserts the exception is complete rather than that it does
   * not exist.
   */
  it('mirrors the one shadow that cannot be logical', () => {
    expect(DECLARATIONS).toMatch(/:dir\(rtl\)\s*\{[^}]*box-shadow:\s*inset\s+-2px/);
  });
});

describe('the type scale', () => {
  /**
   * The eight, and the modifiers Tailwind pairs with each.
   *
   * ==========================================================================
   * THIS ARRAY IS WHERE A NEW ROLE IS DECIDED, WHICH IS WHY IT IS A LIST.
   * ==========================================================================
   * ADR 0037 says a role past the original six is *"a decision rather than a
   * class"*. Nothing about this test inspects a VALUE — it asserts only that
   * every size in the stylesheet is spelled as one of the names below — so the
   * cost of a seventh is exactly one line here, and that is deliberate: the
   * line is the decision, taken once, in the open, instead of a `0.6875rem`
   * appearing at a call site and never being seen again.
   *
   * `label` (11) and `meta` (9) were that decision, taken for the Design tab's
   * three panes: a block's kind, a token's name and a check's word are
   * furniture on a work surface rather than copy, and at `micro` the tree ran
   * five block names under their own row menu. They are NOT a floor being
   * lowered — ADR 0038 sets contrast ratios, pointer targets and viewports, and
   * has never set a minimum font size.
   */
  const ROLES = ['meta', 'label', 'micro', 'note', 'body', 'heading', 'title', 'figure', 'display', 'brand', 'item', 'result', 'section', 'metric'];

  /** Declarations only — a comment naming a size is prose about one. */
  const DECLARATIONS = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

  /**
   * `inherit` is the ninth legal value and is not a size: the rule forcing it
   * over wp-admin's `<p>` and `<td>` exists precisely so a role stated as a
   * utility elsewhere is the one that wins.
   *
   * **`!important` is allowed after the value and is not part of it.** A size
   * that has to beat a vendored utility takes the flag — Tailwind's are
   * `!important` and for important declarations the cascade runs layers in
   * reverse, so `text-sm` on `TabsTrigger` cannot be overridden without one
   * (ADR 0042 rule 6). What this test is about is which ROLE was spelled, and
   * the flag says nothing about that.
   */
  it('states every font-size as a shared role, or as inherit', () => {
    const sizes = [...DECLARATIONS.matchAll(/font-size:\s*([^;}]+)/g)].map(([, value]) =>
      value.trim(),
    );

    expect(sizes.length, 'no font-size in the stylesheet at all').toBeGreaterThan(0);

    for (const size of sizes) {
      expect(size, 'a size off the scale').toMatch(
        new RegExp(`^(inherit|var\\(--text-(${ROLES.join('|')})\\))( !important)?$`),
      );
    }
  });

  /**
   * The names this admin owns are the eight. `--text-sm` and its siblings resolve
   * — to Tailwind's scale, silently — so a fallback beside one never fires and
   * the mistake looks like a careful line.
   */
  it('reads no --text- name the admin does not define', () => {
    const read = [...DECLARATIONS.matchAll(/var\(\s*(--text-[\w-]+)/g)].map(([, name]) => name);

    for (const name of read) {
      expect(name, 'a --text- name off the scale').toMatch(
        new RegExp(`^--text-(${ROLES.join('|')})(--[\\w-]+)?$`),
      );
    }
  });
});

/**
 * ============================================================================
 * A CLASS WITH NO RULE IS A COMPONENT THAT RENDERS AND LOOKS LIKE A MISTAKE.
 * ============================================================================
 * ADR 0062's work wrote `.wconvert-structure__head`, `.wconvert-checks`,
 * `.wconvert-meter`, `.wconvert-linkish` and three `.wconvert-scope__*` rows,
 * and a later rewrite of that region of `index.css` deleted every one of them
 * before they were ever committed. The Design tab's own header shipped as a
 * bulleted `<ul>` of check chips with no pass/fail colour beside an unstyled
 * meter, and nothing anywhere failed.
 *
 * **The sharpest one did not even render unstyled.** The chip was
 * `.wconvert-check`, which is `#wconvert-admin .wconvert-check` — the LeadLog
 * checkbox row, written for something else entirely — so it took a rule that
 * fit badly and looked deliberate.
 *
 * So the set is DERIVED rather than listed. A list is the thing that was lost:
 * whoever deletes the next region will not come here to remove its name.
 *
 * **A class beside a utility is exempt, and that is the file's own
 * convention** — `.wconvert-starter__name text-body font-semibold` states its
 * type as a utility because Tailwind's are `!important` (ADR 0035) and a
 * stylesheet rule for it could not win. What this catches is the other case:
 * a `wconvert-` class carrying the whole of a component's look, alone in its
 * `className`, with nothing in the stylesheet behind it.
 */
describe('every class the builder renders', () => {
  const BUILDER = resolve(import.meta.dirname, '../../resources/admin/src/builder');

  /** Every class name that is the WHOLE of what a `className` states. */
  const RENDERED = new Set<string>();

  for (const file of sources(BUILDER)) {
    const source = readFileSync(file, 'utf8');

    /*
      Both shapes: the bare attribute, and an expression — which covers
      `cn('a', flag && 'b')` and a template literal with one hole in it. The
      `id`, `htmlFor` and `name` attributes are deliberately NOT read: half the
      `wconvert-` strings in the rules panel are element ids, and an id needs no
      rule.
    */
    for (const [, quoted, braced] of source.matchAll(
      /className=(?:"([^"]*)"|\{((?:[^{}]|\{[^{}]*\})*)\})/g,
    )) {
      const literals =
        quoted !== undefined
          ? [quoted]
          : [...(braced ?? '').matchAll(/(['"`])([^'"`\n]*)\1/g)].map(([, , text]) => text);

      for (const literal of literals) {
        const names = literal.split(/\s+/).filter((name) => name !== '');

        // A utility beside it means the look is stated there, not here.
        if (names.some((name) => !name.startsWith('wconvert-'))) {
          continue;
        }

        for (const name of names) {
          // `wconvert-rule-${id}` leaves a prefix, which is not a class.
          if (!name.endsWith('-')) {
            RENDERED.add(name);
          }
        }
      }
    }
  }

  const STYLED = new Set([...CSS.matchAll(/\.(wconvert-[\w-]+)/g)].map(([, name]) => name));

  it('reads a set worth asserting over', () => {
    expect(RENDERED.size).toBeGreaterThan(40);
  });

  it.each([...RENDERED].sort())('has a rule for .%s', (name) => {
    expect(STYLED.has(name), `.${name} is rendered by the builder and styled nowhere`).toBe(true);
  });
});

describe('the builder card’s one inset', () => {
  /**
   * **The card's left edge stepped in and out five times on the way down** —
   * 16 → 12 → 12 → 10 → 8 → 12 → 12, plus `.wconvert-scope__clipboard` hanging
   * 4px OUTSIDE its pane on a `calc(var(--spacing) * -3)` whose variable this
   * file never declared. `.wconvert-pane__body` states no padding on purpose
   * (*"each pane's contents own their own padding"*), which is right, and is
   * what let three children each pick their own number.
   *
   * **Derived from the selector rather than from a list**, because a list is
   * the thing that rots: a band added next year is caught without anybody
   * remembering to add it here. `\b` is what keeps the family names out —
   * `_` is a word character, so `.wconvert-checks__chip` and
   * `.wconvert-block__label` do not match while `.wconvert-checks` and
   * `.wconvert-block[data-hidden]` do.
   *
   * `padding-block` is deliberately not checked. The gutter is an INSET; how
   * much air a band has above and below it is a question about that band.
   *
   * **The band has to be the selector's SUBJECT**, not merely somewhere in it.
   * `.wconvert-block[data-step='true'] .wconvert-block__name` states a
   * `padding-inline-start` that stands in for the grip a step's row does not
   * draw — that is a fact about the NAME, and a rule about the row's inset has
   * no business claiming it.
   */
  const BAND =
    String.raw`\.wconvert-(?:hint|said|stored|checks|pane__head|inspector__head|inspector__body|block)\b`;
  const SUBJECT = new RegExp(String.raw`${BAND}[^\s>+~]*$`);

  const RULES = [
    ...CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(
      new RegExp(String.raw`(?:^|[{};])([^{};]*${BAND}[^{};]*)\{([^{}]*)\}`, 'g'),
    ),
  ]
    .map(([, selector, body]) => ({ selector: selector.trim(), body }))
    .filter(({ selector }) =>
      selector.split(',').some((one) => SUBJECT.test(one.trim().replace(/\s*([>+~])\s*/g, '$1'))),
    );

  it('reads a set worth asserting over', () => {
    expect(RULES.length).toBeGreaterThan(5);
  });

  it.each(RULES.map(({ selector, body }) => [selector, body]))(
    'spends the gutter rather than a number of its own: %s',
    (selector, body) => {
      const insets = [
        ...body.matchAll(/(?:^|[\s;])(padding(?:-inline(?:-start|-end)?)?)\s*:\s*([^;}]*)/g),
      ];

      for (const [, property, value] of insets) {
        // `padding: 0` states no inset at all — a list reset, not a competing
        // number — and the gutter is what a band spends when it spends one.
        if (/^0$/.test(value.trim())) {
          continue;
        }

        expect(
          value.includes('var(--wconvert-gutter)'),
          `${selector} declares ${property}: ${value.trim()} — a band of the builder card spells its inset var(--wconvert-gutter)`,
        ).toBe(true);
      }
    },
  );

  /**
   * The one that was not a step but a bug: `--spacing` is declared nowhere in
   * this file, so it resolved to Tailwind's default `0.25rem` and the copy and
   * paste buttons hung 4px outside the pane they belong to.
   */
  it('states no length against a variable it never declares', () => {
    expect(CSS).not.toContain('var(--spacing)');
  });
});

describe('the preview’s three out-of-flow containers', () => {
  /**
   * **Two translucent bands lay across the rendered design, and they were the
   * mock page's own ghosts.** `.wconvert-site__ghost` carries `opacity: 0.55`,
   * and an element with `opacity < 1` paints as if it were `position:
   * relative; z-index: 0` — the same stacking level as a `position: absolute`
   * slot with `z-index: auto`. Ties there break by tree order, and `MockPage`
   * renders two ghosts AFTER the slot on purpose, so an `inline` Optin has page
   * content below it as well as above.
   *
   * On a real page the container is a `<dialog>` in the top layer and none of
   * this can happen. The preview mounts `inline` and the admin draws the
   * container itself, so the admin has to say the one thing the top layer was
   * saying for it. Deleting the `z-index` brings the bands straight back, and
   * nothing else in this project would notice.
   */
  it.each(['popup', 'floating_bar', 'slide_in'])(
    'lifts the %s slot above the page it is drawn over',
    (type) => {
      const rule = new RegExp(
        String.raw`\.wconvert-site\[data-display-type='${type}'\] \.wconvert-site__slot\s*\{([^}]*)\}`,
      ).exec(CSS)?.[1];

      expect(rule).toBeDefined();
      expect(rule).toMatch(/z-index:\s*[1-9]/);
    },
  );
});

/** Every `.ts`/`.tsx` under a directory, depth first. */
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return sources(path);
    }

    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

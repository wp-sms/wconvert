# Findings — popup isolation on hostile themes (#10)

**Shadow DOM is the right container, and it is not what makes the popup survive.**

The ticket framed this as a three-way choice — Shadow DOM, scoped CSS, iframe — and
assumed the container decides whether a theme can reach the popup. Measured against
ten real theme/plugin combinations and a synthetic theme built to be worse than any
of them, that framing is wrong twice:

1. **CSS leakage is a solved problem for two of the three, and the container is not
   what solves it.** What solved it was moving every load-bearing declaration off
   the root element. Before that change, the *shadow* modes leaked on OceanWP where
   the *scoped* mode did not.
2. **The failure that actually breaks popups is not CSS leakage at all.** It is a
   `transform` on an ancestor, which silently converts `position: fixed` into
   "positioned somewhere in the document" — and **no container fixes it**. Shadow
   DOM, scoped CSS and iframe all fail. The only thing that fixes it is the **top
   layer**: a modal `<dialog>`.

So the answer is a modal `<dialog>` holding a closed shadow root. The dialog wins
the positioning and stacking fights the container cannot; the shadow root wins the
CSS fight. Neither does the other's job.

Measured on WP 7.1 / PHP 8.5, Chromium via Playwright, viewport 1280×900, against
the current wp.org builds of Astra 4.13.10, OceanWP, GeneratePress, Kadence,
Storefront, Hello Elementor + Elementor, Twenty Twenty-Three/Four/Five, Cookie
Notice and CookieYes. Raw output in [`results/`](results/).

---

## The measure

Every mode renders **identical markup and identical CSS**; only the container and
the reset differ. A "leak" is a computed-style property that differs from the
**reference render** — the same markup and CSS in a document with no theme, served
by the prototype plugin at `?wcv10_ref=1`. 28 properties × 9 elements are compared,
chosen because each is one real themes are documented to override on a bare tag
selector.

That definition matters: it makes leakage a number, not a judgement, and it is why
the OceanWP result below was caught at all — it is invisible to the eye.

## 1. On real themes, every strategy is clean — after one structural change

| scenario | shadow | shadow+armour | scoped | scoped+`!important` | iframe | dialog |
|---|---:|---:|---:|---:|---:|---:|
| all 10 real theme/plugin combinations | 0 | 0 | 0 | 0 | 0 | 0 |

Zero leaked properties everywhere ([`results/matrix-themes.txt`](results/matrix-themes.txt)).
Real themes are simply not that hostile: they style `h2`, `button` and `input` on
bare tag selectors, and a namespaced class beats a tag selector on specificity
without needing a shadow boundary at all.

**But the first run was not clean, and why is the useful part.** The template
originally put its base typography on the root element (`:host` for shadow). On
OceanWP, three properties leaked into every shadow mode and none of the others:

```
oceanwp  .wcv-overlay font-family   want -apple-system, ...  got "Open Sans", sans-serif
oceanwp  .wcv-overlay font-size     want 16px                got 14px
oceanwp  .wcv-overlay line-height   want 24px                got 25.2px
```

OceanWP ships a Meyer-style reset that names `div` explicitly:

```css
html,body,div,span,...{margin:0;padding:0;border:0;outline:0;font-size:100%;
font:inherit;vertical-align:baseline;font-family:inherit;font-size:100%;...}
```

That rule matches the **shadow host**, which lives in the light DOM. Per the cascade,
a normal declaration in the **outer** tree beats a normal `:host` rule in the inner
tree — so `:host { all: initial }` lost, the host inherited OceanWP's body font, and
inheritance carried it across the boundary into the shadow tree.

> **`:host` is not protected by the shadow boundary.** Anything inheritable that the
> page sets on the host flows straight in. The boundary protects the host's
> *descendants*, not the host.

Two fixes, both applied:

- **Nothing load-bearing on the root.** The root carries `display: block` and
  nothing else; positioning, stacking and base typography moved to the first
  element *inside* the container. This alone took every mode to zero, including
  the scoped ones.
- **`!important` on the host reset** (`shadow-armour`). An important declaration in
  the inner tree does outrank the outer tree, so this closes the hole rather than
  routing around it. Kept as belt and braces — it costs nothing.

## 2. On a theme built to be worse than any real one, they diverge

Six escalating levels, all on top of Twenty Twenty-Five
([`results/matrix-hostile.txt`](results/matrix-hostile.txt)). Leaked properties:

| level | what it does | shadow | shadow+armour | scoped | scoped+`!` | iframe | dialog |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | bare-tag overrides, no `!important` | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | the same, with `!important` | 0 | 0 | **65** | 0 | 0 | 0 |
| 3 | `* { … !important }` | 0 | 0 | **96** | 0 | 0 | 0 |
| 4 | + `transform` / `filter` on `body` | 1 | 1 | 96 | 1 | 0 | 0 |
| 5 | + sticky header and banner at z-index 2147483647 | 1 | 1 | 96 | 1 | 0 | 0 |
| 6 | + the `transform` moved onto `<html>` | 1 | 1 | 96 | 1 | 0 | **0** |

**Scoped CSS dies at level 2 and never recovers.** A namespaced reset is a
specificity argument, and `!important` is not a specificity argument — it is a
different cascade origin. `.wcv-x9f2 *` cannot beat `button { … !important }`, and
at level 3 the popup is rendered in Comic Sans with square corners and content-box
sizing. Adding `!important` to every declaration rescues it exactly (0 deltas at
levels 1–3) — which is the honest verdict on "scoped CSS with heavy specificity":
**it works, and "heavy specificity" means `!important` on every line, in an
arms race the theme can always re-enter.**

**The `!important` rewrite has a trap.** Applying it to the whole stylesheet
invalidates `@font-face`: `!important` is illegal on a descriptor, so the face is
dropped and the template silently loses its webfont. The rewrite must skip at-rule
blocks. A naive implementation of this strategy gets that wrong and nobody notices,
because the fallback font renders fine.

## 3. The finding that actually matters: a transformed ancestor

Levels 4 and 6 put `transform: translateZ(0)` on `body` and then on `<html>`. A
transformed element becomes the containing block for its `position: fixed`
descendants, so the popup stops being fixed to the viewport and becomes fixed to the
page. Nothing about it looks broken on load — it looks broken *after the visitor
scrolls*.

A 4000px page, sampled the whole way down. Cell = the modal's y in viewport
coordinates; `!` = off screen or unclickable
([`results/fixed-positioning.txt`](results/fixed-positioning.txt)):

```
WITH body { transform: translateZ(0) }
MODE                    y=0      y=500     y=1500     y=2500     y=3100   ON SCREEN
shadow                !1858      !1358        358      !-642     !-1242         1/5
scoped                !1574      !1074         74      !-926     !-1526         1/5
scoped-imp            !1858      !1358        358      !-642     !-1242         1/5
iframe                  308       -192     !-1192     !-2192     !-2792         2/5
shadow-html             308        308        308        308        308         5/5
dialog                  308        308        308        308        308         5/5
```

- **Every container fails.** Shadow DOM 1/5, scoped 1/5, iframe 2/5. The isolation
  strategy is irrelevant — the container is inside the transform either way.
- The in-document strategies centre the popup in the *document*, so it is visible
  only if the visitor happens to be scrolled near the middle. The iframe pins to
  the *top* of the document, so it is visible only near the top. Both are "the
  popup works when I test it on the homepage and users report it never appears".
- **Appending to `<html>` instead of `<body>` fixes a `body` transform** (5/5) and
  does nothing for a transform on `<html>` itself — at level 6 `shadow-html` drops
  back to 1/5.
- **A modal `<dialog>` is 5/5 at both levels.** Top-layer elements are laid out
  against the viewport regardless of any ancestor's transform.

This is not exotic. `body { transform: translateX(…) }` is the standard off-canvas
"push" mobile-menu pattern, and page builders apply transforms to wrappers for
scroll effects. It is applied conditionally — while the menu is open, during a
scroll animation — which is exactly when a popup might fire.

## 4. The z-index war cannot be won on z-index

Level 5 puts a sticky header and a cookie banner at `z-index: 2147483647`, the
maximum. Two questions with different answers
([`results/z-index-war.txt`](results/z-index-war.txt)):

| our container | | clickable | on top |
|---|---|---|---|
| z-index 2147483646 | shadow / scoped / iframe | yes | **no** — banner paints over us |
| z-index 2147483646 | dialog, or appended to `<html>` | yes | yes |
| z-index 2147483647 | everything (tie broken by DOM order) | yes | yes |

At one below the maximum every in-`<body>` strategy is painted over. Tying at the
maximum wins, but only because we append later in the DOM — **a tie that anything
appending after us takes straight back**, which on a real site means the chat
widget, the cookie banner that re-renders on consent, or the next popup plugin.

A modal `<dialog>` does not enter the auction. The top layer paints above the entire
stacking context tree irrespective of z-index.

> **A trap worth naming:** `inert` on the rest of the page removes those elements
> from hit-testing, so the popup stays *clickable* even while a banner paints a grey
> scrim over it. Hit-testing therefore reports "we are on top" when we are not.
> Measuring paint order required lifting `inert` first. Any test of this that only
> asks `elementFromPoint` will report a false pass.

## 5. Accessibility: the container gives you nothing, except one

With the hand-written focus trap, Esc handler and inerting switched off
([`results/a11y-free.txt`](results/a11y-free.txt)):

| | Tab leaves the popup | where it went | Esc closes |
|---|---:|---|---|
| shadow (closed / open), scoped, iframe, `<html>`-mounted | 4× | `body`, then `a#wp-skip-link`, then the theme's nav | no |
| **dialog** | 1× | `body` only — never page content | **yes** |

Every container except `<dialog>` lets Tab walk straight out into the theme's
skip-link and nav, and ignores Esc. **Shadow DOM and iframes provide no
accessibility whatsoever** — every bit of it is code you write, and it is the same
code in all three cases.

The dialog's single "escape" is focus resting on `body` between cycles, which is the
browser's own focus-cycle behaviour and not a reachable target; it never reached a
focusable element outside the dialog.

**Focus restoration is native too.** With a real link focused, the popup opened and
then closed ([`results/focus-restore.txt`](results/focus-restore.txt)):

```
dialog + shadow (native restore)  a#the-opener -> a#the-opener   yes  (native)
closed shadow (hand-written)      a#the-opener -> a#the-opener   yes  (written by hand)
```

`showModal()` records the previously focused element and returns focus to it on
close; `src/ship/dialog.js` contains no restoration code at all.

`showModal()` gives Esc-to-close, a real focus trap, and modality that a screen
reader's virtual cursor respects, for free. With the hand-written layer in place all
modes pass ([`results/a11y.txt`](results/a11y.txt)) — the point is that for the
dialog that layer is largely deletable.

Two boundary effects that survive either way:

- **`document.activeElement` lies.** For a closed shadow root it reports the host
  `<div>`; for an iframe it reports the `<iframe>`. Never the focused control. Any
  theme script, analytics package or a11y auditor reading it gets the wrong answer,
  and for a **closed** root there is no way to get the right one.
- **`aria-labelledby` / `aria-describedby` resolve fine**, because both ends are
  inside the same root. They would not resolve across the boundary — so the
  template must never point an IDREF at something outside its own container.

## 6. Webfonts do not cross into a shadow root

**An `@font-face` declared inside a shadow root is silently ignored.** The element
falls back and nothing warns:

```
document-level @font-face   title text 360.97px   (the webfont)
Georgia fallback            title text 367.34px
@font-face inside a shadow root  367.34px   <- fell back
document.fonts.size = 1     <- the shadow face never entered the font set
```

This is why the plain `shadow` modes show `f` (webfont lost) on **every one of the
ten real themes** in §1 while rendering zero style deltas. The declared
`font-family` computed value is identical; only the rendered glyph widths differ.
A test that compares computed styles alone reports a pass.

**`document.fonts.check()` is useless for detecting it** — it returned `true` for
`'Totally Not A Real Font'`. It answers "can this text be rendered", not "is this
face available".

The fix is to hoist `@font-face` into the document, which means the isolation is
never total: the recommended implementation adds **exactly one** document-level
`<style>` element, holding the font faces and one `::backdrop` rule (`::backdrop`
cannot be set inline, and the UA's is a second grey scrim over the template's own).
Measured: document style count 8 → 9 on mount, back to 8 on close.

## 7. RTL — the map's fog, and it is not this ticket's problem

Run under a **real `fa_IR` locale**, so themes ship their own `-rtl.css` and the body
carries the `rtl` class ([`results/rtl.txt`](results/rtl.txt)): **44/44 correct** —
4 themes × 11 modes, `direction: rtl` inside the container and the close button
correctly on the left in every single one.

The specific fear — that `all: initial` on the host would reset direction and strand
the popup in LTR inside an RTL page — **is unfounded, by spec**. The `all` shorthand
excludes `direction` and `unicode-bidi`. Verified directly: with distinctive values
on the page, `all: initial` reset `letter-spacing` (7px → normal) and `font-size`
(31px → 16px) while `direction` stayed `rtl`.

```
pageLetterSpacing 7px    hostLetterSpacing normal
pageFontSize      31px   hostFontSize      16px
pageDirection     rtl    hostDirection     rtl     <- `all` does not touch it
```

So RTL is absorbed by two things, neither of which is a container decision:

- writing direction inherits across every boundary on its own; and
- the template uses **logical properties** (`inset-inline-end`, `text-align: start`,
  `margin-inline`), which is a template rule, not a rendering-primitive one.

The one container-specific cost is the **iframe**, which inherits nothing and must
have `dir` and `lang` copied into the `srcdoc` by hand — one more entry on the
iframe's ergonomics bill.

**Recommendation: RTL does not need its own ticket, and it is not a constraint this
primitive absorbs either.** It is a template-authoring rule for #15, and a
lint-style check that no template ships a physical `left`/`right` offset.

## 8. Size does not decide this

Against #9's budget of **≤8KB gzipped** for the loader asset
([`results/00-sizes.txt`](results/00-sizes.txt)):

| complete strategy: container + a11y + the template's CSS | minified | **gzip** | brotli |
|---|---:|---:|---:|
| **dialog + closed shadow root** | 5,994 | **2,098** | 1,644 |
| closed shadow root, hand-written a11y | 5,907 | **2,097** | 1,631 |
| scoped + `!important` | 6,070 | **2,189** | 1,720 |
| iframe | 6,246 | **2,225** | 1,737 |

**128 bytes gzipped separates the best from the worst.** The whole question is worth
1.6% of the loader budget. The `!important` rewrite is the only one with a visible
cost and it is 54 bytes gzipped (CSS 899 → 954), because gzip eats the repetition.

Note that ~870 bytes of every row is the template's own CSS, which is not an
isolation cost at all — and it is one template. **#15 should assume template CSS,
not isolation, is what consumes the remaining budget.**

## 9. Clipping ancestors are not an overlay problem

Mounted inside `overflow: hidden; height: 120px; transform: translateZ(0)`, **every
mode is clipped identically** ([`results/clip.txt`](results/clip.txt)) — including
the dialog, because moving a promoted element out of the top layer demotes it.

That is correct behaviour rather than a failure. Overlays never meet this: they mount
at `<body>` or in the top layer. Only `inline` renders where it was embedded, and an
inline Optin inside a clipped container is a *placement* question for whoever chose
the embed point. It is not a rendering-primitive decision, and no container changes it.

## What did not get tested

- **Chromium only.** Every number here is one engine. The three load-bearing claims
  — top-layer positioning ignores ancestor transforms, `@font-face` does not apply
  inside a shadow root, `all` excludes `direction` — are all specified behaviour
  rather than Chromium quirks, but Firefox and Safari are unverified. `<dialog>` and
  `showModal()` are Baseline since March 2022 (Safari 15.4).
- **No real screen reader.** Modality, focus order and IDREF resolution were
  measured through the DOM and real key presses; VoiceOver and NVDA behaviour is
  inferred, not observed.
- **`::backdrop`, `inert` and `:modal`** were exercised in Chromium only.
- **Divi** is commercial and was not tested; Elementor stands in for the page-builder
  case. The synthetic level 3–6 theme is deliberately worse than either.
- **No mobile viewport or touch.** Exit intent's mobile answer is still #3's.
- Themes that set `display: none` or `visibility: hidden` on a bare `div` selector
  would beat even the armoured host. None of the ten does; it is not defended against.

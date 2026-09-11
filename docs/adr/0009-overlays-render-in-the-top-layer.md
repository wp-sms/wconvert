# Overlays render in the top layer, inside a closed shadow root

An Optin overlay is a modal `<dialog>`, promoted to the top layer with
`showModal()`, containing a `<div>` that hosts a **closed** shadow root. The
template's markup and CSS live inside the shadow root. Exactly one `<style>`
element is added to the document, holding `@font-face` rules and one `::backdrop`
rule.

Two containers, because they solve two different problems and neither solves the
other's.

## The shadow root wins the CSS fight

Against ten real theme and plugin combinations, a namespaced class with an
`all: revert` reset leaked nothing — real themes style `h2`, `button` and `input`
on bare tag selectors, which a class already beats. Against a theme with
`* { … !important }`, the same approach leaked 96 computed-style properties and
rendered the popup in Comic Sans. A shadow boundary is not a specificity argument,
so it does not have to win one.

Scoped CSS can be rescued by putting `!important` on every declaration — measured at
zero leakage, 54 bytes gzipped, and an arms race the theme can re-enter at any time.
The shadow boundary ends the argument instead of winning it.

**`closed` over `open`:** they measured identically. Closed is chosen so a theme
script sweeping `document.querySelectorAll('input')` cannot reach the capture field
and rebind it. The cost is that `document.activeElement` reports the host `<div>`
and nothing outside can learn otherwise.

*Scoped by [ADR 0040](0040-the-builders-preview-is-an-input.md), which did NOT
relax this. The hazard named above is a hazard on a **visitor's** page, from code
WConvert does not control; the builder's preview is neither. It needed no change
here regardless: `mount()` already hands the rendered step to whoever mounted it,
so the builder reads what it asked for and the boundary stays shut to everything
else. The cost sentence above is also what makes a keyboard test of that preview
dispatch at the element rather than at `document.activeElement`.*

## The top layer wins the positioning and stacking fights

A `transform` on an ancestor makes it the containing block for `position: fixed`
descendants. `body { transform: translateX(…) }` is the standard off-canvas
mobile-menu pattern, so this is applied on real sites, conditionally, at exactly the
moments a popup might fire.

Measured on a 4000px page sampled at five scroll positions, with a transformed
`body`: shadow DOM put the popup on screen at 1 of 5, scoped CSS 1 of 5, an iframe
2 of 5. **No container fixes this** — the container is inside the transform either
way. Mounting on `<html>` instead of `<body>` scores 5 of 5 until the transform
moves onto `<html>`, and then it is 1 of 5 again. A modal `<dialog>` is 5 of 5 in
both cases, because a top-layer element is laid out against the viewport regardless
of any ancestor.

The same promotion ends the z-index war. At one below the maximum, a cookie banner
at `z-index: 2147483647` paints over every in-`<body>` strategy. Tying at the
maximum wins on DOM order — a tie the next widget to append takes straight back. The
top layer does not enter the auction.

## Consequences

- **Nothing load-bearing goes on the root element.** A normal declaration in the
  outer tree beats a normal `:host` rule, so anything the design needs there is a
  rule the theme is allowed to win.

  *And the reset cuts both ways, which [ADR 0011](0011-non-modal-overlays-use-the-popover-top-layer.md)
  found the hard way: `:host{all:initial!important}` resets `pointer-events` to its
  initial `auto`, and a shadow tree's `!important` beats an inline one on the host,
  so a CONTAINER cannot relax it from outside either. That is why Pro's popover box
  is sized to the design rather than made click-through — see 0011's third
  consequence.* OceanWP's Meyer-style reset names `div`
  explicitly, matched the shadow host, and pushed its body font across the boundary
  by inheritance. Positioning, stacking and base typography belong to the first
  element *inside* the container; the host reset is `!important`, which the outer
  tree cannot outrank.
- **`@font-face` must be hoisted to the document.** A face declared inside a shadow
  root is silently ignored and the element falls back — identical computed
  `font-family`, different glyphs. `document.fonts.check()` cannot detect it; it
  returns `true` for fonts that do not exist. The isolation is therefore never
  total, and one document-level `<style>` is part of the design.
- **`showModal()` supplies the accessibility.** Focus trapping, Esc-to-close, focus
  restoration to the opener, and modality a screen reader respects are all native.
  Every other container supplies none of it: measured with the hand-written layer
  off, Tab walked out into the theme's skip-link and nav in four presses and Esc did
  nothing.
- **RTL needs no container work.** Writing direction crosses every boundary — the
  `all` shorthand excludes `direction` and `unicode-bidi` — so RTL correctness is a
  matter of templates using logical properties. Verified at 44 of 44 under a real
  `fa_IR` locale. An iframe would have been the exception, needing `dir` and `lang`
  copied in by hand.
- **Isolation is not a budget question.** The four strategies span 128 bytes
  gzipped, complete with a11y and the template's CSS; the recommendation is 2,098
  bytes against #9's 8KB loader budget. About 870 bytes of that is the template's own
  CSS, so template variety, not isolation, is what will consume the rest.
- **`inert` makes a lost z-index war look won.** Inerting the page removes those
  elements from hit-testing, so the popup stays clickable while a banner paints over
  it. Any check that only asks `elementFromPoint` reports a false pass.
- **`<dialog>` cannot host a shadow root**, hence the inner `<div>`. The dialog is
  armoured with inline `!important` styles, which is the only protection available to
  an element with no shadow root of its own. It resolves the design's global width
  against the viewport, capped at the viewport minus `2rem`, and its inner
  `.wc-root` fills that box at `100%`. Applying the original width to both would
  resolve a percentage twice: an `80%` design would occupy only `64%` of the
  viewport inside the centred dialog. Giving the dialog an explicit width also
  avoids intrinsic sizing collapsing around the size-contained inner root.
  Popup mounting passes a temporary token copy to the shared shell, so this
  contract holds on every screen. The stored template and authored descendant
  token and narrow bags remain unchanged. Inline and non-modal containers retain
  their own sizing contracts.
- **`inline` Optins are outside this decision.** They render where they were
  embedded, so a clipping ancestor clips them whatever the container — measured
  identically across all eleven modes. That is a placement question, not a rendering
  primitive one.

**Amended by [ADR 0011](0011-non-modal-overlays-use-the-popover-top-layer.md):** this
decision was measured on a popup only. `floating_bar` and `slide_in` must not be
modal, and `dialog.show()` is not in the top layer, so they use `[popover=manual]`
instead.

`<dialog>` and `showModal()` are Baseline since March 2022 (Safari 15.4). Everything
here was measured in Chromium only; the three load-bearing behaviours are specified
rather than Chromium quirks, but Firefox and Safari are unverified.

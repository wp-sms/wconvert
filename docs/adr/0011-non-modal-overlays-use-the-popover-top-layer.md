# Non-modal overlays use the popover top layer

Amends [ADR 0009](0009-overlays-render-in-the-top-layer.md).

There are three containers, not one:

| Display Type | Container |
|---|---|
| `popup` | `<dialog>` + `showModal()` — top layer, modal |
| `floating_bar`, `slide_in` | `[popover=manual]` — top layer, **non-modal** |
| `inline` | closed shadow root only, in flow, no top layer |

## Why 0009 needed amending

0009 generalised from a prototype that only ever rendered a popup, and
`CONTEXT.md` defines an overlay as `popup` **plus** `floating_bar` **plus**
`slide_in`. Applied literally to all three, it is wrong for two of them.

`showModal()` inerts the rest of the page and traps focus. That is correct for a
popup and unacceptable for a floating bar, which is meant to sit at the edge of a
page the visitor keeps reading and interacting with.

The apparent escape — `dialog.show()` — does not work: **only modal dialogs enter
the top layer.** A non-modal `<dialog>` is an ordinary in-flow element, which
forfeits the single finding 0009 rests on. A transformed ancestor put every
in-document strategy on screen at 1 of 5 scroll positions against the top layer's 5
of 5, and the z-index war cannot be won on z-index.

So a bar built on `show()` inherits every failure 0009 was written to prevent, and a
bar built on `showModal()` breaks the page. `[popover=manual]` is the only container
that is in the top layer and not modal. `manual` rather than `auto` because `auto`
carries light-dismiss and forces one-popover-at-a-time semantics that belong to the
rule engine (#3), not to the DOM.

## Consequences

- **Accessibility is no longer free for two of the four types.** 0009's "`showModal()`
  supplies the accessibility" holds only for `popup`. A popover gets no focus trap,
  no Esc handler and no focus restoration — correctly, since it is not modal — but
  its close button and keyboard reachability are now hand-written code that
  `popup` does not need.

  *Delivered by [#34](https://github.com/navidkashani/wconvert/issues/34), and the
  bill came to less than this paragraph implies. The close button is free's own
  `closeButton()` — a real `<button>` in the tab order, so Enter and Space are the
  platform's to deliver and the container binds no key at all. Nothing traps focus
  and nothing takes it. **What it cost instead is reachability: 17 Tab presses to
  arrive at the close button** on a default theme, measured, because the popover is
  appended last and sequential focus follows DOM order. That is the honest price of
  not being modal, and it is booked rather than solved — moving the overlay up the
  document to shorten it would put an overlay ahead of the page's own content for
  everyone reading linearly.*
- **`popover` is Baseline April 2024**, later than `<dialog>`'s March 2022. Its
  fallback on an unsupporting browser is plain `position: fixed`, which loses to an
  ancestor `transform`. Less catastrophic for a bar pinned to the document edge than
  for a centred modal that scrolls off screen, but it is a real degradation and it is
  booked, not solved.

  *Confirmed by #34: a bar with no `popover` support renders anyway, which is the
  opposite of the popup's answer — free's `mount()` returns nothing without
  `showModal()`, because every fallback for a centred modal is worse than its
  absence. Where support exists, the container was measured against a transformed
  `body` on a 4000px page at five scroll positions and scored **5 of 5**, matching
  the modal dialog and unlike every in-document strategy's 1 of 5.*

- **The box has to BE the design, and that is 0009's armour meeting this container.**
  *Added by #34, from two bugs found in a browser.* `.wc-root` sizes itself
  `min(var(--wc-width), 100%)` and carries no auto margin, so it sits at the inline
  start of whatever box it is given — and a box wider than the design leaves the
  remainder at the END, which for a slide-in is the corner it is named for (measured
  64px off it). That remainder is transparent, in the top layer, and **swallows every
  click that lands on it**: inerting arriving through the back door, on the one
  container chosen because it must not inert anything.

  `pointer-events: none` on the box does not fix it. It inherits, but
  `:host{all:initial!important}` resets the shadow host to the property's initial
  value of `auto` and hands the whole area straight back — and an inline `!important`
  on the host loses, because a shadow tree's `!important` beats the outer tree's by
  design. That is 0009's armour working exactly as specified, against us.

  Shrink-wrapping the box is worse still: it would size itself from the design's
  max-content while the design sized itself from the box, so the `width` token would
  decide nothing (measured at 233px against the 352px asked for). So the box is told
  the number the design is about to ask for, and the remainder stops existing rather
  than being made harmless. **A bar spans the edge by asking to** — its tree carries
  `width: 100%`, which is what makes it an edge.
- **The free tier is unaffected.** Free ships `popup` and `inline`; `floating_bar`
  and `slide_in` are premium, so the newer baseline is carried entirely by paying
  installs.
- **`inline` is confirmed outside all of this**, as 0009 already said. It renders
  where it was embedded, gets a closed shadow root for CSS isolation and nothing
  else, and carries no backdrop and no dialog element.
- Everything else in 0009 stands unchanged: the closed shadow root, nothing
  load-bearing on the root element, `@font-face` hoisted to the document, and the
  isolation budget.

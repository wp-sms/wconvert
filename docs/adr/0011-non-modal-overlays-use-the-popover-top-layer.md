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
- **`popover` is Baseline April 2024**, later than `<dialog>`'s March 2022. Its
  fallback on an unsupporting browser is plain `position: fixed`, which loses to an
  ancestor `transform`. Less catastrophic for a bar pinned to the document edge than
  for a centred modal that scrolls off screen, but it is a real degradation and it is
  booked, not solved.
- **The free tier is unaffected.** Free ships `popup` and `inline`; `floating_bar`
  and `slide_in` are premium, so the newer baseline is carried entirely by paying
  installs.
- **`inline` is confirmed outside all of this**, as 0009 already said. It renders
  where it was embedded, gets a closed shadow root for CSS isolation and nothing
  else, and carries no backdrop and no dialog element.
- Everything else in 0009 stands unchanged: the closed shadow root, nothing
  load-bearing on the root element, `@font-face` hoisted to the document, and the
  isolation budget.

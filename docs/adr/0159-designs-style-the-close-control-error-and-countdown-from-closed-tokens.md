# 0159: Designs style the close control, error and countdown from closed tokens

**Extended by [ADR 0160](0160-templates-declare-fonts-decorations-and-countdown-density.md): boxed countdowns can use an author-only compact density with fixed cell widths. The same clock and labels remain.**

Date: 2026-10-21. Status: accepted (approved by the user).
Amends [0155](0155-visitor-controls-use-font-independent-geometry.md),
[0158](0158-a-close-control-takes-room-only-beside-what-it-covers.md),
[0146](0146-pro-is-one-tier.md), [0052](0052-a-countdown-counts-to-the-optins-own-schedule-end.md)
and [0044](0044-there-is-no-visitor-facing-error-state.md).

## Context

Three pieces were drawn identically on every design, and no design could
change them: the close × (a white circle with a grey border), the refused
entry (red text on a pink box) and the countdown (one line, `2d 14:05:09`).
Dark and photograph designs carried a white circle and a pink box that did
not belong to them, and a sale design could not use the boxed countdown the
genre expects.

Each small addition to the loader also needed its own budget approval, because
the gzip ceilings sat within a few dozen bytes of the bundles.

## Decision

- **Six closed tokens, each defaulting to the literal it replaces**:
  `close-fg`, `close-bg`, `close-border`, `close-radius` (round, rounded
  square, square), `error-fg` and `error-bg`. They are plain custom properties
  read with those literals as fallbacks, so a design that sets none renders
  pixel-identically. A bare × is not a shape: it is `close-bg` and
  `close-border` set to `transparent`. A colour may name one of the design's
  own (`"close-fg": "fg"`), so the × follows a theme.
- **The invalid field's ring follows `error-fg`**, falling back to today's red.
**Amended by the winter fidelity extension of [ADR 0067](0067-the-editor-starts-with-the-preview-and-the-selected-element.md):** `close-inset` is a closed appearance token for
the control’s inset; its default remains 0.5rem. This allows an arched card to
keep the control inside its painted surface.

- **The container still draws the ×.** Its tap size (32 px, 44 px on coarse
  pointers), label, glyph and the bar rule are unchanged (ADR 0155, ADR
  0158); a design may colour it but cannot remove it. Under forced colours the
  system's ink draws its edge, so a bare × keeps one.
- **A `countdown` may be `boxes`**: a box per unit with its word under it, the
  words supplied by the Playbook through a new Slot Role, `countdown_units`
  (Playbook copy reaches a node only by Role), editable, English otherwise. One
  calculation paints both layouts; days hide at zero and are not capped; no
  deadline shows `00`. Still one silent `role=timer`.
- **Contrast is the guard, not removal.** The editor warns when the × is under
  3:1 against its own ground (WCAG 1.4.11; the design's background when it is
  bare) or the error under 4.5:1. The catalogue gate draws every screen with
  the ×, a refused field and a painted countdown, measures their pixels and
  blocks a design that fails.
- **The pixel-diff draws them too**, at a fixed clock, so a carried approval
  proves these pieces unchanged. It also carries each Collection whose setups
  were all carried, and republishes the runtime Collections.
- **Budget headroom: +2,560 B on each loader.** Free 14,896 → 17,456 B and Pro
  28,160 → 30,720 B gzip-9, with the phone, analytics and commerce bases that
  follow them. This change measured Free 15,309 B and Pro 28,656 B (gzip -9, Node 24 locally; CI gates on Node 22). The reason
  is the approval cost, not this change: a hard gate stays, and the headroom
  stops each few-hundred-byte addition from needing its own yes.

## Consequences

- Existing designs and live campaigns are unchanged; only designs that opt in
  look different, and only those are re-reviewed.
- A merchant can still make the × or the error hard to see, and is told so, as
  with text. A catalogue design cannot ship that way.
- An X outside the card, a larger or custom glyph and hover colours remain out
  of scope.

**Budget amended by [ADR 0167](0167-campaign-artwork-uses-bounded-renderer-options.md):**
The campaign artwork extension adds 1,024 B to each loader ceiling, now
18,480 B Free and 31,744 B Pro; the preceding measurements remain historical.

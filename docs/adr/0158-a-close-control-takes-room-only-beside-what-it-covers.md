# 0158: A close control takes room only beside what it covers

Date: 2026-10-21. Status: accepted (approved by the user, PR #314).

## Context

Every overlay mounts the shared close control at its top inline-end corner.
On a bar that is one row on a wide screen, a corner X reads as misplaced. On a
phone-width bar or a slide-in, designs kept the X off their words with a band
of empty top padding: about 52 px of nothing on a phone bar. Without the band,
a long headline or a merchant's own rating line ran under the X;
`launch-index`'s text did so at six widths.

## Decision

- **On a bar wider than 24rem the X sits on the line's centre**: one container
  rule for `.wc-close[data-bar]`, which Pro's popover sets on bars.
- **On bars and slide-ins, only what the X would cover gets room beside it.**
  `pro/modules/display-types/loader/close-reserve.ts` measures the rendered
  step and gives `padding-inline-end` to any text the X overlaps, and to the
  row holding a field or button it overlaps, so a control never reshapes.
  It is Pro's alone: Free renders no bar or slide-in, and `shell()` offers
  only a `decorate(root, chrome)` hook, which Pro's popover passes.
- Designs for these formats need no band above their content.
- `tools/visual-tests/close-reserve.mjs` checks every bar (320–1440 px) and
  slide-in (288–416 px) in both directions, with its own and longer copy.

## Consequences

- Phone bars are 35–36 px shorter; no bar or slide-in has text under its X.
- The Pro loader budget rises by 288 B to 28,160 B (`bin/check-loader.mjs`).
  *Amended by [ADR 0159](0159-designs-style-the-close-control-error-and-countdown-from-closed-tokens.md): 30,720 B, and Free 17,456 B; the phone ceilings
  follow.*
  The reserve is about 245 B gzipped and Pro had 48 B left. The Pro phone
  page's combined ceiling (`bin/check-phone.mjs`) rises by the same 288 B.
  Free's budgets rise by nothing: its 39 B for the shared rule fits.
- One ResizeObserver per mounted bar or slide-in step.

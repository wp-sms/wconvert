# 0167 — Campaign artwork uses bounded renderer options

Date: 2026-10-24. Status: accepted.

The approved fifty-design campaign prototype needs fixed action arrows, ticket
cutouts and quiet original artwork motion. Flattening the whole composition
into a picture loses editable words and replaceable products. Importing its
HTML would bypass the closed vocabulary.

## Decision

Author fifty native trees and matching Playbooks, classified as 35 Black Friday
and 15 evergreen campaigns. Product imagery remains an ordinary replaceable
image; all offers, terms, field labels and action labels remain native leaves.
Free additions are catalogue-only; Pro display types live in their module.

Extend the existing vocabulary in small, opt-in ways:

- Button `icon: arrow` draws a decorative inline SVG beside the editable label.
  It inherits ink, never depends on a font glyph, and mirrors in RTL.
- Panel `notch_position: sides` with `notch: true` cuts the two side centres
  out of the panel. A mask exposes the actual backdrop, so changing colours
  cannot leave mismatched painted circles. The existing top notches are unchanged.
- Decorations add equalizer, rings, pixel, bubbles, balloon, barcode and halo.
  Their geometry is renderer-owned. Drift, pulse, levels and arrive are bounded
  motion choices; the fifty designs do not use rotational movement.
- Ordinary images may opt into arrive, breathe or drift. Replacing their image
  does not replace the animation contract. These are authored options, not an
  animation timeline or arbitrary keyframes in the editor.

Motion pauses when the mounted campaign is closed/offscreen and is disabled
under reduced-motion preferences. Decorative geometry remains outside reading
order. Existing designs that do not opt in render as before.

The form switch preserves a coupon's distinctive parent when returning it from
an acknowledgement. Match a unique non-root layout shell, independent of the
words omitted from the acknowledgement, and restore it among its surviving
siblings. Preserve empty decorative panels as artwork. Ambiguous shells retain
the existing placement fallback; no provenance metadata is stored in a draft.

## Cost and verification

The dependency-free additions measured 18,250 B Free / 31,593 B Pro gzip before
final minification checks, about 0.8 KiB above the previous ceilings. Allocate
1,024 B per loader: 18,480 / 31,744 B. **Amended by [0168](0168-approved-compositions-survive-native-rendering.md):** opt-in compact layouts and countdown presentation add 128 B to the Pro ceiling (31,872 B); the Free ceiling stays 18,480 B. Phone, analytics and commerce caps stay
separate. The hard gates remain; no runtime library is added.

Verification lives in `docs/reviews/black-friday-2026-10-24/`: native schema,
form-switch regression coverage, every screen at phone and desktop sizes,
contrast/overflow and announcement checks, and configured disposable WordPress
journeys. Fonts remain governed by the site's existing consent/delivery policy;
local preview fonts never enable remote delivery on a customer site.

# 0184: Right to left needs more than logical properties

Accepted 2026-11-03. Amends ADRs 0009 and 0183, each with an inline note.

## Context

ADR 0009 said right-to-left correctness in a popup is a matter of templates using logical
properties. That held under an English string with `dir="rtl"`. A full Persian translation
showed five things logical properties cannot reach:

- Letter-spacing pulls Arabic script's joined letters apart, in 293 of 301 designs and across
  the admin's type scale.
- Slanting a font with no italic produces a machine's guess, in 10 designs and one admin note.
- A four-sided `pad` token names physical sides. About 30 designs use one, mostly to clear the close
  control, and the control moves while the padding stays.
- An email address in a right-to-left input moves its `@` and dots as it is typed. Browsers make
  `tel` left to right on their own and leave `email` out.
- A dial code outside that `tel` input, in the phone control's picker and its country list, shows
  `+98` as `98+`.

## Decision

- **Under right-to-left, nothing is letter-spaced or slanted.** One rule in the renderer and one
  in the admin stop them there, rather than in every role that sets them. The admin also sets the
  scale's tracking variables to `normal`, because its important Tailwind utilities beat any
  unlayered rule, and the layer order leaves no earlier layer to outrank them from.
- **A four-sided `pad` mirrors** in the renderer's token writer, when `document.dir` is `rtl`.
  The stored design does not change. A value with parentheses in it is left alone, because a space
  inside one is not a side.
- **Email inputs are left to right** in the renderer, and email and URL inputs in the admin. The
  renderer has no URL field.
- **The phone control is left to right as a whole:** flag, dial code, chevron, then the number, the
  way a number is read. Its country list stays right to left for the country names, with each dial
  code isolated so `+98` does not show as `98+`.
- **A price in a translation carries a left-to-right mark.** This is data in `fa_IR.po` and is
  listed in its term sheet. A price a merchant types is theirs.
- **The loader budgets go up, approved by the user:** Free from 18,672 B to 18,752 B and Pro from
  32,064 B to 32,096 B. These rules take each loader up 85 B on Node 22, to 18,750 B and 32,084 B,
  and 59 B of that is the padding. Dropping the padding fix was the alternative.
- **`campaign-friday-pass` is the one named exception** to the per-design cap in Persian. It is
  1,277 B in English, its three Persian words cost more than the 3 B left, and the cap is only
  read at authoring time. Slimming the design would have meant republishing the online library.

## Consequences

- A template author does not need to think about any of this. Left-to-right rendering is
  unchanged, but a renderer change gives every setup a new revision, so `templates:visual-diff`
  carried their approvals on proof that no pixel moved.
- Hebrew loses letter-spacing too, which costs it nothing it relies on.
- `document.dir` reads the page, not the box. A left-to-right block on a right-to-left site gets
  mirrored padding.
- Admin numbers and popup fonts are not addressed here.

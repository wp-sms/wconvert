# A narrow bag is the same bag at a second width

**Amended by [ADR 0067](0067-the-editor-starts-with-the-preview-and-the-selected-element.md):** both layouts and leaves may carry a second token bag beside `tokens`, applying only where
the design is narrower than `manifest.narrow` — **24rem (384px)**, which is
where a `split` stops being side by side: a pane's `flex-basis` is `12rem` and
there are exactly two of them. Retuning at the width the layout gives up at
means the two mechanisms cannot disagree about when a design is narrow.

A phone measure would have been the obvious number and is the wrong one. The
common ones straddle it — 360, 375, 390, 412 — so half the phones in
circulation would have wrapped without retuning or retuned without wrapping.
It was 22.5rem for one commit and
[ADR 0065](0065-the-editor-is-the-scope-editor-now.md) is where it moved,
because the builder's own width switch had to be drawn at a width the query
actually fires at.

```jsonc
{ "type": "media",
  "tokens": { "pad": "1.75rem 1.375rem", "heading-size": "1.625rem" },
  "narrow": { "pad": "1.25rem 1.125rem", "heading-size": "1.25rem" } }
```

Same closed names, same closure function, same drop-when-empty. It is
[ADR 0062](0062-a-token-bag-is-scoped-to-the-box-that-carries-it.md)'s bag
again, and this ADR is mostly about the two things that made it harder than
that sentence suggests.

**Scope made explicit by [ADR 0072](0072-setup-choices-state-their-effect-and-scope.md):**
the editor keeps a mobile-appearance reminder visible even without a selected
node. Text and blocks are shared across sizes; this second bag changes appearance,
not content or structure. The reminder changes no inheritance or breakpoint rule.

## What it is for, and what already worked without it

**Shrinking is not the same as retuning.** A photo pane that is 440px of a
split is the whole width on a phone, and what it wants there is *less* padding
and *smaller* display type — not the same values in a narrower box. `fieldwork`
at 360px was a 384px-tall picture above the form with the CTA at the fold; the
retune brings it to 260px and the button above it.

Everything that merely needs to be *smaller* already was. The panes of a
`split` stack, a `grid` drops to one column, `.wc-root` is
`min(var(--wc-width), 100%)`, and a `row` wraps — none of that needed a second
bag and none of it changed.

**A container width and not the viewport's.** An `inline` Optin in a 280px
sidebar is narrow on a desktop, and a media query calls it wide. `.wc-root`
declares `container: wc/inline-size` and the query measures that, which is the
same argument the admin's own three-pane query made.

## The mirror, and why a bag cannot simply be conditional

A bag is written with `element.style.setProperty`, and **there is no
conditional form of that.** A stylesheet has `@container` and cannot name one
node in a tree it has never seen. Neither side can do this alone.

So the renderer writes a retuned box's values under a **second set of property
names** — `--wc-n-bg`, `--wc-n-pad` — and one rule remaps every one of them:

```css
@container wc (max-width:24rem){
  .wc-stack[data-narrow],…,.wc-media[data-narrow]{
    --wc-bg:var(--wc-n-bg)!important; … × 24 }}
```

Three things about that rule are load-bearing.

**`!important`, because it has to beat an inline declaration.** The wide bag is
on the element's own `style`, which outranks every stylesheet rule that is not
important. Inside a shadow root the only thing this can outrank is the design's
own inline properties, which is exactly what it is for — so the `!important`
here is not the specificity arms race
[ADR 0042](0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md)
rule 6 is about.

**`[data-narrow]` is the correctness argument and not an optimisation.**
`--wc-n-bg` inherits, so an ungated remap fires on every descendant: a child of
a retuned box that sets its own `bg` and no narrow bag would be repainted with
its ancestor's narrow ground. Gated, a box with no narrow bag is untouched at
every width and inherits its ancestor's already-remapped value the ordinary
way — which is what a scope means.

**The mirror is every token in scope, not the narrow bag and not the box's
own.** This is the part that was wrong first and was found in a browser.

## The bug worth recording: guaranteed-invalid is not inherit

The first implementation mirrored only the box's own bag merged with its narrow
one, on the reasoning that a name in neither bag would leave `--wc-n-fg` unset,
`var(--wc-n-fg)` would be invalid at computed-value time, and an invalid
inherited custom property would fall back to the inherited value.

**It does not.** An invalid-at-computed-value-time custom property becomes the
**guaranteed-invalid value** — which is not the inherited value, and which
makes every `var(--wc-fg, <literal>)` in the stylesheet take its own literal
fallback. So the remap silently wiped every token the narrow bag did not name:
`fieldwork`'s serif display line came out in the body face below 360px and
nowhere else, because `.wc-heading{font-family:var(--wc-heading-font,var(--wc-font,…))}`
fell through to `--wc-font`.

The fix is to make the mirror complete. `render.ts` now threads the **bag in
scope** down its walk — the design's tokens, overridden by each ancestor's bag,
overridden by the box's own, including the picture reset a `panel` or a `media`
makes — and a retuned box mirrors all 24 names with its narrow bag written over
the top. The remap then always finds a value and needs no fallback.

**Corrected by [ADR 0067](0067-the-editor-starts-with-the-preview-and-the-selected-element.md):** the threaded bag includes each ancestor’s narrow values. A child overriding a different mobile property must retain its ancestor’s mobile colors and typography.

**That threading is the only genuinely new thing this module has had to know.**
The renderer has been a pure function of `(tree, tokens)` with no ambient
reads, and it still is; what it did not have was any notion of a value's
*resolved* state, because CSS inheritance did all of that. `inScope()` returns
the parent's object unchanged where a box adds nothing, so a design with no
bags threads one object all the way down and allocates nothing.

It costs 24 `setProperty` calls on a retuned box, nothing at all on every other
box, and **nothing in the payload** — what is stored is the narrow bag the
author wrote.

## What it cost

| | before | after |
|---|---|---|
| Pro elite loader, gzipped | 10,817 B | 11,177 B (budget 12,288) |
| `fieldwork`, snapshotted | 910 B | 913 B (cap 1,024) |
| Ten of it on one page | 1,570 B | 1,594 B (budget 2,048) |

*The fixture measured ten at the time. It measures five now, and for why, see
[ADR 0063](0063-the-five-things-the-reference-designs-still-could-not-say.md)'s
correction note.*

360 bytes of loader for the mechanism and 3 bytes of payload for the one design
that uses it. The plan that asked for this named it *"the item that doubles what
a scope stores"* and said to reconsider it if the budget tightened; it did not.
1,111 B of loader headroom remain.

## What it deliberately cannot do

**Only tokens.** `min`, `edges`, `notch` and `ratio` are layout *params*, not
tokens, and `narrow` takes the token names alone. Two of those four are custom
properties and could have been remapped; `edges` and `notch` are attributes and
could not, so a `narrow` that took params would have taken some of them.

The case this loses is real and was met immediately: the reference set retunes
`min` on its photo pane. `fieldwork` answers it by not setting `min` at all —
`.wc-split` is `align-items: stretch`, so a media beside a form is already the
form's height, and once the split wraps the media is as tall as the two lines on
it. **A floor is only needed where the picture is the taller thing**, which is
worth knowing about `min` generally rather than a reason to widen `narrow`.

**One breakpoint, not a scale.** Two would be four bags per box and a
stylesheet with two remaps in it, for a design surface whose whole argument is
that the merchant cannot move a box.

## Consequences

- Every layout gains a param. `TemplateLabels` names it six times, which is the
  bargain `*.tokens` already makes for the reason it documents.
- `manifest.narrow` is a new top-level section: one number, read by the
  renderer's own container query as `A_NARROW_DESIGN` and asserted against the
  manifest by `renderer-manifest-parity` — the arrangement `SAFE_SCHEMES` and
  `referable` already have. The renderer still imports no manifest.
- The stylesheet now reads `--wc-n-<token>` names. The parity rule is unchanged
  — no `--wc-*` name outside the declared tokens and layout params — and the
  narrow mirror is enumerated from the manifest rather than pattern-matched, so
  a `--wc-n-wobble` still fails the build.
- `.wc-root` declares `container-type`. Its inline size is explicit
  (`min(var(--wc-width),100%)`), so inline-size containment changes nothing
  about what it draws.
- The width switch in the builder stops being preview-only: it selects which
  bag the inspector edits. See
  [ADR 0065](0065-the-editor-is-the-scope-editor-now.md), which also moves this
  breakpoint from 22.5rem to **24rem** — where a `split` stops being side by
  side — so the two mechanisms cannot disagree about when a design is narrow.

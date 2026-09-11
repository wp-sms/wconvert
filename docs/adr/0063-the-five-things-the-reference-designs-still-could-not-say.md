# The five things the reference designs still could not say

[ADR 0062](0062-a-token-bag-is-scoped-to-the-box-that-carries-it.md) gave the
vocabulary an answer to *where* a token applies, and that was the large half of
what the sixteen-design reference set needed. It was not all of it. Transcribing
three of those designs node for node — the working tool at
*The Scope Editor* — found five gaps, and each one is a
thing **thirteen or seventy-one of the sixteen designs do** rather than a thing
one of them wanted.

| | what could not be said | how many designs do it |
|---|---|---|
| `media` | type ON a picture, spread to its edges | 13 of 16 |
| `\n` | a headline that breaks its own line | every headline in the set |
| `%b` | a run of words lifted inside a sentence | 71 uses |
| `notch` | a punched perforation | 1 — and nothing else can reach it |
| a token as a value | a scope that follows the theme | every scoped colour |

None of them is a canvas, and none of them moves a box. The ceiling ADR 0061
named and 0062 partly lifted is unchanged: **a merchant may change anything
about a box and not where the boxes are.**

## `media` — the second layout that paints

ADR 0062 says, in the section on what a bag needs to draw it:

> *A photo pane is a `panel`, and there is no `media` node. `bg-image` +
> `overlay` + `min`, in a `split` pane. A second child-key shape would have cost
> four files an edit and a hardcoded test a branch, to buy content spread
> top-and-bottom rather than stacked. A `spread` param buys that back if a
> design needs it.*

Every clause of that is true and the conclusion was wrong, because the cost
estimate was right and the benefit was described as one design's preference.
**Thirteen of the sixteen designs put a wordmark at the top of one photograph
and a display line at the bottom of the same one.** The spread is not something
a design might want on top of a photo pane; it is what putting type on a picture
*is*. A masthead and a headline stacked at the top of the art with the bottom
two thirds empty is a different design, and a worse one.

So it is a layout rather than a `spread` param on `panel`, and the reason is
the one that decides every question like it in this vocabulary: **a param is
right where two designs disagree about a detail, and a member is right where
the two are different things.** A painted box and a picture with type on it
have different defaults for `min` (load-bearing here, a nicety there),
different treatment of `overlay` (a layer under the words here, a background
wash there), and different names in front of the merchant. One member with a
flag would have had to explain all three.

**It takes `panel`'s picture reset**, which is the half that reads oddly: a
`media` with no `bg-image` in its own bag draws the design's *ground* and not
its photograph. Inheriting would mean a design's one picture painted a second
time at a second size, which is exactly the defect the reset was written for —
and an empty box waiting for a picture is a more useful thing to be handed than
the design's own art repeated.

**The overlay is a `::before` and not a background layer.** On `.wc-root` and
`.wc-panel` the wash is painted into `background-image` above the picture,
which is right where the box's own text is what is being made legible. On a
`media` the children sit *on* the picture, so a wash in the background would
darken the photograph and the words on it equally. A pseudo-element sits
between the two, and the children take `position: relative` to clear it — no
extra markup, one rule.

## `\n` — the break the renderer was eating

`SlotFields` has handed the merchant a `<textarea>` for body copy since it was
written, so a newline was always typeable. `render.ts` set `textContent`, so
every one of them collapsed to a space and **nothing anywhere said so.**

Where a display headline breaks is most of what it is. *"Room ⏎ to grow."* is
one heading and two lines; two `heading` nodes with a gap between them is a
different thing that only looks similar at one width, and it costs a Slot Role
that then has to be filled in tree order.

Each line is a text node and each break is a real `<br>`, so this is one more
place that does not reach `innerHTML` — [ADR 0013](0013-content-not-capability.md)
is unchanged rather than widened. An empty line writes the `<br>` and no text
node, which is what makes a deliberate blank line survive.

It also changes one control: `text` on a `heading` now takes a `<textarea>`
like every other sentence. The rule it replaces said *"a headline is one line
by construction"*, which was true for exactly as long as the renderer ate the
break.

## `%b` — the second placeholder, and why there are two

*"Take **10% off** your first order"* is 71 sentences across the set. It was
expressible as two paragraphs or not at all.

The machinery already existed: a sentence carries `%s`, the renderer splits on
it and constructs the `<a>` itself. Emphasis is that again with a `<strong>` —
**and its own mark rather than a second filler for the same one.** One mark
with two claimants would need a rule about which wins, decided inside
`render.ts`, that nothing on the merchant's screen could explain. Two marks
means *"Take %b, and read our %s."* is one sentence with both and the split
does the telling apart.

> Extended by [ADR 0078](0078-editor-choices-stay-compact-and-scrollable.md): text and consent also carry an italic phrase at %i, under the same plain-text and one-phrase rules.

Every rule `%s` has, `%b` takes: one per sentence, a second is literal text, and
a mark with nothing to fill it renders nothing along with the space in front of
it. That is one rule for both rather than two that could drift — and it is
asserted from **both languages**, because `WConvert\Lead\ConsentRecord`
composes the same sentence in PHP for the [[Consent Record]] and evidence that
disagrees with what was shown is evidence of nothing.
`tests/fixtures/consent-sentences.json` grew six cases and both suites read
them.

**Weight and nothing else.** A colour is the obvious second declaration and is
the wrong one: the same `%b` sits in fine print, which is already
`--wc-muted`, so tinting it `--wc-accent` would put the loudest colour in the
design on the quietest line in it. `color: inherit` is the feature — an
emphasised run is the sentence around it, said harder.

## `notch` — the one ornament scoping cannot reach

Of the eighteen pseudo-element uses in the reference set, seventeen are a token
in disguise. The photo scrims are `overlay` once it is scoped; the tick bullets
are `icon` nodes we already ship; the rings and frames are the `image` data URI
nine designs already use.

The ticket's punched perforation is the one that is not, and the reason is
worth stating precisely: **a notch has to REMOVE the popup, and the ground
behind the hole is the merchant's own page.** No background layer can name
that. It is a `mask` — the only one in the product and the only new CSS
property in this whole line of work.

A boolean on `panel` rather than a size or a member, and a modifier attribute
rather than a custom property, for `edges`'s reason: the stylesheet may read no
`--wc-*` name outside the tokens and the declared layout params, and a hole is
one of two states. `false` writes no attribute, so a design that never heard of
the param renders byte-identically to one that spells the default.

`mask-composite: intersect` is what makes two radial gradients one shape, and
**the default composite is `add`** — so an engine that does not understand the
property draws a panel with no notches rather than a panel with no corners.
That is the only degradation worth having, and it is what makes the `-webkit-`
pair a courtesy rather than load-bearing.

**A notch is only visible where the halves paint and the popup does not**, which
is a design consequence rather than a renderer one and was found by looking:
punch a hole in a blue panel sitting on a blue `.wc-root` and the hole shows
blue. `punched-ticket` therefore sets `bg: "#0000"` on the design and paints
each half of the ticket, so the perforation shows the page. That is a sentence
worth having in `GUIDELINES.md` rather than a change to the mask.

## A token as a VALUE, so a scope follows the theme

This is the smallest of the five and the one with the widest reach.

A theme sets the design's colours. A scoped bag re-declares them further in —
and written as a hex, `{"bg":"#263f2c"}` on a panel survives every theme the
merchant tries. **So the deeper a design is styled, the less a theme does, and
the box a merchant most wants to follow the palette is the one that never
will.** Twelve themes and forty-nine designs is exactly the scale at which that
stops being a curiosity.

`{"bg":"accent"}` follows it, and **it resolves in CSS rather than in the
renderer**: the value becomes `var(--wc-accent)`, answered at the element by
whatever is in scope. There is no resolution order to define, no walk of the
tree, and a theme applied after the render moves it too — which is the same
argument ADR 0062 made for why scoping itself cost almost nothing.

Closed to the seven colour names, declared in the manifest's own `referable`
section so the admin can offer the conversion and the parity suite can assert
both sides. `pad` following `gap` is a coincidence rather than an intent.

**A name referring to itself is written verbatim.** `var(--wc-bg)` on `--wc-bg`
is a cycle CSS discards, which would silently unset the one property the author
was trying to set.

## What it cost

Measured, not estimated.

| | before | after |
|---|---|---|
| Pro elite loader, gzipped | 10,426 B | 10,817 B (budget 12,288) |
| The richest shipped design | 798 B | 910 B (cap 1,024) |
| Ten of it on one page | 1,390 B | 1,570 B (budget 2,048) |

**The page budget is what nearly refused this**, and it is worth recording how.
`PayloadBudgetTest` puts ten copies of the *richest* shipped design on one page
with different words in each, which is a worst case rather than a
configuration. `fieldwork` as first authored came to 2,259 B against 2,048 —
and the fix was **not** a budget change. It was: shorter art (one SVG at 370
chars instead of 589), two fine-print lines merged into one that breaks its own,
and two tokens deleted because they spelled the manifest's own default. That
brought the design from 1,036 B to 910 B and the page to 1,570 B, which is more
headroom than the library had before.

That is the honest reading of the artifact's own warning — it predicted the
budget would bind and said *"either the budget moves, or a page carrying ten
rich designs is not the case we design for"*. Neither was needed yet. It will
bind again, and when it does the recorded fix is still the one ADR 0010 named
and rejected.

> *Corrected by the port of six reference designs.* **It bound again, and the
> recorded fix did not work.** The six came to 2,192–2,293 B at ten, and
> stripping every SVG and gradient out of them still measured 2,087–2,108 B —
> shorter art bought nothing, because on that page the art dedupes across the
> ten copies and the diverged copy does not. So the warning's second horn is
> the one taken: **a page carrying ten rich designs is not the case we design
> for.** The fixture measures five, the costliest design measures 1,854 B of
> 2,048 at it, and ADR 0010's budget is untouched.
>
> The art-stripped run also went green, which is the part worth keeping: with
> the art gone the *picker* went back to `fieldwork` at 2,025 B, so the guard
> would have passed while three shipped designs were over. It chose by one
> snapshot gzipped alone; it measures the page now.

## Two designs, because a param no design uses is a word in a menu

`grid`'s own deletion note says it: *"a layout that cannot be configured and is
demonstrated by nothing is a word in a menu."* So slice one lands with the
designs that exercise it.

- **`fieldwork`** — a photographic split popup. `media` with a wordmark spread
  against a display line that breaks its own, `%b` in the offer sentence.
- **`punched-ticket`** — a two-half ticket popup. `notch` on the lower half,
  `edges: block-start` as the tear line, the `3xl` step on the numeral, and a
  design whose own ground is transparent so the perforation shows the page.

## Consequences

- Six layouts, and `facets.shape` gains a chip. The order of that list is
  asserted against the manifest's layout keys, so `media` is last in both.
- `text` and `consent` gain one content key. `TemplateLabels::keys()` names it,
  and a Playbook supplying the structured form fills it like `link`.
- One more `%`-mark in merchant-facing copy. `SlotFields` says where it goes,
  in the same breath as the box that holds the words, because a control whose
  value renders nowhere is what [ADR 0054](0054-every-control-has-the-shape-of-its-value.md)
  rule 3 forbids.
- `VOCABULARY.md` is generated, so all five arrive in the design spec without
  being written twice. The prose the generator carries did have to grow.

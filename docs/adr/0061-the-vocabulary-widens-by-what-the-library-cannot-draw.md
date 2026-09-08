# The vocabulary widens by what the library cannot draw

The builder has no canvas. [Issue #15](https://github.com/navidkashani/wconvert/issues/15)
settled that and named the consequence: **the design library is the entire
design surface of the product.** If the library is thin, the product is thin,
and there is no canvas for a merchant to escape into.

Growing it from 20 designs to ~42 asks a question the library has never had to
answer before, because twelve designs could all be arrangements of the same
twelve leaves without anybody noticing. Forty cannot. So: **does the vocabulary
widen, and along which axis?**

This ADR records the fork, the rung taken, and — more usefully — the two rungs
not taken and what would reopen them.

## The three rungs

**Rung 1 — tokens only, no code change.** Token *names* are checked and token
*values are not* ({@see \WConvert\Template\TemplateVocabulary}, which reads
`choices` for no purpose at all), and
[ADR 0054](0054-every-control-has-the-shape-of-its-value.md) states outright
that `choices` is *"an offer, not a limit"* — seven of nine designs already ship
a `shadow` from outside the chips. So gradients through `bg-image`, `overlay`
washes over photographs, asymmetric `pad`, `clamp()` widths and arbitrary radii
**all work today**, with nothing edited.

**Rung 2 — widen the leaf set.** Add nodes to the closed twelve. Costs the
manifest, `render.ts`, `css.ts`, `TemplateLabels` and both parity suites per
member.

**Rung 3 — widen structurally, with per-node styling.** Every design's look is
22 **global** custom properties, so nothing can tint one panel, or give the form
a different ground from the headline. That is the real ceiling.

> *Reopened and taken, in part, by
> [ADR 0062](0062-a-token-bag-is-scoped-to-the-box-that-carries-it.md).* **A
> token bag is now scoped**: any LAYOUT node re-declares the same closed 22 for
> what is inside it. Read the rest of this section knowing that — and read [what
> would reopen rung 3](#what-would-reopen-rung-3) below, which is amended with
> an honest account of the evidence, because it was **not** the evidence this
> ADR asked for.

## Rung 2, and narrowly

Rung 1 is true and is not sufficient, and rung 3 is the wrong purchase.

**Rung 1 is real and it is the floor, not the answer.** Everything above about
unvalidated token values holds, and the theme work and most of the design work
rides on it. But a token is global by construction, so no value of any of them
can put a flash on a corner, box one string, or round one picture.
*(Amended by [ADR 0062](0062-a-token-bag-is-scoped-to-the-box-that-carries-it.md):
a token is no longer global by construction — a layout re-declares one for what
is inside it. The three ABSENCES named in this sentence are unaffected, which is
why the members admitted below are still the right purchase: none of them is a
colour decision.)* Those are not
colour decisions that a bolder palette reaches; they are absences.

**Rung 3 buys the largest thing and buys the wrong thing.** The visual teardown
of Depicter — the closest competitor in this ecosystem, a visual experience
builder with a canvas and 600+ templates — records its verdict as
`avoid: competing on canvas complexity or template quantity`. Per-node styling
is the first step onto exactly that ladder: every node grows a style bag, the
settings panel stops being 22 controls and becomes a per-node inspector, and
`PayloadBudgetTest` starts arguing with the design library over the same bytes.
It would also amend
[ADR 0010](0010-template-model-is-node-tree-plus-tokens.md)'s central bargain —
*configuration, not a document* — for a payoff the market says is not where this
product wins.

> *Amended by [ADR 0062](0062-a-token-bag-is-scoped-to-the-box-that-carries-it.md).*
> **Three of those four prices turned out not to be the price.** Only *layouts*
> carry a bag, not every node — a leaf has no inside for a scope to apply to.
> The panel stays the same 22 controls, bound to a selection instead of only to
> the root, so it did not become a per-node inspector of new controls. And the
> budget did not move: `PayloadBudgetTest` measures 1,308 B of 2,048, and the
> instrument changed (measure the richest shipped design; cap per design in
> `LibraryLintTest`) rather than the budget. ADR 0010's bargain is untouched
> because the names stay closed and the bag goes through the same validation the
> design's tokens do.
>
> **The Depicter verdict is not overturned and is the reason the line sits where
> it does.** What 0062 bought is *ground*, which is what this ADR's own
> reopening clause named; what it refused is *placement*, which is where a
> canvas begins.

So the widening is **rung 2, admitted one member at a time, and the admission
test is the title of this ADR: a member earns its place by naming something the
library provably cannot draw.** Not something it draws awkwardly — `grid` +
`row` + `icon` + `text` is a verbose benefit list and it is a benefit list — but
something for which there is no tree at all.

Three members passed that test. Nothing else was added, and the count is the
point: a vocabulary that grows by what feels missing grows forever.

### `code` — the static shared discount code

The success step had nowhere to put the payout. Every high-value Playbook in
the catalogue (welcome discount, VIP offer, cart rescue) ends in a code, and the
only place to put one was inside `success_body` prose — which is where a code is
least readable and least retypable.

`text` cannot be made to look like a code, because the only lever it has is
`--wc-font`, which is the whole design's face. Boxing one word would have meant
setting the entire popup in monospace.

**[ADR 0025](0025-cart-recovery-captures-nothing.md) had already decided what a
code may be here, and it decided in favour of this node**:

> *only a static shared code can ever appear, and a static code the merchant
> already created in WooCommerce is just words they type into the copy.*

The payload is baked into HTML the full-page cache serves byte-identically to
every visitor, so a per-visitor code is impossible in this delivery model rather
than merely unwise. This node is the shape that fact leaves behind: one string,
identical for everyone, minted by nobody.

**It therefore does not reopen
[ADR 0053](0053-the-spin-to-win-card-is-withdrawn.md).** The wheel was withdrawn
because a prize wheel needs a code *per visitor*; this is the opposite of one,
and the distinction is the whole of why one is refused and the other ships.

**No copy-to-clipboard, and that is a boundary rather than an omission.**
`navigator.clipboard` is capability, and this vocabulary expresses content and
never capability (ADR 0010). The element is `user-select: all`, so one tap takes
the whole string — the affordance a visitor on a phone actually reaches for, at
the cost of no event handler and no loader bytes.

**A Playbook cannot fill it**, which is correct rather than a gap: a coupon code
names a row on one particular site, and a Playbook can express nothing
site-local ([ADR 0013](0013-playbook-copy-carries-no-markup.md)). It arrives the
way the cart URL and the privacy link do — the design ships a placeholder and
the merchant types theirs in.

### `image.shape` — a circle

`.wc-image` takes `border-radius: var(--wc-radius)`, the design's **one** corner,
shared with the panel, the button and every input. So the round portrait beside
a testimonial could only be had by rounding the popup, the button and the email
box to match — which is a different design, not the same design with an avatar
in it.

One param, on the one node it is about, changing nothing else. Not a free
`border-radius` value: that would be a second corner token in the wrong place,
arguing with `radius` about the same picture.

### `badge.place` — the corner flash

The corner price flash is the single most recognisable element in this genre and
was not expressible at any value of any token, because placement is not
something a global custom property can say. `.wc-root` is already
`position: relative`, so it costs one absolutely-positioned rule pinned by
`--wc-pad` — which keeps it aligned with the content rather than floating in the
padding.

## What was considered and refused

- **A `list` node.** A three-benefit list is ten nodes today
  (`stack` → `row` → `icon` + `text`, thrice) and that is verbose rather than
  impossible. [ADR 0051](0051-a-slot-role-repeats-and-binds-in-order.md) already
  made the repeated `body` Roles bind in tree order, which is the half that
  would otherwise have been broken. Refused: it fails the admission test.
- **A `progress` step indicator.** Read as an ask from the research corpus and
  it is not one — `ux-surface-patterns.csv`'s *"state thumbnails remain
  visible"* is a **P0 for the merchant's editor**, a journey strip in the admin,
  not a visitor-facing node. With `steps[]` capped at two by the converting act,
  a visitor-facing *"1 of 2"* is decoration.
- **A third step.** The research's journey is *Teaser → Main → Success/Coupon*,
  which implies one. `steps[]` is 1 or 2 today, keyed to the converting act and
  asserted by `bin/verify-templates.php`. A teaser is a **mechanism** with
  loader consequences (a two-step click reveal is a trigger, an impression
  question and a dismissal question), not a design change, and it does not
  belong in a ticket about growing a library.
- **Per-node styling**, above.

## What would reopen rung 3

A design that a merchant demonstrably wants, that is not expressible, and whose
absence is about *ground* rather than about *placement* — the split with a navy
pane beside a white form is the canonical one. Three of those, from real
merchants rather than from a competitor's gallery, is the evidence that would
make the payload and panel cost worth arguing about. Until then the split's two
panes share the design's ground, and `bg-image` with a hard-stop gradient is the
honest approximation.

> ### It was reopened, and the evidence was a different kind
>
> *[ADR 0062](0062-a-token-bag-is-scoped-to-the-box-that-carries-it.md), which
> scoped the token bag to any layout node.*
>
> **The evidence was a 16-design reference set we commissioned** — a brief we
> wrote, answered by designs we asked for. That is not "three designs a merchant
> demonstrably wants, from real merchants rather than from a competitor's
> gallery." It is closer to the thing this paragraph was written to exclude, and
> saying otherwise would make this clause decorative.
>
> What actually carried the decision was two things this paragraph did not
> anticipate:
>
> 1. **The reference set's own source is a token bag per scope**, including a
>    nested one. So the question stopped being "should we buy per-node styling"
>    and became "the designs we want are already written in our architecture,
>    one level in" — a much smaller purchase than the one priced above.
> 2. **The canonical example named in this very paragraph** — the split with a
>    navy pane beside a white form — is what a scoped bag draws, in the terms
>    this sentence used.
>
> The honest reading is that the *admission test* held (ground, not placement)
> and the *evidence bar* was relaxed. Recorded so the next reader can weigh it
> rather than inherit it.

## Consequences

- Three members added; `TemplateVocabulary`, `PlaybookLibrary`, the admin's
  `catalogue.ts` and `panel.ts` needed **no change at all**, because every one
  of them already reads the manifest. That property is the reason rung 2 was
  affordable, and it is worth protecting.
- The free loader grew 189 B gzipped, to 8,025 B of a 12,288 B budget.
- `code_value` joins the closed Slot Role list, so it is bindable, translatable
  and carried across a design switch like every other Role.
- The corner badge and the circular image both default to what they already
  did, so every design shipped before this renders byte-identically —
  `tests/js/renderer-manifest-parity.test.ts` asserts exactly that for each.

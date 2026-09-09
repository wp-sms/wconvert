# The editor is the scope editor now

[ADR 0062](0062-a-token-bag-is-scoped-to-the-box-that-carries-it.md) gave the
vocabulary a scope and shipped a three-pane shell over it.
[ADR 0063](0063-the-five-things-the-reference-designs-still-could-not-say.md)
and [ADR 0064](0064-a-narrow-bag-is-the-same-bag-at-a-second-width.md) gave the
vocabulary the six things the reference designs needed. This is the eight
things the *editor* needed before a merchant could work in it.

Every one of them is a thing the screen could not do, found by transcribing
three reference designs into the shipping vocabulary and then trying to edit
them.

## 1. A box was not selectable, which is the primary gesture

`SLOT_SELECTOR` was `'[data-role],[data-captures]'`. **No container carries
either**, so a press on a coloured box reached the nearest leaf inside it —
and `image`, `icon`, `divider` and `countdown` were unclickable for the same
reason. A scope editor whose primary gesture is *select that box* could not
select a box.

`render()` stamps `data-path` on every element it draws, **only when the caller
asks**, through a `RenderOptions` flag `mount()` defaults to silence. ADR 0040's
whole addressing scheme goes with it — see the fourth amendment there, including
the half that is genuinely given up: a path *is* a way to reach a node, and a
Role was not.

**The listener is delegated**, and that is a consequence of the first change
rather than a tidy-up. A handler per element was safe while only leaves were
addressable — nothing was inside anything else. Boxes nest: a headline inside a
`media` inside a `split` is three handlers on one press, and the last to run is
the *outermost*, so pressing a headline selected the whole step. `closest` from
the press answers the other way round.

**A box is pointer-only, and the block tree is its keyboard route.** A `panel`
announced as a button would be named by every word inside it, and six nested
boxes are six tab stops between one headline and the next. The tree is a
treegrid over the same nodes, in the same region, before the preview in the DOM
— a route that already exists and is already asserted at length. The rule
generalises: a tab stop is made only where there is something to *name* it
with, so an `image` gets none either, because *Edit “”* is worse than no tab
stop.

## 2. The preview was a stage, not a page

`Preview` mounts `inline` whatever the Optin is. That is right for a gallery
card — a card is a picture — and wrong here: **two of the four
[[Display Type]]s are about where they sit.** A floating bar pinned to the
block-end edge of a page and a slide-in tucked into its corner are the whole of
what makes either a different design from a popup, and neither reads as
anything floating in the middle of an empty pane.

**The admin draws the page; the renderer draws the design.** Letting `mount()`
place it is closed off in free: free's `mount.ts` knows `inline` and `popup`,
and the two Pro containers live in `pro/resources/renderer/src/popover.ts` — so
a preview that asked the renderer for a bar would draw nothing on a free install
or put Pro's container in free's admin bundle, which
`bin/verify-source-contract.sh` refuses. It is also the truer division: what
Pro's container adds is the top layer, the anchoring and the motion, and what a
merchant judges here is the design against a page. Four CSS rules and a `<div>`
of grey bars.

The popup's wash reads the design's own `backdrop` token, because that is the
one thing about a popup that is not inside the shadow root — `DOCUMENT_CSS`
puts it on `dialog::backdrop` for exactly that reason.

**There is no display-type switcher, and that is not an omission.** A design
authored as a popup falls apart as a bar, which is why the gallery filters by
type in the first place; a switch here would need the design swapped with it,
and that is what *Browse designs* is.

## 3. The width control was preview-only

`device` set `--wconvert-stage` and changed nothing about what was edited. With
a second bag per box (ADR 0064) that is half a feature: the switch that decides
which width is on screen now also decides **which of the two bags the inspector
writes to**, so a merchant sets the narrow values while looking at the narrow
render. That is what makes it a mode rather than a second panel of twenty-four
more controls.

**It was called `desktop` | `mobile` and is called `own` | `narrow`.** The
narrow bag is measured against the design's own container, so an `inline` Optin
in a 280px sidebar is narrow on a desktop and a control labelled *Mobile* says
the opposite. The narrow preview is drawn at **22rem**, inside the renderer's
own breakpoint — a stage at a phone measure of 375px with the breakpoint at
384px would have drawn the full-width design under a control that says *Narrow*
and edited values nothing on screen was using.

**And the breakpoint moved to 24rem**, which is derived rather than chosen: it
is where a `split` stops being side by side, since a pane's `flex-basis` is
`12rem` and there are two of them. Retuning at the width the layout gives up at
means the two cannot disagree. A phone measure would have been the obvious
number and is the wrong one — the common ones straddle it (360, 375, 390, 412),
so half the phones in circulation would have wrapped without retuning or
retuned without wrapping.

## 4. The theme picker was inside the panel that hides

`Tokens` renders only while nothing or a whole step is selected — anything else
is that box's own bag. The ready-made looks were its first group, so
**selecting a headline hid the theme picker**, and a merchant restyling a box
had to deselect to change the palette they were restyling *against*.

A theme sets the design's tokens whatever is selected, so it belongs over all
three panes. **Moved rather than repeated**, because two theme pickers is the
same defect two controls for one token is (#71): a merchant can watch them
disagree. A popover rather than a `Select`, because the swatches are the whole
affordance ([ADR 0054](0054-every-control-has-the-shape-of-its-value.md) rule
3) and a toolbar has one line.

The trigger shows the current palette's name, or *Custom look* where the design
matches none — a picker showing the first preset would be claiming a palette
the merchant is not on.

## 5. A token said where it came from and never that it was set here

`SourceNote` spoke only for *from another box*, which was right when that was
the one invisible answer. With two bags there are two ways for a value to be
*this box's own*, and **the reset button appears for both** — so *set here* and
*set for narrow only* looked identical, and a merchant editing at narrow could
not see which they were looking at. Both speak now; *from the design* and *the
default* still say nothing, because they are what a merchant assumes.

## 6. `→ token`, so a scope survives a theme

ADR 0063 made a colour value able to name a colour token. This is the press
that writes one: offered where the value is a literal colour the merchant set
on *this* box and the token has one it can sensibly follow, and not offered
otherwise — a `→ Highlight` on a value that already reads `accent` would be a
control that changes nothing.

**The mapping is not the identity**, which is the one thing it could not be:
`--wc-bg: var(--wc-bg)` is a cycle CSS discards. So a token follows the one a
palette would pair it with, which is also what the press means — *make this box
the accent colour*.

## 7. What a box actually stores

Every control in the panel answers *what does this token resolve to here*,
which is the merchant's question. The author's is the other one: **what did I
set, and what am I paying for it** — because a scope is repeatable, it nests,
and twenty-four controls showing inherited values look exactly like
twenty-four showing set ones until you read the reset buttons.

A `<details>`, closed, printing the box's own two bags and not its children. On
for everybody rather than behind `dev` unlike `DevExport`: that one hands over
the whole tree and takes one back, which is an editing surface; this is a
readout of one node.

## 8. Checks cited nothing, and a restyled box looked untouched

**A warning nobody can trace is a warning people learn to dismiss.** The six
checks are not one kind of thing: two are refusals the server makes at the
write, two are rules the vocabulary or the renderer imposes, and two are
nothing but `problems.ts`'s own opinion about what will cost the merchant
later. *The save will refuse this* and *nothing will ever mention this again*
are the two ends of that, and a chip that looks identical for both teaches a
merchant to ignore both.

`CHECK_SOURCES` is **per check rather than per problem**, which is the shape the
work was specified the other way round. A passing chip has a source too — *six
checks pass* is only legible if a reader can see what was doing the checking —
and a field on `Problem` could cite one only while something was wrong. Not
translated, deliberately: these are class names and ADR numbers, and a
localised class name is one nobody can grep for.

**And the tree carries a count.** A bag applies to a box and everything inside
it, and nothing about a row said which boxes carried one — so after restyling a
design box by box, finding the nine tokens set on the second panel meant
selecting every panel and reading the reset buttons. A count and not a dot,
because the number is the fact a merchant acts on: *nine* says this box is where
the design's look lives and *one* says somebody nudged a padding. `9+2` is nine
at full width and two more at narrow, which is also the payload's shape.

## What it cost

| | before | after |
|---|---|---|
| Pro elite loader, gzipped | 11,177 B | 11,270 B (budget 12,288) |

93 bytes, all of it `data-path`, and none of it on a visitor's page.

## Consequences

- `slots.ts` is a join and a parse. `SlotKey`, `keyOfSlot`, `roleKey`,
  `capturesKey` and the ordinal machinery are gone, and `Selection` has one
  field where it had two.
- `Preview` asks the renderer for addresses whenever it has an `onSelect`, so
  the gallery still pays nothing — one line rather than a decision at every
  call site.
- The width switch's accessible name is *The design's own width* and not
  *Full width*, because the Fullscreen toggle three controls along already
  answers to that.
- `Block` carries `sets` and `setsNarrow`. Zero for a leaf, always: a leaf's
  `tokens` is dropped on the way in, so a count on one would be about a key the
  vocabulary does not keep.
- Not in this editor: **the author/merchant mode toggle.** The reference tool
  offers one and it was declined — Sarah gets one editor. A mode that hides the
  tree and the scopes from a merchant is a product decision that would be
  settled by shipping it, and every argument for it is an argument about who
  should be *taught* scoping rather than about what the screen can do.

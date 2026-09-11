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

**Amended by [ADR 0067](0067-the-editor-starts-with-the-preview-and-the-selected-element.md):** the approved workspace uses a fit-to-space editing canvas and a local form preview. The mock-page treatment below is superseded; actual site placement remains the display runtime’s responsibility.

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

**Amended by [ADR 0067](0067-the-editor-starts-with-the-preview-and-the-selected-element.md):** controls are labelled Desktop and Mobile for merchants. The stored bags remain `tokens` and `narrow`, and responsiveness still follows the container. The historical naming rationale follows.

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

## The look, measured rather than eyeballed

Everything above is behaviour. This is the pass over density and type against
the reference tool, done in a real WordPress at 1280 and 1680 with the menu
expanded and folded, LTR and RTL — because jsdom computes no layout and every
one of these was invisible to the suite.

- **The check strip read as debug output.** Six chips carrying
  `OptinController::refuseADesignThatCapturesNothing()` in a monospace register
  wrapped onto three lines across the top of the tab. `CHECK_SOURCES` is two
  strings now: a short name for the chip and the sentence for the tooltip.
  _Completed by [ADR 0066](0066-the-editors-chrome-is-one-card-with-three-named-panes.md):
  shortening the strings was half of it. The strip was still six monospace chips
  across the TOP of a work surface, announcing the quietest fact on the tab as
  loudly as anything on it; it is a band at the bottom now, and the sources are
  `--text-meta` rather than hidden below 62rem by a container query._
- **`media`'s label ran under the row's ⋯ menu.** *Picture with text on it* is
  twenty-three characters on an 11rem tree; it is *Picture box*, and what it
  does moved to the note where it belongs.
- **A scope's Style tab was ~1,600px of column** against the design panel's
  two-thirds of that, with the same twenty-four controls. The colour group uses
  the palette grid the design panel already has, and `.wconvert-palette`'s floor
  went from 11rem to 9.5rem — measured, because 11rem fits exactly one column in
  a 22rem inspector, so the grid had been drawing a column of full-width rows on
  the only screen it appears on.
- **The theme trigger read as a toggle.** Three overlapping circles beside one
  word inside a small outline button is a switch; on the toolbar they are
  squared and unoverlapped, and the preset cards keep the circles.
- **A source note and its `→ token` press ran together** as *Set on this
  box→ Button*.

**Two things were tried and reverted, and the reason is worth more than the
change.** Making the row's name truncate rather than overflow looks like the
obvious fix for the label problem and is worse: the row's furniture is 176px of
a 254px pane, so every leaf came out as *Yo…*. _The furniture is smaller under
[ADR 0066](0066-the-editors-chrome-is-one-card-with-three-named-panes.md) — 24px
action cells, a 12px depth step, an 11px kind — and this conclusion is unchanged:
a name may still not jump or truncate under a pointer. What shrinking bought is
that the ordinary row no longer needs the scroll._ `flex-shrink` weights do not
save it — the deficit is bigger than the words are — and collapsing the two
hover-only action cells would make every row's name jump under the pointer.
The pressure goes on the labels instead, which is why `media` is two words.

**The type register needed nothing.** The plan's decision was to keep the
admin's 12px floor and take the artifact's `.04em`/600 — and `--text-micro` is
already 12px/.04em/600 (ADR 0037). Mono is used where the content is genuinely
code: the check sources and the stored-JSON readout.

_Corrected by [ADR 0066](0066-the-editors-chrome-is-one-card-with-three-named-panes.md):
**it needed two roles, and "the admin's 12px floor" was not a thing this admin
had.** ADR 0038 sets contrast ratios, a blocking lint, pointer targets and
viewports — no minimum font size. The floor was invented in a comment in
`index.css`, cited to that ADR, and believed here; it is why this pass shipped
the behaviour and left every surface a step or two too large. `--text-label`
(11px) and `--text-meta` (9px) are the artifact's own values, and the row's kind
— which stated no size at all and inherited 14px body — is what the first one was
for._

## Verified on a real WordPress

Playground, both plugins mounted, per CLAUDE.md — a green suite is not a
booting plugin.

- The admin boots with no console errors and no 404s; every REST route answers
  200; the builder loads a `fieldwork` Optin, selects the `media` container,
  edits its scoped tokens and switches width.
- **A visitor's page carries no addresses.** The popup mounts, and
  `querySelectorAll('[data-path]')` inside its shadow root returns **0** —
  which is the whole of what `RenderOptions.paths` promises. `media`, the two
  `<br>`s and the `<strong>` all render.
- **The bundles have to be rebuilt in pairs, and this is how that is found.**
  Pro *deregisters* free's admin script, so the browser was loading
  `wconvert-pro/public/admin/main.css` while `npm run build:admin` had been
  rewriting free's — three rounds of "the CSS did not change" before the
  stylesheet URL was read out of the page.

### One defect found and deliberately not fixed

**A `popup` renders pinned to the top-left of the viewport rather than
centred**, and it is not this work's: verified identical with `main`'s loader
built from the merge-base. `DIALOG_ARMOUR` in `mount.ts` sets `inline-size:
auto` and `block-size: auto` beside `inset: 0` and `margin: auto`, and for a
fixed-position box that means *stretch to the inset box* — so `margin: auto`
has nothing to distribute and the design sits at the start of a
viewport-sized dialog. Fixing the shipped popup container is a decision of its
own and needs verifying across all four [[Display Type]]s.

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
- `Block` carries `sets` and `setsNarrow`. **Amended by [ADR 0067](0067-the-editor-starts-with-the-preview-and-the-selected-element.md):** leaves can now retain both bags and report their override counts.
- Not in this editor: **the author/merchant mode toggle.** The reference tool
  offers one and it was declined — Sarah gets one editor. A mode that hides the
  tree and the scopes from a merchant is a product decision that would be
  settled by shipping it, and every argument for it is an argument about who
  should be *taught* scoping rather than about what the screen can do.

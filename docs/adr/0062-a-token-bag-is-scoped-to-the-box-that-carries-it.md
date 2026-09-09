# A token bag is scoped to the box that carries it

Any layout node may re-declare the design's tokens for itself and everything
inside it. The **names stay closed**; what is new is an answer to *where*.

```jsonc
{ "type": "stack", "tokens": { "bg": "#fff4df", "fg": "#331e17" },
  "children": [ … ] }
```

That is the whole change. It is not a style attribute, not a class, not a
per-node CSS bag: it is the object a design already carries at the root,
written one level in.

## It was found rather than invented

A 16-design reference set was commissioned to show what the library is missing,
and reading its **source** settled the design question before the design
discussion started. Those pages are not hand-styled documents. They are one
shared component stylesheet plus a token bag per design — fifteen custom
property names, 123 declarations, twelve design scopes. Our architecture,
arrived at independently.

One of those scopes is nested:

```css
.sale-result{ padding:32px; border-top:8px solid #f45a31;
  --paper:#fff4df; --ink:#331e17; --soft:#664b3b; --rule:#d7bda4; }
```

A container re-declaring the same names for what is inside it. Every design in
that set that reads as two materials — a cream panel beside a dark one, a form
on its own ground — does it exactly that way, and none of them needs a second
mechanism to do it.

## Why it costs almost nothing

**Custom properties already inherit.** There is no cascade to implement, no
resolution order to define, and no runtime cost beyond the `setProperty` calls
that write the bag. A leaf reads the nearest bag above it because that is what
the CSS engine does with an inherited property; `render.ts` gained one
four-line function, used at two scopes.

**The names stay closed, so there is still nothing to sanitise.**
[ADR 0010](0010-templates-are-configuration-not-documents.md)'s central claim —
a template has no CSS, so `wp_kses` does not apply to it — is unchanged, and it
is unchanged *because* the bag goes through the same closure the design's own
tokens go through. That was not free. `TemplateVocabulary::node()` copied every
declared param verbatim, which is correct for a scalar and is a **property-name
injection** for a map: an arbitrary key would have reached
`element.style.setProperty('--wc-' + name, value)`, in the one place ADR 0010
says none exists. The fix is a clause beside the `link` and `href` ones, reusing
the private `tokens()` that already validated the design's bag.

**The merchant's model does not grow.** The Style controls are the ones the
Design tab already had; what changed is that they are now addressed at a scope
rather than only at the root. Selecting the step gives you the design's own
tokens, the way the Design tab always did.

## What it deliberately does not buy

**Arrangement.** There is no per-node `class`, no `style`, no positioning, and
nothing that moves a box somewhere the layout did not put it. Sarah can change
anything about a box — its words, its ground, its edge, its corner, its spacing
— and not where the boxes are. If she wants the photo on the other side, she
picks a different design.

That line is where the canvas would start, and
[ADR 0061](0061-the-vocabulary-widens-by-what-the-library-cannot-draw.md)'s
Depicter teardown recorded the verdict as *avoid competing on canvas complexity
or template quantity*. The line held; the bet
([#15](https://github.com/navidkashani/wconvert/issues/15): the library is the
design surface) is unchanged, and this is what makes the library able to hold up
its end of it.

## The evidence is a different kind than 0061 asked for

ADR 0061 declined per-node styling as *rung 3* and named what would reopen it:

> Three of those, from **real merchants** rather than from a competitor's
> gallery, is the evidence that would make the payload and panel cost worth
> arguing about.

**What we have is a reference set we commissioned.** Not merchant demand — a
brief we wrote, answered by designs we asked for. That is a weaker warrant than
the one 0061 specified and it is recorded here rather than dressed up, because
an ADR that quietly relaxes its own admission test teaches the next reader that
the tests are decorative.

Two things make it worth reopening anyway, and both are about the *shape* of the
purchase rather than the strength of the demand:

1. **0061 priced rung 3 as "every node grows a style bag" and a settings panel
   that "stops being 22 controls and becomes a per-node inspector."** Neither is
   what landed. Only **layouts** carry a bag — a leaf has no inside for a scope
   to apply to — and the panel is the same 22 controls bound to a selection. The
   cost 0061 refused is not the cost that was paid.
2. **0061's own canonical example is this one.** *"The split with a navy pane
   beside a white form"* is named there as the design whose absence is about
   ground rather than placement. It is now expressible, in exactly the terms
   that sentence used.

The payload half of 0061's objection was measured rather than argued: see the
consequences.

## A bag needs something that draws it

`stack`, `row`, `split` and `grid` arrange and paint nothing. The design's
ground is `.wc-root`'s and there is exactly one of it — so a `stack` carrying
`{"bg":"#fff4df"}` tints only what inside it happens to read `--wc-bg`, which is
a text colour on a paragraph and not a cream box.

**`panel`** is the fifth layout: a `stack` that draws the tokens in scope as a
box — ground, picture, wash, padding, corner, edge — plus two params of its own,
`edges` (a rule above, an outline all round, or neither) and `min` (a floor
under its height). It is the whole of what makes the reference set's two-material
designs expressible.

Two things about it are worth stating because neither is obvious:

- ~~**A photo pane is a `panel`, and there is no `media` node.**~~ `bg-image` +
  `overlay` + `min`, in a `split` pane. A second child-key shape would have cost
  four files an edit and a hardcoded test a branch, to buy content spread
  top-and-bottom rather than stacked. A `spread` param buys that back if a design
  needs it.

  > *Amended by [ADR 0063](0063-the-five-things-the-reference-designs-still-could-not-say.md):
  > this originally read* "a photo pane is a `panel`, and there is no `media`
  > node" *— and `media` is the sixth layout now. Every clause above is true and
  > the conclusion was wrong: the cost estimate was right, and the benefit was
  > described as one design's preference when* **thirteen of the sixteen
  > reference designs put a wordmark at the top of one photograph and a display
  > line at the bottom of the same one.** *The spread is not something a design
  > might want on top of a photo pane; it is what putting type on a picture is.
  > A `panel` is still the right answer for a photo pane with nothing written on
  > it.*
- **A panel inherits the design's colours and not its picture.** It paints the
  same two background layers `.wc-root` does, so one `bg-image` on the design
  would be painted again — cover, centred — inside every panel in it. `render.ts`
  resets `bg-image` and `overlay` on every panel *before* the bag is applied, so
  a photo pane's own picture still wins.

## Two tokens, and each closes a hole the panel opened

- **`input-bg`.** A field took the design's own `bg`, which was right while
  there was one surface and is wrong the moment a panel paints a second: a light
  form on a navy panel had a navy input with light text in it, and the input is
  the one control a visitor MUST find. `['fg','input-bg']` joins the AA contrast
  pairs for exactly that reason.
- **`heading-font`.** Eight of the sixteen reference designs set a display face,
  and a design had exactly one face for everything.

**Both chain to the token they replaced** — `var(--wc-input-bg,var(--wc-bg,#fff))`
— so every design shipped before them renders identically. That chain is the one
thing the manifest cannot spell: a default is one string, and no string means
*whatever `bg` is*. So it is spelled a second time, once, in
`resources/admin/src/builder/panel.ts`'s `resolvedToken`, because the contrast
check reads a resolved value and a manifest `#ffffff` would have reported a dark
design's near-white text as unreadable on a white field no visitor sees.

## And one step that is not a token at all

`size` — six steps on the type scale (`3xl 2xl xl m s xs`) on `heading` and
`text`, as a **modifier class**. It is in this ADR because it is the other half
of the same design: a scoped bag paints a box, and `size` is what puts *"15%"*
at 90px beside its own sentence at 24px inside it. The most recognisable move in
the genre, and unexpressible until now — a design had one heading size and one
text size.

**It cannot be a custom property, and that is forced.** The parity suite asserts
the stylesheet reads no `--wc-*` name outside the declared tokens and the
declared LAYOUT params; a node param is neither, so `--wc-size` — or a
`--wc-scale` under any name — fails the build. The same rule `badge.place` and
`image.shape` are already modifier classes for. `m` adds no class, so a design
that spells the default renders byte-identically to one that does not.

**A step multiplies the leaf's own size token rather than replacing it**, so
`heading-size` still sets the scale and the merchant's one lever moves all six
together. That costs ten CSS rules rather than five, because a heading scales
`heading-size` and a paragraph scales `text-size` and the obvious compression is
the custom property the test forbids.

It also separates two questions that were one key: `heading.level` is the
document outline, `heading.size` is how big it is drawn. A design with a display
number and a subtitle needs a small `h2` and a large `h3`.

## The editor that edits them

**The Design tab dissolved into the inspector**, exactly as `SettingsPanel`
dissolved into `SlotFields` / `Tokens` / `DevExport` before it. A token has a
scope now — the design's own, or one box's — and *which box* is a **selection**,
which is the question the inspector already answers. So the token controls come
to the selection like every other control on this screen, choosing a design
became a row above the panes, and the tab that held both had nothing left in it.
Four tabs became three, and one concept replaced two.

```
┌ Structure ─┬─ Preview ──────────┬─ Inspector ─┐
│ block tree │ the live render    │ Content     │
│ 16rem      │ ≥31rem             │ Style       │
└────────────┴────────────────────┴─────────────┘
```

**Everything is reused.** `BlockTree` (the ARIA treegrid vendored from
Gutenberg, ADR 0036), `BlockInspector`, `SlotFields`, `Tokens`, `Preview` with
`slots.ts`'s key mapping, `structure/history.ts`, `structure/guards.ts`,
`useBlockDrag`. Four things are new:

- **`ScopeStyle`** — the token controls `Tokens.tsx` already renders, bound to
  the selected box's bag. It adds no control. What it adds is the three things a
  scope makes necessary and a global set never did: what a token *resolves to*
  here (the nearest bag above the block, which is what the browser reaches by
  inheriting), *where that came from* (only the surprising answer speaks — a
  value from another box, with the way to that box), and *what clearing means*
  (at the design, back to the design's own; here, back to whatever this box sits
  inside).
- **The checks strip** — one chip per check, drawn whether it passed or not.
  The readiness verdict says what is *wrong*, which is right before publishing
  and wrong while restyling: a screen that says nothing has either checked six
  things and liked them or checked nothing, and a scoped bag can fail AA for a
  visitor in one press without a single number moving on the design panel. The
  six checks are the ones `problems.ts` already computed, including the
  role-less-leaf one from `catalogue.ts`'s `losesWordsOnSwitch`; each now names
  itself.
- **The payload meter** — this design's snapshot, gzipped, against
  `DesignBudget::PER_DESIGN`. Gzipped and not raw, via `CompressionStream`,
  because raw JSON is 3–4× the real figure and a meter that lies pessimistically
  teaches a merchant to ignore it. No `CompressionStream`, no meter — there is
  no honest way to print a figure in the wrong unit beside a budget.
- **The Full width toggle** — a class on `document.body` plus our own CSS hiding
  `#adminmenumain`, `#wpadminbar` and `#wpfooter`, which is the mechanism
  Gutenberg's own `FullscreenMode` uses. Remembered in `localStorage`, so it
  needs no endpoint; Escape exits; the class is removed on unmount, because
  `<body>` outlives this screen. **Default off**, because it costs the merchant
  their navigation — which is the thing people install plugins to undo in the
  block editor.

**A container query and not a media query**, at 65rem of container, following
the precedent already in `index.css` for the two-pane split: wp-admin's menu is
160px expanded and 36px folded, so a viewport-keyed breakpoint is wrong by 124px
on a folded menu.

### Two things the plan asked for that are not what shipped

**Below the breakpoint the panes STACK; the inspector is not a slide-over.**
A modal inspector was the plan and is not what landed. `StructureView` documents
that the inspector comes after the tree in the DOM *and therefore after it in
the tab order*, and a Radix dialog portals to `document.body` — which moves the
panel out of source order, adds a focus trap to a panel a merchant tabs in and
out of constantly, and would rewrite the 73KB of treegrid keyboard assertions
that guarantee any of it. Stacking is what already shipped at 48rem, it is the
arrangement ADR 0039's placement rule was written for, and it costs a scroll
rather than a modality. Full width is what buys room back.

**The inspector is now the second Tab stop out of the tree rather than the
first.** Three panes read *list · render · controls*, and the render is between
them in the DOM as well as on the screen, because a tab order that disagrees
with the visual order is the failure the grid would otherwise introduce. The
roving tabindex still gives the whole grid one stop; the preview's own two named
controls now sit between it and the inspector. Recorded rather than absorbed,
because the old guarantee was written down and this is not it.

## Three things the plan left open, decided

**Copy a scope's look — built.** Three boxes tinted the same way is the ordinary
case in a reference-class design, and the alternative is setting six tokens
three times and getting one of the eighteen wrong. *Paste* **replaces** rather
than merges: a merge leaves whatever the target already set and produces a box
that is neither what was copied nor what was there, which is a state nothing on
screen could explain. Undo pays for the bluntness, the same bargain a block
delete makes. The copied bag is the SCREEN's state and not the panel's, because
the act spans two selections — and deliberately not the system clipboard, since
a token bag is not text anyone would paste elsewhere and reading the real one
means a permission prompt for an act that never leaves this screen.

**A wordmark Slot Role — added.** Thirteen of the sixteen reference designs
carry a masthead, and a design had nowhere to put one: unbound it is a role-less
leaf, so the merchant's own shop name is thrown away at the next design switch;
bound as `headline` a Playbook writes the campaign headline into the logo. So
`wordmark` is a Role of its own on `eyebrow` and `heading`, and it is
**`authored`** — the second Role a Playbook may never fill, for exactly
`code_value`'s reason: a shop's name names one site and nowhere else, so a
Playbook filling it would ship somebody else's brand to every install that used
it. `ledger-card`'s masthead is the first to claim it.

**The narrow variant — not built, and the numbers are why it can wait rather
than why it cannot happen.** The reference set retunes at every breakpoint, and
a per-breakpoint bag is the item that doubles what a scope stores. The room
exists: the richest design ships at 677 B against a 1,024 B cap. What does not
exist is a design that needs it — every one of the five authored here holds at
320, 768 and 1440 on the tokens it already has, because `clamp()` widths,
`auto-fit` grids and a wrapping `split` do the retuning without a second bag.
It is reopened by a design that provably cannot hold at 320, which is the same
admission test ADR 0061 set for a vocabulary member.

## Consequences

- **The scope is a LAYOUT's, and only a layout's.** `tokens` is declared in the
  `params` of `stack`, `row`, `split` and `grid` and on no leaf. A bag on a leaf
  is dropped whole, silently, like any undeclared param.
- **A bag that survives to nothing leaves no key**, so a design whose bag was
  entirely misspelled is byte-identical to one that carries none — the same
  absent-versus-set equality every other param is held to in
  `tests/js/renderer-manifest-parity.test.ts`.
- **`TemplateVocabulary::node()` now has a nested-value clause**, and it is the
  first param that is not a scalar. Anything else nested that is added later
  must go through one of its own; the verbatim copy is safe only for scalars and
  the comment there says so.
- **Scope styling does not survive a design switch**, exactly as tokens do not.
  Picking a new design and keeping the old one's colours is picking neither.
  `MerchantsOwn` still carries the merchant's image and href across, as it does
  today.
- **A literal hex does not follow a theme change.** The Style panel flags one
  and offers a one-click conversion to a token reference, which does.
- **The free loader is 8,311 B gzipped of 12,288.** The bag, the panel and both
  tokens together cost 13 B — a CSS rule built from strings the sheet already
  contains is nearly free once gzipped — and the type scale's ten rules cost
  120 B, which is the whole of the difference. The elite loader is 10,277 B,
  leaving 2,011 B.
- **The payload budget is not raised, and both instruments changed.** An early
  reading claimed ten rich designs came to ~2,320 B against 2,048 and that the
  budget had to grow. It does not: the fixture measures well inside 2,048 with
  36% in hand. So the budget stands and the measuring does the moving.

  `PayloadBudgetTest` no longer names `centred-card` — it **derives** the richest
  design the library ships and measures ten of that. Pinning the fixture to the
  plainest design is how it would have gone on passing while the designs a
  merchant actually picks moved the number.

  `LibraryLintTest` gains a **per-design cap**, `DesignBudget::PER_DESIGN`,
  which is `PER_PAGE / 2`: a design costing more than half a page measured alone
  is one design eating a page two Optins are meant to share. The richest design
  shipped is 677 B, so the line is generous — it is not a target, and a cap that
  argues with ordinary authoring is one people route around. What it catches is
  the realistic failure, an embedded raster image, which the per-page test would
  report two commits later naming a page rather than a design.

  **The builder's meter reads the same constant over the wire**, the way
  `InspectorEnqueue::PARAM` does, so the merchant and the test are measuring
  against one number rather than two that agree today.
- **Five reference-class designs ship on the new vocabulary.** `cream-coupon`
  (a display number over a cream panel, with the coupon on an accent-ruled panel
  in the success step), `ink-split` (the navy pane beside a white form ADR 0061
  named as the canonical missing design), `ledger-card` (a serif display face
  over three outlined benefit panels), `inline-rule` and `inline-tinted`. Every
  one of them uses something that did not exist before this ADR, and none of
  them is a palette swap of anything already in the library.
- **Trees get deeper**, because a scope is a box and boxes nest. `BlockTree`
  indents and collapses already, and collapse state stays in React and never in
  the tree.
- **Translation is untouched.** A bag adds no string, and node ids stay the
  translation key.
- **It made a latent `split` defect visible, and the fix is the renderer's.**
  `.wc-pane`'s grows were `.35` and `.65`, which sum to 1 and divide a shared
  line exactly — and which, once the panes WRAP, leave each one alone on its
  line taking only that fraction of the free space beyond its `12rem` basis.
  Measured at 320px: `split-hero` drew two 228px panes in a 264px row,
  `inline-split` two of 209 and 223 in 240.

  **Every split design in the library had this and nobody could see it**, because
  a pane that draws nothing cannot look short. A `panel` inside one is a dark box
  with a stripe of the design's own background down its edge, which is how it was
  found. The grows are scaled by ten and floored at 1, so the ratio still divides
  a shared line and either pane fills its own.

# The editor's chrome is one card with three named panes

[ADR 0065](0065-the-editor-is-the-scope-editor-now.md) closed the *behaviour*
gap between this editor and
[The Scope Editor](https://claude.ai/code/artifact/a4d06a27-052b-4bb7-8ea2-16a854ef361e),
the reference tool it was measured against: `media`, the narrow bag, addressable
containers, the width switch, the theme picker. Everything the artifact does,
the editor now does.

It still did not **look** like it, and that is not a finishing pass. Measured
against the same reference, every surface on the Design tab was one to two type
steps too large and roughly twice as loose, and the chrome was a different
shape: the check strip was a wall of monospace across the top where the artifact
puts it quietly at the bottom, and the three panes were three floating boxes
where the artifact has one card with three named columns.

## The visible symptom was the block tree, and it was arithmetic

Five rows in a design of twelve ran their own name under their own `⋯` menu —
*Image↓⋯*, *counted⋯*, *Consent wording 👁⋯*, *Headline after they submit*,
*Body text after they submit*.

That is not a truncation bug and it does not have a truncation fix. The row
reserved **176px of furniture in a 254px pane** — a 16px grip, a 24px twist,
three 32px action cells and a 16px-per-level indent — and
`.wconvert-block__kind` stated **no `font-size` at all**, so a block's kind
inherited 14px body: a label on a control, set exactly as large as a paragraph
of prose.

Both terms move here. The kind takes an 11px register and the furniture drops to
a 24px cell and a 12px step, and the same pane holds ~17 characters where it
held ~8.

## Two new type roles, and ADR 0037 said how

[ADR 0037](0037-the-admin-inherits-token-structure-and-owns-its-values.md) named
six roles and said a seventh *"is a decision rather than a class"*. That is a bar
to clear, not a wall, and the Design tab is where it is cleared twice:

| | | |
|---|---|---|
| `--text-label` | 11px / 1rem / .01em / 500 | a block's kind, a swatch's name and value, a check's word |
| `--text-meta` | 9px / .875rem / .13em / 600 | a pane's name, where a value came from, a count, the stored JSON |

*Amended by [ADR 0131](0131-one-way-to-show-each-thing-in-the-admin.md):
`label` and `meta` never carry a control, a condition or a reason. "A check's
word" is a control's label and is `micro` or `note`; so is any condition text
and any refusal reason. The two roles stay for captions, pane names and counts.*

Both are the reference tool's own values, taken value for value rather than
interpolated down from `micro`. `meta` carries the uppercase register in the
token because that is its dominant use; the two chips that want narrower
tracking restate `letter-spacing` alone, which nothing constrains.

**The three panes are a work surface and that is the whole argument.** A block's
kind, a token's name and a check's word are furniture *on* the thing being
edited rather than copy to read — the register a tool puts on its own chrome. It
is not a general licence: every screen but this one is untouched, and rolling
the two roles out further is a separate decision.

`admin-stylesheet.test.ts`'s `ROLES` array is where that decision is recorded.
The test never inspects a value — only that every `font-size` in `index.css`
spells one of the names — so a new role costs exactly one line there, and the
line is the decision.

### What was not traded away, because it never existed

The stylesheet claimed, at the check strip's own source rule, that
`--text-micro` *"is already this admin's floor (ADR 0038, and the 9px in the
reference tool fails the bar)"*.

**ADR 0038 states no minimum font size.** Its floors are contrast ratios, a
blocking `jsx-a11y` lint, 24 × 24 pointer targets and the 360/782px viewports.
The citation was invented, it went unchallenged for a release, and it is the
single reason the previous pass stopped where it did. It is corrected in place.

What 9px is held to instead is stated rather than assumed: it takes
`--muted-foreground` at full opacity against `--surface`, and **nothing set in
it is the only copy of itself** — every check source is repeated in full in the
chip's `title`, every chip has an `sr-only` sentence, and every pane head names
something the pane's own contents also say.

## A third control height

`--control-height-xs: 1.5rem`, beside `--control-height` (2.25rem) and
`--control-height-sm` (2rem).

[ADR 0039](0039-a-screen-is-regions-and-scope-decides-placement.md) states two
and says which applies is a question of **scope**: the tall one for what a
merchant came to the screen to press, the small one for what qualifies what is
already on it. This is that same test one level further in — a control inside
the *work surface* is not the same weight as one that qualifies the screen
around it. Three action cells at 32px were 96px of a 254px pane.

It is spent on the row's three actions, the token reset, the two clipboard
buttons, the theme presets, the swatches, the length slider, the hex box, the
font trigger and the segmented choices.

**24px is a floor and not a step on the way down.** WCAG 2.2 SC 2.5.8 wants
24 × 24 CSS px and this lands *on* it; the palette's own 8px gaps keep the
*spacing* exception in reserve besides. The vendored `Button` has shipped an
unused `size="icon-xs"` at `size-6` since the first vendor commit — the bar was
already in the component, with zero call sites.

## The chrome: one card, three named panes, diagnostics at the bottom

**Superseded by [ADR 0067](0067-the-editor-starts-with-the-preview-and-the-selected-element.md):** the builder is a viewport workspace with optional Layers, a large canvas and a contextual inspector. Readiness stays in the footer; the technical strip and stored JSON are removed from the normal editing flow. The card anatomy below records the previous implementation.

`Region` has always been `overflow-hidden rounded-md border border-border
bg-card` — it *is* the artifact's `.tool`. Two things kept the panes from being
that card's contents, and neither was about the panes: `RegionBody`'s `px-4
py-4` inset them from its edge, and the tree and the inspector each drew a
`border` and a `radius` of their own. Four edges inside one edge is what made
the tab read as a window manager.

So `StructureView` returns the card's bands directly:

```
Region                                      the card, already there
├ .wconvert-toolbar   design name · themes · meter · fullscreen · browse
├ .wconvert-hint      the tree's keyboard contract, once, over all three
├ .wconvert-panes     grid; one border-inline-start per boundary
│ ├ .wconvert-pane    STRUCTURE · 12 blocks
│ ├ .wconvert-pane    PREVIEW
│ └ .wconvert-pane    Picture box · Content | Style · ⇄
├ .wconvert-checks    the six chips, quietly
└ .wconvert-stored    what the selected box actually holds, as data
```

- **A head band replaces each pane's outline**, and does the job better: an
  outline says *this is a separate thing*, a head says *this is the structure*.

  _Completed: **a head is a BAND and the pane's name is a thing inside it**, and
  the three bands are one height. As shipped, `.wconvert-pane__head` carried the
  9px uppercase register itself, which is what stopped anything but a word being
  put in one — so the three heads came out at 27px (a 14px line), 33px (the ⇄
  swap at `icon-sm`) and 63px (a head band stacked on the preview's own control
  bar), and the three pane bodies started at three different `y` on a tab whose
  whole subject is one design read across three columns. The word moved to
  `.wconvert-pane__name`, every head takes `min-block-size:
  var(--control-height-sm)`, the swap dropped to the 24px tier, and the render
  pane lost its separate head — `.wconvert-builder__bar` **is** its head now,
  carrying `.wconvert-pane__head` and a `name` on the Design tab only. The floor
  is the small control height because the tallest thing a head may hold is a
  small control._
- **The toolbar is a `Toolbar`**, which is what a strip holding what is scoped
  to the region under it already is (ADR 0039). It carries `.wconvert-toolbar`,
  which is in `index.css`'s small-height list — so `Browse designs` stopped
  being the one 36px control in a row of 32s without a `size` being passed to
  it.

  _Amended: **it is a `<Toolbar dense>`, because a strip inside a card is not a
  strip across a screen.** `Toolbar`'s `px-4` was the top of a left edge that
  stepped 16 → 12 → 12 → 10 → 8 → 12 → 12 down the card, with
  `.wconvert-scope__clipboard` hanging 4px OUTSIDE its pane on a
  `calc(var(--spacing) * -3)` naming a variable `index.css` never declared. The
  card states its inset once as `--wconvert-gutter` (0.5rem) and every band and
  pane spends it by name. `dense` is builder-only — `LeadLog` and
  `TemplatePicker` still span a screen and keep `px-4` — and the number lives in
  the utilities layer, because `px-4` is an `!important` utility and ADR 0042
  rule 6 is that only a layered `!important` beats one.
  `tests/js/admin-stylesheet.test.ts` derives the guard from the selector's
  subject rather than from a list of class names, because a list is the thing
  that rots._
- **The bands of the card share one floor and the fields one rhythm.** A band —
  head, hint, said, checks, stored — is `--control-height-sm` tall, and a
  failing check chip takes `--control-height-xs`, which it had no floor for at
  all: six chips of 9px and 11px text came to about 20px, and the failing ones
  are the pressable ones, so the smallest target on the strip was the only one
  anybody needs to hit (SC 2.5.8). Inside the inspector the gap between two
  fields is 0.5rem, stated on the `TabsContent` that actually holds them —
  `.wconvert-inspector__body > * + *` never reached a field, because Radix's
  panel sits between the two, which is why *Alt text* had 8px above it and
  *Picture shape* had none.
- **The checks moved from the top to the bottom.** Six monospace chips across
  the top of a work surface is the loudest thing on the tab announcing the
  quietest fact — *six checks pass*. Diagnostics are consulted; they are not
  worked in. The `header` prop split into `toolbar` and `checks` to say so.
- **The stored-JSON readout lifted out of the Style panel.** It was the
  twenty-fifth item in a 22rem column, under twenty-four controls about the
  box's *parts*, reachable only by scrolling past all of them. A readout about
  the whole box belongs in the card's foot, where it has the measure to be read
  across. `StructureView` computes the scope with `scopeChainOf` rather than
  being handed it — it already holds `template` and `selected`, and a second
  source for one walk is two chances to disagree about one design.
- **`align-items: stretch`, which is the one thing that had to change to make a
  divider a divider.** With `start`, a 22rem inspector beside a 90-row tree drew
  its rule for a fifth of the card and stopped. Stretched, every rule runs the
  card's height — and the sticky offsets move one level in, onto a
  `.wconvert-pane__stick` wrapper holding each pane's head *and* body, because a
  stretched grid item has no travel and a body that stuck without its head would
  leave a pane's name scrolling off a pane still on screen.

The `@container (min-width: 67rem)` split and its `minmax(11rem,16rem)
minmax(31rem,1fr) 22rem` tracks move onto `.wconvert-panes` unchanged. Below it
the panes still stack, and the division is `border-block-start` instead.

## What was NOT taken from the reference tool, and why

- **The row's ↑↓ buttons do not move to a pane foot.** WCAG 2.2 SC 2.5.7 wants a
  single-pointer alternative to the drag, and W3C's own cited example is
  *"sortable lists: adjacent controls for moving elements up or down"*.
  [ADR 0038](0038-the-admin-holds-different-floors-to-the-loader.md) is explicit
  that a row which replaced them with the grip *"would fail this criterion
  outright, however good it looked"*. They may shrink. They may not leave.
- **The row does not go below 32px.** The artifact's is ~22px. ADR 0038 worked
  SC 2.5.8's exceptions one at a time against the twist and it cleared none of
  them — no other *pointer* control on the page expands a row, and a 24px circle
  centred on a 20px twist intersects the label button 4px away. So the twist is
  24 × 24, and 24 + 4 + 4 = 32 is arithmetic rather than taste.
- **There is still no author/merchant mode.** ADR 0065 declined it and nothing
  here reopens it: Sarah gets one editor.
- **The register is the Design tab's only.** Every other screen keeps `micro` as
  its smallest. A roll-out is a decision about the whole admin and would be
  taken against the whole admin.

## Verified on a real WordPress

Playground, both plugins mounted, per CLAUDE.md — and `npm run build`, not
`build:admin`, because Pro *deregisters* free's admin script. Read out of the
page: the one WConvert stylesheet the browser loads is
`wconvert-pro/public/admin/main.css`.

Driven with Playwright rather than the Chrome extension, and measured with
`getBoundingClientRect()` rather than read off a screenshot. A design with 20
blocks over two steps (`fieldwork`), at 1280 and 1680, menu expanded and folded,
LTR and RTL. No console errors, no page errors, nothing over 400.

| | held? | |
|---|---|---|
| a leaf row is 32px | **yes** | every row, exactly, at every width |
| its twist is 24 × 24 | **yes** | and it is the tallest thing in the row |
| the three panes take their floors at 1280 | **yes** | 222 / 496 / 352 — the tree is 46px WIDER than the plan predicted, because the three 1.5rem gaps between three boxes are one 1px rule now |
| nothing over 14px but the inspector's heading | **yes** | 16 (that heading) · 14 · 13 · 12 · 11 · 9, and 14 is the tab strip outside the card |
| the check sources fit at every width | **yes** | six chips on one line at 1280; the container query that hid them is gone |
| the sticky panes still travel | **yes** | `.wconvert-pane__stick` pins at 4rem inside a stretched pane |
| *Headline after they submit* fits at 1280 with the menu expanded | **no** | see below |

**The one number that does not hold, and it is arithmetic rather than an
oversight.** At 1280 with wp-admin's menu out, the container is 1070px: the
inspector takes 22rem and the preview takes its non-negotiable 31rem floor, so
the tree gets **222px** — and 222 minus the row's furniture leaves ~38px of
label for a ~133px word. It overlaps its own `⋯` by 34px.

At **1680** it overlaps by **0**, and at **1280 with the menu folded** — which
is 124px the container query can actually see — by **0**. The longest name in
the design, *Body text after they submit*, overlaps by 4px at both. Against the
five names the ticket screenshotted, that is the symptom gone at two of the
three widths and much reduced at the third.

Closing the third would mean narrowing the preview below the width at which it
stops rendering a design at its own measure, which is the one thing a live
preview exists not to do. *Full width* is the merchant's answer and the tree's
own scroll is the fallback.

### One thing fixed on the way past

**The design system's token mirror had no type scale in it at all.**
`tools/design-system/build/tokens.mjs` lifted `@theme inline` and `:root` and
not `@theme static`, so the generated `tokens.css` showed a palette, a radius
and the control heights beside not one of the roles — the axis ADR 0037 added in
the same breath as the colours was the one axis a reader of the mirror could not
check. It lifts all three blocks now. Re-shot: the four reading screens are
unchanged, which is what "the Design tab only" is supposed to mean.

## Consequences

- **`--text-label` and `--text-meta` exist, and the scale is eight roles.**
  ADR 0037's *"a seventh is a decision rather than a class"* is unchanged and is
  what was followed; its consequence list is amended in place.
- **`--control-height-xs` exists, and ADR 0039's two heights are three.**
  Amended in place, with the argument the second one used.
- **`StructureView` renders no `RegionBody` and takes `toolbar`, `checks` and
  `width` where it took `header`.** The card's bands are its children.
- **`BlockInspector`'s head is the third pane's head band**, and the
  *Content* / *Style* strip is in it. The `Tabs` root is the pane, because the
  strip and the panels are now in different bands.
- **`ScopeJson` is exported from `ScopeStyle` and drawn by `StructureView`.**
  Its summary names the box — *What is stored on Coloured box (3)* — because
  *here* meant the panel and now would mean the card.
- **A `font-size` in `index.css` may carry `!important`.** The type-scale test
  allows the flag after the value: `TabsTrigger` ships `text-sm` as an
  `!important` utility, so the inspector's own strip cannot state a size without
  one (ADR 0042 rule 6). The flag says nothing about which role was spelled.
- **The design system lifts `@theme static` too**, so its `tokens.css` carries
  the eight type roles rather than only colour, radius and the control heights.
- **The check strip's container query is deleted.** It hid every source below
  62rem because six of them wrapped onto three lines at 12px. At 9px they fit,
  which is a better answer than removing the information was.

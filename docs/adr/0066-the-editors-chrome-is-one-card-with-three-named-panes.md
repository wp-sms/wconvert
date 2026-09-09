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
- **The toolbar is a `Toolbar`**, which is what a strip holding what is scoped
  to the region under it already is (ADR 0039). It carries `.wconvert-toolbar`,
  which is in `index.css`'s small-height list — so `Browse designs` stopped
  being the one 36px control in a row of 32s without a `size` being passed to
  it.
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
- **The check strip's container query is deleted.** It hid every source below
  62rem because six of them wrapped onto three lines at 12px. At 9px they fit,
  which is a better answer than removing the information was.

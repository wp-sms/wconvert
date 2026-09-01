# A screen is regions, and scope decides placement

Every WConvert admin screen is the same five parts in the same order: a
**masthead**, a **page header**, a **page body**, and inside the body one or more
**regions**, each optionally opening with a **toolbar**. A region is a card with
its own edge holding **exactly one concern**; two concerns are two regions.

And where a control goes is not a question of where it fits. **It is decided by
what the control acts on**: the screen, a region's data set, one row, or a
selection. Each of those has exactly one home.

*Extended by [ADR 0048](0048-the-eligibility-inspector-runs-on-the-real-page.md):
**the same rule decides where a FACT goes.** A fact that is identical
for every item in a group belongs to the group; only what differs per item goes
on the item. The rules panel had it the other way round and it cost the screen
twice — every "not available" card repeated `Needs WooCommerce on this site.`
under a heading that had just said it, and every Starting point carried a
`Use this` button in a grid where the card was already the thing you press.
Roughly 200px and 60px per card respectively, spent saying one thing several
times.*

*Two corollaries worth having by name. **Group by the fact, not by the state**:
absent capabilities are grouped by WHICH plugin they are waiting on rather than
lumped under "not available", which is ADR 0026's "do not make them guess which
of their plugins did it" applied to the shape rather than only to the words.
And **a classification is a badge, not a row** — "When", "Where", "Needs
WooCommerce" are metadata about the card and sat on lines of their own,
at the same weight as the sentence that was the point of the card.*

[ADR 0035](0035-the-admin-owns-its-page.md) made the page WConvert's and
[ADR 0037](0037-the-admin-inherits-token-structure-and-owns-its-values.md) gave
it a palette. Neither said where anything goes. This is that, and it is written
once rather than discovered five times.

## The screens disagreed, and an audit says why

All five reading screens were read end to end before this was written. The
disorder is not cosmetic and it is not one screen's fault — it is the absence of
a rule, showing up five times in five different ways:

- **No screen had a loading state.** All five initialised from an `EMPTY`
  constant and rendered their *empty* state during the first fetch. On the
  creation flow that produces a lie: *"No ready-to-run starts for this Goal
  yet"*, while they are loading.
- **Empty states disagreed about what kind of thing they are.** Optins and Leads
  put theirs *inside* the table as a `colSpan` row; Analytics used a page-level
  `<p>`; Destinations had none at all for its main content. None carried an
  action.
- **Errors always rendered at the top of the screen**, however far that was from
  the control that failed. The creation flow's never cleared — there is no
  `setError(null)` in the file.
- **No destructive action confirmed.** Not one `confirm(`, no `AlertDialog`, no
  *"Are you sure"* anywhere in `resources/admin/src/`. That included the
  retention radio, where one click schedules cron deletion of every [[Lead]]
  older than 90 days.
- **Status rendered raw machine tokens.** A merchant read `published`, `draft`,
  `deleted` — untranslated, because they were never strings anybody wrote.
- **`busy` was screen-wide**, so publishing row 1 disabled the buttons on every
  row.
- **Fourteen BEM class names had no CSS at all.** The "cards" they named were
  unstyled stacked `<div>`s.

Fixing that screen by screen, five times, is how five screens end up disagreeing
about the fix as well as about the problem.

## Placement is scope, because "where it fits" is not a rule anybody can apply twice

The Leads screen is the worked example. Its only screen-level action — Export
CSV — sat mid-filter-row between a `<select>` and a checkbox, because that is
where there was room. The headline count sat above the table as a bare
`<strong>`, where it read as a label for the form controls under it. And a table
of captured [[Lead]]s shared one block with the setting that deletes them.

Every one of those is defensible as a local decision and none of them survives
being asked *what does this act on?*

| An action acts on… | It lives… | As |
|---|---|---|
| the screen | the page header, beside the title | primary solid / secondary outline, **max two** |
| a region's data set | that region's toolbar, trailing edge | secondary, `sm` |
| one row | the row's trailing Actions cell | ghost, `sm`; more than two collapse to an overflow menu |
| a selection | replacing the toolbar's filter side while a selection exists | — |

That table answers the open questions directly rather than by taste. Leads'
Export CSV acts on the screen's whole log, so it is page-scoped and belongs
beside the title. Analytics' range picker changes what one region shows, so it
is region-scoped and belongs in that region's toolbar. Neither answer required
looking at the screen.

*Amended by [#65](https://github.com/navidkashani/wconvert/issues/65), on the
range picker only: **it is in the page header.** The premise above is wrong
about the screen. Analytics is not one region with a picker over it — it is one
region PER GOAL, and the window governs every one of them at once. A copy in
each region's toolbar would be four controls that have to be kept in agreement,
and a merchant who moved one and not the others would be comparing two windows
on one screen. It sits at the trailing edge rather than beside the title,
because the table's other rule still holds: a filter is not an action, and the
position beside the title is what pairs an action with the thing it acts on.
Recorded here rather than only in the commit that moved it, because this
paragraph is what a reader reaches for.*

**Two is the cap on page-header actions, and it is a cap on the header rather
than on the screen.** A third page-scoped action is the signal that one of them
is really region-scoped, or that the screen is two screens. ACF and Gravity
Forms both hold to two and both have more surface than this.

And the rule destructive actions get is its own sentence, because it is the one
that costs a merchant real data when it is missed: **a destructive action is
never primary, never adjacent to the safe action it could be mistaken for, and
always confirms.**

*Amended by the structure editor, on the last clause only. **Deleting a block
does not confirm, and undo is what buys that.** The arithmetic is the whole
argument: a merchant rearranging a design deletes and re-adds a dozen times in a
minute, and a dialog on every one of them is a dialog they learn to dismiss
without reading — which is strictly worse than none, because it also trains them
through the dialog that guards deleting an Optin.*

*This is an exchange rather than an exemption, and the terms are written down so
a later build cannot take half of it. Undo is the **precondition**:
`builder/structure/history.ts` ships in the same commit as the Delete, and a
Delete with no history behind it is an unconfirmed destructive action with no way
back, which is exactly what the sentence above forbids. The affordance also
states what the delete takes — "Delete, and the 2 inside it" — because undo is
the recovery for a surprise the merchant has already noticed, and a row that
silently swallowed its children is one they might not.*

*The other two clauses are untouched, and hold here. Delete is not primary: it is
the last item of an overflow menu, marked destructive. It is not adjacent to the
safe action: Undo and Redo are in the region's toolbar, not in the row.*

## A count is not a heading

The Lead log's `7 submissions` was the largest text on the screen, above the
filters, in bold. It is not a title — it is a fact about the set the region
below it is showing, and it changes when the filter changes. So it sits at the
**trailing edge of that region's toolbar**, in tabular numerals, as **one text
node**.

One text node is a design decision *and* a test constraint, and they agree.
`tests/js/lead-log.test.tsx` asserts `findByText('7 submissions')`; splitting the
number away from its noun to style them differently would break it, and the
reason it would break is the reason not to do it — a number whose unit is a
separate element is a number a screen can eventually render without its unit,
which on this screen is the number that would be read as *people*
([ADR 0021](0021-lead-identity-is-computed-not-stored.md)).

Truncation notices and, when they arrive, pagination sit in a **region footer**
below the table. **A count is stated only where the set can be large enough to
need one** — it is not invented for a screen that has none today, which is why
the Optin list has no count and is not missing one.

_Amended: **a region footer is `RegionFooter` and nothing else**, and two screens
had drawn their own. The creation flow's step footer and the Destinations card's
repair-and-remove row were hand-rolled `<div>`s at `px-4 py-3` — a different
padding from this one, and outside every selector `index.css` keys the
button-wrapping rule on. So at 360px a long translated label in a
`whitespace-nowrap shrink-0` button pushed the strip past the viewport, on
exactly the two strips nobody had checked. The class `.wconvert-footer` is what
the rule matches, which is why routing them through the component is the fix and
a note asking the next author to remember is not. The footer states no control
height of its own: a step's Continue is the tall one and a card's Re-push is the
small one, and that is scope rather than a disagreement._

## Every region declares all three states, and loading is not empty

A region that fetches has three renderings and owes all three:

- **Loading** is skeleton rows matching the region's own shape, and it is
  *never* the empty state. It carries a short delay before it appears, so a fast
  response does not flash a skeleton at somebody.
- **Empty** is inside the region, centred, one sentence and the action that
  fixes it. Inside, because an empty region with a page-level sentence beside it
  is a region that looks broken; with the action, because *"No Optins yet"* is a
  dead end and *"No Optins yet — create one"* is a screen.
- **Error** is an alert at the top of **the region that failed**, not the page,
  and it clears on the next successful fetch.

*Applied to the design picker by
[ADR 0043](0043-the-library-is-indexed-and-its-facets-are-derived.md), where the
first bullet is a `GallerySkeleton` in the grid's own shape and the second is
"No designs match" **beside Clear filters**. The third turned out to have
nothing to draw: the index is fetched before the builder renders, a tree that
does not arrive leaves one card with its skeleton and is retried by the next
look, and the save a merchant starts by pressing "Use this design" is a failure
of the Optin rather than of the gallery — so it lands in the builder's own
region error, which is this rule read correctly rather than an exception to it.*

***And the Design tab was two concerns in one region*** (ADR 0043). It held
*choose a design* and *adjust the look*. At three cards that was invisible; at
forty the gallery swamps the tokens the tab is named for, and the merchant who
came to change one colour scrolls past the whole library to reach it. Choosing a
design is a dialog now — ADR 0042 rule 7's test, *something that owns the screen
until it is answered* — and the tab keeps the look. **The destructive-action
rule below is where it lands**, and the structure editor's amendment is what
decides it: picking a design loses blocks the merchant added, moved or deleted,
undo buys the exception to confirming, and so the affordance **states what it
takes** rather than asking a second question in front of the first.

The region-scoped error is what makes partial failure survivable, and there is
already a case in the tree that needs it: `OptinList` swallows a [[Goal]]
registry failure on purpose, because a registry that did not load costs the
screen a nicer word for a Goal and must not cost the merchant the buttons beside
it. A page-level error banner turns that deliberate degradation into a screen
that announces it is broken.

## The table breakpoint is 640px, and it is neither number ADR 0038 owns

[ADR 0038](0038-the-admin-holds-different-floors-to-the-loader.md) already owns
two widths, and **a table may reuse neither**:

- **782px is the builder's floor.** It is the width a sticky live preview beside
  a settings panel needs, and it is where wp-admin collapses its own menu. It
  says nothing about a table.
- **360px is a floor, not a breakpoint.** It is the width the reading screens
  must survive — not a width at which they change shape.

Reusing either would make one number mean two things, and the next person to
move one would move the other by accident. So the table gets its own: **below
640px a table becomes a stacked list of row-cards**, one card per row,
label-and-value pairs inside.

The two alternatives were both refused on what they cost the reader. **Horizontal
scroll** — a lead log you have to drag sideways is a log you do not read.
**Column hiding** — it decides for the merchant which of their own columns
matter, and it is wrong exactly when they came to the screen for the column it
hid.

**The transformation is CSS-only, and that is a test constraint as much as a
design one.** `lead-log.test.tsx` asserts `findByRole('row', …)`, so the DOM stays
a table at every width. Because `display: block` on a `<tr>` can take its
implicit role with it in a real browser, the table's elements carry their roles
**explicitly** — `role="table"`, `role="row"`, `role="cell"`, `role="columnheader"`
— so the accessibility tree survives the treatment that the DOM already does.

## Levels are not a cap

[ADR 0036](0036-admin-components-are-vendored-from-upstream.md) says *"WConvert's
is four tabs"* against WSMS's twenty-five-section rail. That is a statement about
**top-level sections** and about the scale a rail exists to serve. It is not a
budget on tabs anywhere in the product, and
[#69](https://github.com/navidkashani/wconvert/issues/69)'s ~~five~~ ~~four~~
~~five~~ **four** builder tabs are a level below it.

This is written down because the two look like a contradiction and are not, and
because the cheapest place to lose that distinction is a review comment reading
*"ADR 0036 says four"*.

*Amended by [#69](https://github.com/navidkashani/wconvert/issues/69): the
builder ships **four** tabs — Design · Content · Display rules · Destinations.
Triggers, Conditions and page targeting were three tabs' worth of one question
(*when and where does this show?*), and merchants arrive expecting them
together; OptinMonster ships the same merge as one Display Rules screen. The
count is struck through rather than rewritten because the point of this section
is that a count at this level is not the thing being budgeted — and a section
arguing that, which then silently tracks the number, would be arguing against
itself. `RulesEditor` and `TargetingEditor` are unchanged: the merge is a tab,
not a model.*

*Amended again by the structure editor: the builder ships **five** — Design ·
Content · **Structure** · Display rules · Destinations. Structure is not a sixth
question. It is the second view of the document *Content* already edits: Content
answers *what does this say*, Structure answers *what is here and in what
order*, and both write the same `template`. They sit adjacent for that reason
and they coexist permanently — a merchant fixing a typo must not have to walk
past a move button to reach the sentence, and a merchant rearranging must not
have to read every sentence to find the block.*

*Amended a third time by the editor merge: the builder ships **four** again —
Design · Content · Display rules · Destinations. The paragraph above was right
that Content and Structure were two views of one document and wrong about what
follows from it. Its own justification — *"a merchant fixing a typo must not
have to walk past a move button to reach the sentence"* — was an argument
against a Structure tab **you cannot type in**, and the fix for that is to let a
block be edited where it is selected rather than to keep a second copy of the
document on another tab. With an inspector under the tree, the two tabs were one
screen drawn twice and a merchant changing a headline had to pick which copy to
open. The look moved the other way, from Content to **Design**, which is what
that word already promised.*

*The count has now moved three times, which is the section's own argument
arriving three times. Every one is struck through rather than rewritten for the
reason given above: a section arguing that a count at this level is not what is
being budgeted, and then silently tracking the number, would be arguing against
itself. `tests/js/builder-shell.test.tsx` is edited in the same commit each time
— behaviour moving, recorded rather than quietly fixed.*

## A control that acts on a selection lives ~~under~~ **with** the list the selection is made in

The table above answers placement for a control that acts on **the whole
region** (its toolbar) and on **one row** (in the row). It does not answer the
third case, which the block tree is the first screen to have: a control that
acts on *whichever* row is currently selected.

It goes **with the list** — beside it where there is room, under it where there
is not — in the same region, after it in the tab order.

- **Not in the row.** The controls for a block are a heading, several text boxes
  and a visibility checkbox. Fifteen rows each carrying that is not a list any
  more, and the treegrid's roving tabindex — one tab stop for the whole grid —
  cannot survive rows whose cell count depends on which one is selected.
- ~~**Not beside the list.** The tab column is 616px at its widest (`main` is
  `max-w-6xl`) and ~392px at 1024px. A side-by-side split is not available at
  either width, so it is not a preference between two layouts.~~
- **Not on another tab**, which is what the editor did before this and what the
  amendment above undoes.

> **Amended: 616px was arithmetic off a measure chosen for the reading screens,
> and the builder no longer holds that measure.**
>
> The number was honest and it was derived, not designed:
> `1152 − 48 padding − 24 gap − 464 aside = 616`, where 1152 is `max-w-6xl` —
> right for four screens that are tables and prose, and never chosen for an
> editor. Nothing in this ADR ever owned measure, and
> [ADR 0038](0038-the-admin-holds-different-floors-to-the-loader.md)'s whole
> posture is that the builder is allowed different numbers from the reading
> screens; this section's own *"levels are not a cap"* argument is the same
> move in the other direction.
>
> The builder now takes 1440px, and above 48rem of container the tree and the
> block inspector sit side by side. **The placement rule is re-derived rather
> than repealed**: a control that acts on a selection lives *with* the list the
> selection is made in, and the two bullets that survive — not in the row, not
> on another tab — never rested on width at all. What the split changes is
> which of *beside* and *under* the rule resolves to at a given width, not what
> the rule is.
>
> The consequence below is untouched and is if anything sharper: a panel that
> sits permanently beside the list has no scroll position to hide an empty
> state in.

### Undo, Redo and the verdict are the DESIGN's, not the Content tab's

The same scope test, applied to three controls that were failing it in this
ADR's own editor. They shipped in the Content tab's toolbar, and all three act
on the whole draft: the builder's history watches `template`, so a token
changed on **Design** is a full undo entry and so is picking a design, while
the verdict's contrast failures are *caused* by colours chosen there.

So a merchant who applied a preset and wanted it back had no Undo, because Undo
was on another tab. `DesignToolbar` is the same toolbar rendered on both tabs
that edit the design — the rule applied honestly, not a new concept. It stays
out of the page-header band, which this ADR caps at two whole-screen actions.

_Amended: **`Toolbar`'s `trailing` slot is where a region-scoped status chip
goes**, and the verdict was not in it. It rendered inside the LEADING group
wearing `margin-inline-start: auto`, which pushes an item to the end of the
group it is in — so it sat 12px after Redo rather than at the toolbar's trailing
edge, where the Lead log's count and every other region's status sit. "Filters
lead, the count trails" was already this ADR's rule for that slot; a verdict is
the same kind of thing as a count — a fact about the set the region is showing —
and the slot is where it belongs. An auto-margin is what a control reaches for
when it is in the wrong group._

_Amended again by [ADR 0042](0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md):
**the slot is right and the chip should not have been in it, because a sound
design says nothing at all.** Placing *"This will work"* correctly was solving
the wrong problem — a green tick on every visit is a permanent line that taxes
every visit and informs one, which is this ADR's own argument about subtitles
arriving one component later. The toolbar renders only when there are problems,
and Undo and Redo left with it: they move the whole DRAFT, the same scope `Save
changes` has, so they belong in the page-header band. The band those two
controls were costing was the only reason the strip existed._

`Display rules` and `Destinations` do not get it, by the same test: neither
edits the design, so neither can produce an entry to step or a problem to
report.

_Amended again, and this one deletes the component. **The design was the
SMALLER scope all along, and the verdict's is the Optin.** *"Nothing on this
design counts as a conversion, so it would report zero forever"* answers **is
this Optin ready**, which is the question the readiness panel above the tab
strip asks — and a merchant reading a Trigger on `Display rules` could not
reach the answer at all, which is the same fault this section opened by naming
one tab over. So the problems are listed in that panel, above all four tabs,
read out rather than behind a press, and each still opens the block it names.
`DesignToolbar` held nothing else and is gone; `problemsIn` is untouched. Undo
and Redo stay in the page-header band, where the paragraph above put them._

_The panel itself is [ADR 0048](0048-the-eligibility-inspector-runs-on-the-real-page.md)'s
extension of this ADR — **scope decides where a FACT goes** — applied to the
editor: a [[Goal]], a [[Playbook]], the four rule sentences and whether the site
is serving this Optin are identical for every tab, so they belong above the
tabs. It spans **both columns of the builder** rather than sitting over the tab
strip alone, and that is a measurement rather than a preference: in the tab
column it is 712px wide at a 1440px viewport, so nearly every rule sentence
wrapped and the panel stood 313px tall permanently, on a screen whose own floor
is 782px ([ADR 0038](0038-the-admin-holds-different-floors-to-the-loader.md))._

The consequence for anything that follows: **the selection must never be
empty** where a screen does this. A list with a panel under it that says
*"select something"* is a screen whose bottom half is an instruction, so the
first row is selected on arrival and every act that changes the list re-points
the selection rather than clearing it.

## Consequences

- **Two control heights, not one.** `--control-height` (2.25rem) for page-header
  actions and for form fields in a settings region; `--control-height-sm` (2rem)
  for toolbar controls, in-row actions and in-table controls. One height
  everywhere is why the Leads filter row read chunky — a filter and a primary
  action are not the same weight and should not stand the same height. This
  amends the *"one control height for the whole admin"* comment
  [#63](https://github.com/navidkashani/wconvert/issues/63) left in `index.css`,
  which was right about the un-converted screens it was written for.

  _Amended: **three controls were stated and did not use them.** Measured in a
  browser: the theme-preset button was 39px (padding around a line, no stated
  height), the Design tab's `input[type=range]` stood at the UA default of ~22px,
  and the gallery card's action changed height with its own state. All three are
  bound now — a preset and a size slider are controls a merchant came to the tab
  to use, so both take `--control-height`. A height that is written down and not
  applied is worse than one that was never written down: it reads as decided._
- **Status is a `Badge`, never plain text**, and the words are translated. The
  badge is the only thing in a Status column, so an id with no registry entry
  stays a `<code>` in the Goal column and never becomes a badge that would read
  as a state.
- **`Badge` gains `success` and `warning` variants.** Green and amber are
  reserved for meaning by
  [ADR 0037](0037-the-admin-inherits-token-structure-and-owns-its-values.md), and
  *published* and *suspended* are exactly that meaning — this is the reserved
  palette being spent on what it was reserved for, not on chrome. Editing a
  vendored component is the escalation ADR 0036 names.
- **Radix portals to `document.body`, outside `#wconvert-admin`**, so everything
  scoped to that id — the font, the control heights, the pointer cursor — does
  not reach a dropdown or a dialog. `index.css` states typography and stacking
  for the portal roots beside the z-index rules it already carried. wp-admin's
  toolbar sits at 99999 and is the number they clear.
- **Tables state their register.** Muted header row in the small-caps label
  register; numeric columns right-aligned in tabular numerals; a row is at least
  44px, which is the pointer target size the row actions inside it need; the
  trailing column is Actions.
- **Copy is sentence case, and a button names its outcome.** The verb persists
  through the flow — *Publish* → *Published* — so a merchant never has to check
  whether the thing they pressed is the thing that happened. Empty states invite;
  errors say what to do.
- **`busy` is per-row, not per-screen.** A slow publish on row 1 must not freeze
  row 8. That is a behaviour change, not a layout one, and it is here because the
  in-row Actions cell is what made it visible.
- **`.wconvert-legacy` narrows as screens convert.** It supplies one surface to
  a screen that has not been converted yet, and a converted screen inside it gets
  a card inside a card. It applies to the un-converted screens only, and it
  leaves with the last of them.
- **This is proven on two screens, not written and filed.**
  [#64](https://github.com/navidkashani/wconvert/issues/64) (Optins) and
  [#66](https://github.com/navidkashani/wconvert/issues/66) (Leads) are converted
  against it in the same branch, because they are the two that exercise every
  part — a table with row actions and a destructive one, a toolbar with filters
  and a count, a region footer, a second region on the same screen, and a
  page-scoped action that must stay an `<a>`. *This is now history rather than a
  plan: every screen is converted and `.wconvert-legacy` is gone. It is kept
  because it records WHY those two went first.*
- **[#65](https://github.com/navidkashani/wconvert/issues/65),
  [#67](https://github.com/navidkashani/wconvert/issues/67) and
  [#68](https://github.com/navidkashani/wconvert/issues/68) become mechanical**,
  which is the point of writing this first. Their share of the audit above is
  posted on each of them so it is not re-discovered. *They did, and they have
  landed — with one exception worth recording: #65's range picker was not
  mechanical, and the amendment above is what it cost.*
- **A test breaking mid-conversion is still the signal ADR 0038 says it is.**
  Two assertions in `optin-list.test.tsx` change with this grammar — `published`
  becomes a translated word, and Delete moves behind an overflow menu. Both are
  behaviour moving, and both are recorded in the commit that moves them rather
  than edited quietly.

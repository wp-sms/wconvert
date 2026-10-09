# The admin holds different floors to the loader

The loader fails a build at **8,192 bytes**, gzipped, per build
(`bin/check-loader.mjs`, [ADR 0004](0004-the-loader-survives-optimizers-not-just-caches.md)).
The admin bundle has **no gate at all** — its size is printed on every build and
blocks nothing. The two are not inconsistent, and this ADR is why.

Alongside it, the other floors the admin holds: **WCAG 2.1 AA**, enforced by
lint; **360px on reading screens and adaptive editing at narrow widths**; and **no dark
mode in 0.1.0**.

*The responsive range is split at both ends. The ceiling — 1280px on the reading
screens, 1440px on the builder — is [its own section](#the-measure-is-split-for-the-same-reason-the-floor-is)
below, added later and by the same argument.*

## The budget answers to who pays it

The loader's 8KB is paid by **every visitor on every page view of every install**,
on connections and devices WConvert does not choose. It is on the critical path of
someone else's site, and a byte added there is a byte multiplied by all of that.
A hard gate is proportionate because the cost is unbounded and invisible to the
person adding it.

The admin bundle is paid by **one authenticated person, on one screen, on the
machine they chose to administer a website from**, after WordPress has already
loaded its own admin payload. It is 74KB gzipped today and will roughly double
with Tailwind, Radix and lucide.

A hard gate there has a predictable life: it blocks a feature somebody needs, the
number gets raised to unblock it, and after the second raise it is a formality
nobody reads. **A gate that will be raised on demand is worse than no gate**,
because it launders the decision — the first version of this argument is already
in `bin/plugin-check.sh`: *"a gate that blocks on everything is a gate somebody
turns off."*

What survives is measurement without enforcement, which this repo's culture
supports elsewhere: `bin/plugin-check.sh` prints every warning and blocks on none.
The number is printed every build so a doubling is visible in the diff that caused
it, and a person decides.

## Splitting the builder is what makes the number stay honest

The reading screens — Optins, Analytics, Leads, Destinations — need none of the
gallery, none of the settings panel and none of the renderer. The builder needs
all three, and the renderer is imported into the admin precisely because there
are no static thumbnails
([ADR 0010](0010-templates-are-configuration-not-documents.md)).

Lazy-loading the builder keeps the common case — a merchant checking yesterday's
leads — near what it costs today, and puts the weight on the screen that
justifies it. This is worth more than any budget number would have been, because
it changes what is loaded rather than arguing about what may be.

> Built in [#73](https://github.com/navidkashani/wconvert/issues/73). What this
> paragraph did not anticipate is that **the creation flow is on the builder's
> side of the line**: it ends in the builder by construction and draws a real
> design at its last step, so it needs the renderer too, and leaving it eager
> would have put the renderer back on every reading screen. See
> [ADR 0041](0041-the-admin-ships-as-a-module-so-it-can-split.md).

## The responsive floor is split because the honesty is in the split

- **Reading screens work to 360px.** Checking a conversion count or yesterday's
  leads from a phone is a real thing people do, and those screens are lists and
  numbers — the things that reflow.
- **The builder adapts instead of refusing a narrow viewport.** Amended on
  2026-09-23 alongside [ADR 0103](0103-progressive-capture-keeps-one-lead-per-journey.md):
  the user approved replacing the 782px gate with a canvas and one modal editing
  drawer at widths up to 1000px. Layers and settings share that drawer. At phone
  widths the campaign actions menu holds Undo/Redo and campaign details; preview
  width choices use a menu. Display rules and Destinations use the available
  width without a side-by-side preview. Drafts remain editable during resizing.

The earlier 782px threshold followed WordPress's menu breakpoint. It was a
layout choice, not a requirement of capture or template rendering. The adaptive
editor removes that restriction from both initial loading and campaign creation.
The builder remains lazy-loaded when its route is opened.

## The measure is split for the same reason the floor is

The floors above are the same decision at the bottom of the range, and the
argument does not stop being true at the top of it. So the **ceiling** is split
too, and by the same test — what is this screen, and what does it need?

- **Reading screens cap at 80rem (1280px)**, amended by [ADR 0068](0068-reading-pages-put-results-and-routes-before-occasional-settings.md).
  Tables gain room for names and actions; long capture details retain a narrower
  measure. Reading tables become labelled cards at 900px and below.
- **The builder caps at 90rem (1440px).** It is a place rather than a list —
  a block tree, the controls for whichever block is selected, and a live preview
  of the design, three things a merchant works between rather than reads down.

**What the extra 288px buys is a third pane, not a wider column.** That
distinction is the whole of the decision. The block inspector's text inputs are
`widefat`, so a single column handed the extra width spends it turning a
*Placeholder* field into an 870px box for the word `you@example.com` — past
every measure form-usability research gives, and worse than what it replaced.
Spent on a column split instead it buys two things at once: the inspector stops
sitting below the fold on a long tree, and it sits next to the preview, which is
the shortest eye travel there is between typing a headline and seeing it.

The order is **tree · inspector · preview**, which is deliberately not the
tool convention. Figma, Divi 5 and Gutenberg all put structure left, canvas
centre, properties right, and the rationale is reading order — organisation
where you start, properties where you finish. We take the rationale and reject
the arrangement, because our canvas is an *output*: selection edits nothing in
it ([ADR 0040](0040-the-builders-preview-is-an-input.md)), so left-to-right
reads as the actual workflow — pick a block, change its words, see the result.
The preview is also pinned beside all four tabs, and a centre column belonging
to the screen flanked by two belonging to one tab is not a layout that survives
switching to Display rules.

**The split fires on a container query, not a media query, and that is
load-bearing.** wp-admin's menu is 160px expanded and 36px folded, so the column
actually available to the editor varies by ~124px at a fixed viewport width. The
existing `1024px` and `1280px` breakpoints in `index.css` are viewport-keyed and
therefore already wrong by that much on a folded menu; converting them moves
behaviour at every width and is not part of this, but the new breakpoint does
not repeat the mistake. The threshold — 48rem of container — is derived rather
than chosen: `768 − 352 inspector − 24 gap = 392`, which is precisely the tree
width the editor already survives at the 1024px stacking point. **Never split
until the tree would be narrower than a width it already works at.**

The cap stays a cap. At 2560px an uncapped row is ~1700px with a block's name at
one end and its `⋯` at the other, which is the failure a measure exists to
prevent — the answer to a wider screen is another pane or more air, never a
longer line.

## Accessibility gets a lint gate because intentions do not survive a deadline

[ADR 0035](0035-the-admin-owns-its-page.md) gave up what wp-admin was providing
free. **WCAG 2.1 AA** is the replacement bar, and it is held three ways:

- **Radix** covers keyboard interaction, focus management and ARIA — the part
  that is genuinely hard and the reason the primitives are worth a dependency.
- **`eslint-plugin-jsx-a11y`, blocking**, covers the mechanical failures —
  unlabelled controls, bad roles, click handlers on `<div>`s. Near-zero cost, and
  it fires on the pull request rather than in a review.
- **Contrast is measured at the token**, once, rather than per component
  ([ADR 0037](0037-the-admin-inherits-token-structure-and-owns-its-values.md)
  records the 5.95:1 for `--primary`; _amended: the current palette's ratios,
  14.62:1 for `--primary` among them, are in
  [ADR 0130](0130-the-admin-wears-the-wconvert-io-brand.md)_).

AAA is explicitly not the bar. It would rule out the palette on
[ADR 0037](0037-the-admin-inherits-token-structure-and-owns-its-values.md)'s own
numbers, and it is not what a WordPress admin screen is held to anywhere else.

**Nothing above is a minimum FONT SIZE, and this ADR has never set one.** The
floors are the four things listed: contrast ratios, the blocking lint, 24 × 24
pointer targets, and the two viewports. Said explicitly because `index.css` spent
a release carrying a comment that cited this ADR for a 12px type floor and used
it to refuse a 9px register —
[ADR 0066](0066-the-editors-chrome-is-one-card-with-three-named-panes.md) is
where that was found, corrected in place, and where what a small register IS held
to is written down instead: full-strength `--muted-foreground`, and no text that
is the only copy of itself.

### SC 2.5.7 is why the block tree's ↑↓ buttons survived a drag handle

*Recorded for the next person to tidy that row, so the reason is found before
the buttons are deleted.*

**WCAG 2.2 SC 2.5.7 (AA) requires a single-pointer alternative to any dragging
movement**, and W3C is explicit that a keyboard equivalent does not satisfy it
*"unless that equivalent keyboard operation also provides controls that can be
clicked or tapped"* — its own cited example being *"sortable lists: adjacent
controls for moving elements up or down"*.

So when the row adopted a drag grip, the ↑↓ buttons stayed. They are `opacity:
0` at rest and revealed on `:hover`, `:focus-within` and `[data-selected]`,
which is a cleaner list and is **not** a way of removing them: they remain in
the DOM, in the layout and in the focus order, because the treegrid's roving
tabindex requires every row to have the same cell count. Move up / Move down
also sit at the top of the row's `⋯` menu, which is the path reachable with no
hover at all and the one a touch user meets after tapping the row.

Three pointer paths and two keyboard ones (`Alt+↑`/`Alt+↓`, and arrowing to the
buttons). A row that replaced the buttons with the grip would fail this
criterion outright, however good it looked.

### SC 2.5.8: the grip passes at 16px and the twist does not

*Completed by #75, which measured the row rather than reasoning about it.* The
grip is 16 × 14 and the twist was 20 × 20, both under SC 2.5.8's 24 × 24 CSS px.
**Only one of them is a failure**, and the difference is worth stating rather
than fixing both blindly.

**The grip passes, under Equivalent.** The exception reads *"the function can be
achieved through a different control on the same page that meets this
criterion"* — the grip reorders a block, and the row's ↑ ↓ buttons and the `⋯`
menu's *Move up* / *Move down* are 32px pointer controls on the same page doing
exactly that. It is the same three-paths argument the section above makes for
2.5.7, read against a different criterion.

_Amended by [ADR 0066](0066-the-editors-chrome-is-one-card-with-three-named-panes.md):
**those controls are 24px now**, at `--control-height-xs`, and the argument is
unchanged rather than merely surviving — Equivalent asks for a control that
*meets* 24 × 24, and 24 × 24 is what they are. What moved is that they no longer
clear it by eight pixels._

**The twist does not.** It expands a row, and no other *pointer* control on the
page does — ← and → are keyboard, which 2.5.8 does not count, exactly as 2.5.7
does not count `Alt+↑`. Spacing cannot save it either: a 24px circle centred on
a 20px twist intersects the label button 4px away. So it is 24 × 24, and the
row's height went to 40px with 4px of block padding to hold it — which the row
needed anyway, having been exactly as tall as the 32px button inside it.

_Amended by [ADR 0066](0066-the-editors-chrome-is-one-card-with-three-named-panes.md):
**the row is 32px**, and it is still exactly the control inside it. 40px was
never a fact about the row — it was 32px of `icon-sm` action plus 8px of air.
The actions are `icon-xs` (24px) now, so the same 8px lands on 32. The twist did
not move, for the reason this section gives, and it is now the tallest thing in
the row: 24 + 4 + 4 = 32 is a FLOOR, which is why this editor does not reach the
reference tool's 22px however far the type shrinks._

**The lesson for the next control added to this row:** the exceptions are read
one at a time against the specific function, and *"there is a keyboard way"* is
never one of them.

## The testing line from #29 holds, and the existing tests become the net

[#29](https://github.com/navidkashani/wconvert/issues/29) says *"Not a TDD seam:
React component structure, panel layout, gallery chrome. Test the translation,
not the widgets."* Redesigning every screen is the moment that line gets tested,
and it holds — a test asserting a class name or a DOM shape is exactly the churn
it was written to avoid, and this change would break all of them for no signal.

What changes is what the **ten existing component tests** are for. They assert
behaviour — that a row shows its [[Goal]]'s label and not its id, that a
[[Suspended]] Optin reads as suspended, that the capture route registers the args
it must. None of that is markup, so **all ten should survive a total restyle
untouched**, and one breaking mid-redesign is the signal that behaviour moved
rather than that a test went stale.

That makes them the cheapest available guard on the widest change this codebase
has taken, and it costs nothing to adopt: it is a rule about how to read a
failure, not a line of new code.

## Consequences

- **`bin/check-loader.mjs` is untouched.** Its 8,192 bytes and the premium-import
  scan are unaffected by anything in the admin, and
  [ADR 0029](0029-the-free-contract-is-proven-at-the-source.md) already proves at
  every pull request that the loader's source imports nothing from
  `resources/admin/`.
- **A build prints the admin bundle's gzipped size**, so growth is visible where
  it is caused. *Amended by
  [ADR 0041](0041-the-admin-ships-as-a-module-so-it-can-split.md): it prints
  **two** figures now — what every screen pays and what the builder adds on
  top — because one total stopped answering the question the moment the split
  landed.*
- **The builder is a lazy boundary**, which means it is also the natural place for
  anything else heavy to land later without a conversation about the budget.
  *Built in [#73](https://github.com/navidkashani/wconvert/issues/73), and
  recorded in
  [ADR 0041](0041-the-admin-ships-as-a-module-so-it-can-split.md). This bullet
  originally continued: "Not built as of #63, which stood the reporting up …
  until it lands the printed number is the UNSPLIT bundle … the pessimistic
  figure and not the one a merchant checking yesterday's leads actually pays."
  That is no longer true. The reading screens are **132.6 kB** gzipped and the
  builder is **20.6 kB** fetched on demand, against 150.1 kB when everything
  loaded together. The obstacle named there — an IIFE cannot code-split — was
  real and is what made #73 a ticket; ADR 0041 is the three changes it took.
  The boundary itself is `resources/admin/src/builder/lazy.tsx`, and that is
  where anything heavy lands.*
- **Narrow windows open the same editor.** Accessible modal drawers provide
  focus containment, Escape dismissal and a return to the editing toolbar.
- **A per-screen measure is one prop and one custom property**, not a fork.
  `Shell` takes `wide` and `--wconvert-measure` answers it, and the masthead,
  the page-header band and `<main>` all read the same property — the three used
  to spell `max-w-6xl` separately, which is how the band's rule came to stop a
  hundred pixels short of the page body's edge once already. The convention
  source does the same thing from the other end: WSMS's `app-shell.tsx` defaults
  to `max-w-5xl` and keeps a `FULL_WIDTH_SECTIONS` allowlist. A second screen
  wanting the wider measure is one more call site, and any screen wanting a
  *third* number is a conversation rather than another literal.
- **A drag-resizable split is additive on top of this and is not it.** Figma's
  UI3 went that way; it needs a keyboard-operable resizer (SC 2.1.1), a decision
  about persistence, and a sensible default anyway — which is what the fixed
  22rem is.
- **If someone later shows the admin bundle actually hurting**, the escalation is
  a number in CI and a conversation — the same posture
  [ADR 0034](0034-the-dashboard-joins-in-php.md) takes on the index it did not
  add. It should be taken on evidence, not on principle.

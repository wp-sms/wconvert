# WConvert Admin — design guidelines

The durable half of this project. `BRIEF.md` is about one job and will go stale
when that job ships; this describes how the system works and is meant to last.

These guidelines are **authored rules**. The accompanying tokens, component
cards and screen evidence are generated from shipping code. When they disagree,
review the implementation against the rules and the relevant ADR; code is not
automatically correct because a screenshot generator captured it.

A prototype establishes hierarchy, workflows and visual direction. Implement it
with shared tokens and primitives. Change a guideline only for a reusable product
need, explain the reason in an ADR, and amend superseded rules inline. Do not
create a screen-specific exception merely to reproduce a prototype measurement.

---

## 1. The frame

**Harbor is the approved shared frame (ADR 0097).**

1. **Brand header** — solid espresso (deep teal before ADR 0130), with the mark, wordmark, Help,
   issue notifications and account entry. The top row is at least 78px.
   Four-section navigation sits on its own row, with the current section
   underlined in citron and a compact, bordered installed-plan badge at the opposite edge.
2. **Light title area** — `h1`, useful description and page action on the warm-white
   canvas. Headline and CTA stay outside the dark header. The primary page
   action is a solid espresso button with a paper label.
3. **Main work area** — white work surfaces against the canvas. Campaign filters,
   controls, rows and metadata form a single sheet.
4. **Service footer** — matching espresso, shared WConvert mark (inverse) and wordmark, plan
   badge, a useful resource link and Help. A quiet centered bottom row credits
   VeronaLabs with a muted monochrome logo. Publisher attribution has no hover
   underline; keyboard focus remains visible. Creation and the editor omit this reading-page footer.
   WordPress retains its toolbar and menu. Its footer and footer reservation are
   removed only on WConvert screens. Site names and URLs are not footer branding.

All four share `--wconvert-measure`: **80rem** on reading screens and **90rem**
when wide. Shell gutters are 48px, 28px below 900px and 20px below 600px. The
main work area can use a 12px outer inset on phones. Use logical layout and
wrapping; the footer stacks on narrow screens.

**There is no sidebar.** Four sections remain across the header. `--sidebar-*`
tokens exist for compatible vendored components, not a proposed second menu.

## 2. A screen is regions

A region is a bordered card with an optional header, toolbar and footer. What a
screen gets is decided by **scope**, not by taste — and scope is also what
decides how tall its controls are.

## 3. Control heights follow scope

| Height | For | How it is applied |
|---|---|---|
| **3rem** | Reading-page heading buttons and period/select controls | shared shell action scope |
| **2.25rem** | Fields and ordinary form actions | the default |
| **2rem** | What *qualifies* what is already on screen — a toolbar filter, a row action, a control inside a table, a dialog footer | being inside `.wconvert-toolbar`, `.wconvert-table`, `.wconvert-footer` or compact `.wconvert-page-actions` outside the reading-page heading |

A `.wconvert-footer` holds both kinds, so it states no height of its own: the
small floor applies, and a `default`-size button in it (a step's Continue) is
released back to 2.25rem. A dialog footer is a `.wconvert-toolbar` and is
always 2rem (ADR 0131).

Never pass `size="sm"` to make a toolbar control small. The container decides.
A rule about the toolbar belongs to the toolbar, not to each control that lands
in one.

The builder also has a **1.5rem** `--control-height-xs` for editing furniture
(ADR 0066). It is not a reading-page density option. On coarse pointers, shared
controls have a **2.75rem / 44px** floor, including menus and native inputs.

## 4. Shared type roles

| Role | Size | For |
|---|---|---|
| `micro` | 12 / 600 / 0.04em | table headers, chips, badges, stat labels |
| `note` | 13 | descriptions, notes, help text; a builder field's label at 500 |
| `hint` | 12 / 400 | the one line of help under a builder field (ADR 0136) |
| `body` | 14 | the body of the admin |
| `heading` | 16 | a region heading, a card title, an editor panel's title (a section inside a panel is `body` 600, ADR 0136) |
| `section` | 20 / 600 | reading-page section headings |
| `metric` | 36 / 600 | dashboard impact and target totals |
| `title` | 24 | compact editor title and footer wordmark |
| `display` | 36 / 500; 30 on phones (ADR 0132; was 44/36) | reading-page heading |
| `brand` | 26 / 600; 22 on phones | header wordmark |
| `item` | 15 / 600 | campaign and goal identity |
| `result` | 22 / 500 | compact result figure |
| `figure` | 30 | the one emphasised figure per Goal |
| `label` | 11 | builder furniture and quiet frame metadata |
| `meta` | 9 | tracked builder furniture captions only |

**A builder panel is one grammar** (ADR 0136, `builder/PanelSection.tsx`): a
section title is `body` 600 in sentence case; sections are 16px apart and
divided by one rule; fields inside are 12px apart; a label sits 6px above its
control. A fact is one row of label, value and link.

**`meta` and `label` never carry a control, a condition or a reason**
(ADR 0131). They are furniture: an uppercase caption, a pane's name, a count.
Anything a merchant presses, any rule that predicts what a visitor sees, and
any sentence saying why something is refused is `micro` (12) or `note` (13).
A 9px refusal is a refusal nobody reads.

DM Sans is self-hosted with its OFL license. The system fallback covers missing
glyphs. Font assets use content-hashed URLs so different weights cannot share
stale cache entries. Do not reach for a Tailwind size outside this list. Before the roles existed,
103 of ~115 text elements on the builder were 14px and nine sizes were in use;
headings, body, labels and descriptions were separated only by weight and
colour.

## 5. Colour means something

- **Four roles (ADR 0130).**
  - **Espresso `#302720`** is structure: text, buttons, and the header and
    footer bands.
  - **Ink blue `#1F5A6B`** (`--action`) is what you can act on: links,
    selected tabs, chips and list items, checkboxes, the chart line and focus.
    Links are also underlined.
  - **Citron `#E2F475`** is the brand. It fills the `brand` button, on an
    espresso edge, once per screen, and it is the signal on the espresso
    frame: the active tab, the unread dot and focus. It is never text on a
    light surface.
  - **Ice blue `#E0EFF3`** is selection, info and the paid plan.

  The canvas is a near-neutral warm white, **`#F6F5F1`**, and work surfaces
  are white. It is deliberately less saturated than the site's paper.
- **Surface roles are shared across screens.** Use `--card` (white) for cards,
  including goals and monthly targets. Use `--surface` (`#EFEDE8`) for inset
  content and table headers, `--secondary` (ice) for selected states and icon
  wells, and `--accent` for hover. Do not tint whole cards nearly the same color as the canvas.
  `--border` (`#DEDAD1`) separates surfaces; muted text is `#6B6056`.
- **Semantic colors retain their meaning**: destructive failure, success
  converted, warning suspended or nearly-limit, info neutral fact. Each one
  has a `--*-surface` token. Never use a percentage wash of the hue: on this
  warm palette, an amber wash is indistinguishable from the canvas. Status always
  includes text; do not use hue alone to distinguish it from the brand.
- **Two edge tokens, because they are two jobs.** `--border` draws dividers and
  card edges, which are decoration. `--input` draws the edge of a control,
  which is information a user needs to identify a component and owes 3:1 under
  WCAG 1.4.11.
- Every contrast figure in the Foundations card is measured, not estimated.
- **Answer colors** (`--answer-1…6`, each with a `-surface`) mean one answer
  on the Flow map: its line, its "Only if" chip and the result that uses it
  (ADR 0142). They are never decoration, never the chart palette, and never red,
  which stays for problems. Lines hold 3:1 on the card and the canvas; text in
  a pill holds 4.5:1 (`tests/js/answer-palette.test.ts` measures both). The
  map's kind tiles (`--kind-*`) are the one other hue set: a quiet tile beside
  the kind's word, its icon at 3:1 on its surface.
  Only an answer that a one-answer rule uses gets a color, so every color in
  the side panel (answers, lines, results, "Arrives from") also appears on
  the map.

## 6. Quiet surfaces

Shared shadow tokens are `none`. Use surface contrast and fine borders for depth,
with 6px control corners and 8px work surfaces. No gradients or decorative motion.
This supersedes the earlier hard-offset shadow direction (ADR 0097).

Expanded destination settings remain white. Place usage notices inside the form's
padding, on a solid `--surface` inset, and keep fields on the card surface. Do not
stack edge-to-edge tinted panels or repeat the same shared-change warning.

### Shared implementation contracts

- `RegionHeader` owns symmetric header padding and its optional leading icon.
  Do not target descendant headings with screen-specific padding overrides.
- `DialogContent` and `AlertDialogContent` default to `--card`, including portals
  outside the admin mount. Popovers and menus use the white `--popover` surface.
  Neutral inset notices use solid `--surface`, not translucent `bg-muted/*` fills.
- Native single-select fields share an explicit chevron, logical end padding and
  RTL placement. Multi-select/listbox controls keep their own affordance.
- `InfoTip` owns contextual help in Analytics, Leads and the builder's panels (ADR 0136): a 16px Info glyph in a
  32px control, expanded for coarse pointers by the shared control rules. Its
  popover handles viewport edges, Escape dismissal and returning keyboard focus.
- The header navigation divider spans the row; individual navigation and plan
  elements do not draw disconnected pieces of the same line.

## 7. Every control has the shape of its value

The dispatch rule, in order:

1. **A control that enumerates reads the manifest. One that infers reads the
   value.** Neither arm names a token, and no code should need a per-token table
   of components.
2. **One-of-N is chips while N is small, a popover list once it is not.** The
   switch happens at a count the manifest does not control. The popover list is
   the **option menu** (`components/ui/option-menu`, ADR 0139) — list mode for a
   searchable list, menu mode inside a ⋯ — and a choice of two or three words
   inside a sentence is a `NativeSelect` drawn as a `word` or `pill`.
3. **A measure is a slider** — one or two components. Anything a slider cannot
   express falls through to Custom, deliberately.
4. **A colour is a popover whose trigger shows the current value.**
5. **A free-text box is an escape you opt into, never the control you land on.**
   It is reachable by pressing *Custom*, or by holding a value nothing in the
   bundle can read. Both mean the merchant already said something specific.

**A segmented control is native radios in a `role="group"`** — arrow keys, one
tab stop and the set announced as a set, all from the browser. Radix's
`ToggleGroup` buys behaviour the browser already gives, at bundle bytes this
admin prints on every build. **An `aria-pressed` button group is never one-of-N**;
`aria-pressed` is for an independent toggle (ADR 0131).

**A window of days is `shell/DateRangePicker`** (ADR 0132): one button naming
the window and its dates ("Last 30 days · Sep 9 – Oct 8"), opening presets as
native radios, Custom dates, and anything that qualifies the window. No screen
draws its own period select or date card.

**Three one-of-N shapes, and no fourth** (ADR 0131):

| Shape | For |
|---|---|
| `shell/OptionStrip` chips | page toolbars and dialogs — period, compare, device |
| `.wconvert-choice-set` | compact inspector settings |
| `.wconvert-radio-card` | a choice that needs a sentence of its own — retention, transfer, graph insert, capture mode, recommendations |

The same concept is drawn the same way everywhere: preview device is an
`OptionStrip` in the picker, the preview and the editor canvas.

**One checkbox and radio row** (ADR 0131, `shell/CheckRow`). An 18px native
input inside its `<label>`, centred on the first text line, 8px from the text.
A hint is a `note` under the label TEXT, not under the box, and is the input's
description. The shared rule in `index.css` draws it at `:where()` specificity
so any component class can restyle a row; nothing restates the box. Coarse
pointers give checkbox rows the same 44px floor as radios. The Radix
`Checkbox` is retired, so a dialog and a page draw the same box.

**One field** (`shell/Field`): label above, 6px, the control, a `note` hint
below, an error under that. The builder's panels use its denser form,
`PanelField` (ADR 0136): a `note` 500 label with its InfoTip and actions on one
row, and a 12px `hint`. **One select** (`components/ui/native-select`) and
**one textarea** (`components/ui/textarea`), at the shared control height.

Template picker option strips use button-like chips: visually clip the native
input, remove WordPress pseudo dots, and put selected and focus treatments on
the label. Do not draw both a chip selection and a radio circle. Device and
screen groups have an explicit gap; a long screen list uses a labeled select.
Picker toolbars use the same 32px height for search, selects and buttons, with
44px minimum targets for coarse pointers. Compare uses one shared checkbox
treatment and a tray naming the selection. Pagination stays outside a scrolling
gallery body, so it remains reachable without scrolling through every card.

## 8. The admin speaks only when it changes what you do next

Before designing a message, ask: **if the merchant did not read this, what would
they do differently?** No answer means no message.

- An error **names a door that is on this screen** — and comes with the door,
  not a description of where it is.
- Never offer what will be refused. Mark it before the click, with the reason.
- Status that is simply true of a row is a **badge** on the row, not an alert.
- **There is no toast.** A message worth showing is worth leaving beside the
  thing it is about.
- WordPress's own admin notices are suppressed on this page, so every notice
  here is one somebody chose.

Deleted on sight: "Settings saved", "You can always change this later", a
description under a control whose label already said it, a text box echoing a
value shown beside it, an onboarding tour on a working screen, a marketing
line, a reassurance repeated on every card, a permanent "No unsaved changes".

**Save feedback is "Saved just now", beside the Save button** (`shell/SaveStatus`,
ADR 0131). It appears when a save succeeds and clears on the next edit, so it
is only ever true. No toast, no "…saved." sentence at the top of a region.
Every settings section has an explicit Save; nothing autosaves a setting.

**No ID on any screen** (ADR 0131). A missing name reads "Deleted campaign",
"Removed destination" or "Unnamed", never a ULID. Search still accepts a
pasted ID. There are two exceptions. Campaign Details' closed "For developers"
disclosure shows the campaign ID with Copy, because the free page events
identify a campaign by nothing else. The inline campaign's shortcode (the
"WConvert campaign" block and manual placement) carries it too, because it is
how a campaign is placed outside the block editor.

**Data is shown once, one way** (`lib/format.ts`): dates in the site's locale
and timezone — "Today, 2:22 PM", "Yesterday", "Oct 3" in a list, "Oct 9, 2026,
2:22 PM" in a detail — counts and rates in the site's digits, money in the
store's currency, and every stored key through `labelOf()`, so no screen
prints a field key or a WooCommerce status slug.

## 9. Layers

| Use | For |
|---|---|
| `Dialog` | something the merchant can walk away from |
| `AlertDialog` | destructive confirmation — says what *survives*, not just what goes |
| `Popover` | an explanation they asked for; never a substitute for a control the screen should have shown. Two exceptions, both a button that IS the control and a popover that holds its choices: `shell/DateRangePicker` (ADR 0132), and a rule row's value pill (ADR 0139) |
| `DropdownMenu` | row actions past the first two |

**Entry and dismissal are immediate.** A shared no-motion rule includes portaled
admin layers and overrides retained vendored animation classes. Focus, keyboard
behavior and dismissal semantics remain unchanged. Verify computed styles in the
browser, since a class-name test cannot establish the final cascade.

**One modal layout, three sizes** (`components/ui/admin-dialog`, ADR 0131):

| Size | Width | For |
|---|---|---|
| Small | 32rem | confirms, short forms |
| Medium | 48rem | details — a lead, a campaign |
| Large | 80rem | pickers, the journey, preview |

- **Header:** the title is the subject itself (a person, a campaign), an
  optional status badge, and one muted meta line. Titles truncate before ✕.
- **Body:** the only part that scrolls.
- **Footer:** fixed. Back or Cancel at the start (or a secondary way out such as
  Review & publish's Preview, ADR 0138), an optional short note, the
  primary action at the end, and an error beside the actions. Footer controls
  take the toolbar scope.
- **Dirty:** Escape, an outside click or ✕ asks "Discard changes?" only when
  something was typed (`dirty`), and the question is drawn inside the dialog.
- **Never nested.** A dialog that leads to another view opens it in place with
  Back. A destructive confirm is an `AlertDialog` that says what survives; red
  is for delete and remove only. A status change asked from a details dialog
  (Publish, Unpublish) confirms in the footer's place — the footer becomes the
  question — rather than in a second dialog (ADR 0137).
- **Facts are one icon list** — `shell/FactList`, a label beside a 16px icon
  and its answer, one line each, amber for one that needs a look. Details, the
  setup preview and the design preview all use it (ADR 0137). **How it runs**
  is one list, `optins/campaignFacts`, in Review & publish and both Details
  (ADR 0138).
- **One body per subject.** Two dialogs about one thing share their body and
  differ only in header, footer and the sections only their host has: campaign
  Details is `optins/CampaignSummary` in the list and the editor (ADR 0138).
- **A mode is a tab, not a menu.** Preview is one button and one dialog with two
  tabs, Try the form and Who sees it; one screen is looked at on the canvas,
  never in a second preview (ADR 0138).

Template discovery dialogs are `PickerDialogContent` — a Large `AdminDialog` —
with a single scroll body and a separate action footer. Back and Use/Install
stay reachable in short and phone windows. Pack and collection pagination stays
outside the scroll body. Use-case choices and screen exploration belong to
inspection, never dropdowns on result cards. A single result keeps the ordinary
card size. Long placement, measurement and journey guidance uses labeled
progressive disclosure beside the preview. Inspection is for looking: the
preview stays clickable but carries no journey test, which lives in the editor.
Its toolbar is one row — Desktop | Mobile, a labelled Screen choice, and a fit
toggle at the end — and it opens on the whole design on desktop and the width
on a phone (ADR 0137). Dialog headers align to the start
on every viewport; close controls have a 32px target (44px for coarse pointers).

Creation cards open inspection before the draft action, except the one **Start
here** card drawn above a list of more than three setups, which offers Use this
setup directly (ADR 0132). A library toolbar is two rows: search, sort and a ⋯
for other ways to browse; then the main facet chips, a compact More filters
toggle and the count. Shared cards place the
name and Save together, metadata on its own row, then Preview and Compare. Do
not scatter these controls between metadata and actions. Full inspection starts
at width fit with vertical scrolling for tall content; offer Fit entire design
for an overview. Comparison retains equally sized fitted stages. Errors and
recovery actions belong in the active modal, including an uncertain creation
result. Country choices use names and searchable selection, not code entry.
Keep collection introductions concise: one description in the header, stage
and search controls alongside each other when space allows, and no redundant
format filter for a single-format collection. Keep the page count visible for
one page, but omit Previous/Next until there is another page to visit.

## 10. Tables

`shell/DataTable` is what list screens render — semantic roles, a `data-label`
on every cell, `micro` uppercase headers, tabular end-aligned numbers. Below
**900px and below** the whole table restacks into cards and those labels are what each
value is read against — except the one cell marked `heading`, which names the row,
takes the card's first line unlabelled and has the row's actions beside it
(ADR 0039, amended by #269). (The builder has no floor of its own any more: it adapts
down to phone width — ADR 0038, amended — and 900px is a table's number alone.)

Row actions are ghost `icon-sm` buttons in a `1%` column. Past two, use a
dropdown.

`components/ui/table.tsx` was deleted rather than left where somebody would find
it: it neither restacks nor reads RTL.
## 11. A screen is four situations

Every screen in this admin is **empty, loading, failed and full**, at 360px and
at 1440, in LTR and in RTL, with features the site can use and features it
cannot. Consistency here is whether two screens answer the same situation the
same way.

The three data states are the one thing already forced: `shell/loadable.ts`
defines `Loadable<T>` as `loading | ready | failed`, so every screen must branch
on all three. What is not forced is that the three branches **look alike**
across screens — so §§11–15 state the answers, and the `Screens` group is those
answers rendered side by side. ADR 0060 carries the full matrix, sixteen regions
by four states; read down a column to find a gap.

Two columns in it are deliberately thin. *Empty* is `n/a` wherever a region
holds a **setting** rather than a collection — a retention period has no empty
state, it has a default — and the builder's frame has none because an Optin that
does not exist is not reachable from it.

An empty state says **what will fill it and when**. It is not an apology and not
an onboarding tour. Every list screen has one and a merchant meets it before
they meet the full version, so it is designed first, not last.

## 12. Loading

**A region that fetches owes a loading state, and it is never the empty state.**
`EmptyState` says *you have none*, which is a claim; while the answer is still
arriving it is a claim that is not yet true.

**A skeleton mirrors the layout it replaces.** That is the whole of why it is
not a spinner: the columns do not move when the data lands, so the screen does
not jump.

| The region is | The skeleton is |
|---|---|
| a `DataTable` | `TableSkeleton` |
| a `ChoiceGrid` of cards | `ChoiceSkeleton` |
| a gallery of rendered designs | `GallerySkeleton` |
| a `StatRow` | `StatRowSkeleton` |
| a list of choices with a control at the leading edge | `RowsSkeleton` |
| the builder's Flow map, while its code loads | `FlowSkeleton` |
| anything else — a form, a run of sentences | `RegionSkeleton` |

Picking one by what is on screen rather than by what is coming is the failure
this table exists to stop: Analytics drew a headless four-column `DataTable`
where a heading, a row of four figures and a sparkline were coming, and
Destinations drew a three-column table where a stack of settings cards was.
Neither region contains a table in any state.

**A text placeholder is sized in `1lh`, never in pixels.** A figure's box is its
LINE box and the type scale pairs a line-height with every size, so `1em` came
up four pixels short on two of the three numbers in a stat row. `1lh` is the
same height by construction whatever the scale does next — which is why no
skeleton in this admin states a `min-block-size`.

**Waiting 160ms is a property of what the placeholder replaces, not of
loading.** Both behaviours are correct and they answer different situations:

- **A skeleton that replaces content the merchant was already reading waits.**
  That is the flicker case — the region has something in it, a re-read lands in
  tens of milliseconds, and a placeholder that appears and vanishes inside one
  is a screen that blinks. `TableSkeleton`, `ChoiceSkeleton` and
  `GallerySkeleton`, the last two because picking a different Goal puts a filled
  step back into `loading`.
- **A skeleton filling a region for the first time paints at once.** There is
  nothing to flicker against, and drawing the shape immediately is what reserves
  the height. `StatRowSkeleton` exists for exactly that — its numbers arrive
  after the page and would otherwise push the tab strip down — and
  `BuilderSkeleton` is the sharpest case of all, because it carries the way OUT
  of the builder while the chunk loads.

`shell/skeletonDelay.ts` is where that line lives, so a new skeleton chooses
rather than copies.

**The announcement belongs to the skeleton and never to the call site.** One
`role="status"` reading *Loading…* per region, with every bar `aria-hidden` — a
screen reader has nothing to gain from twenty-eight empty cells. Leaving it to
callers is how three of the four choice-and-gallery loading states in this admin
came to be silent.

**A busy control is `disabled`, and it is a different thing from a refused
one** — see §14.

**There is one loading pattern**: `RegionSkeleton` / `RowsSkeleton` and the
other skeletons above, each with a status line naming what is loading. No
spinner stands in for a region (ADR 0131); a spinner is only a busy control's
icon.

## 13. Failure

`messageOf()` is the one place a thrown thing becomes a sentence, because
`apiFetch` rejects with WordPress's REST error body rather than an `Error` and
five screens each rendered `[object Object]` before it existed.

**Which treatment, by what is left on screen:**

| Situation | Treatment |
|---|---|
| A first read failed — the region has nothing to keep | `RegionErrorState`, as the region's whole content |
| A refresh failed and one region's data is still on screen | `RegionError`, at the top of that region |
| A read that feeds the WHOLE screen failed and its data is still on screen | `PageError`, above the regions |

**A refresh that fails keeps what is on screen.** Emptying a table a merchant is
reading because the second fetch timed out is a worse answer than stale rows
under a banner saying so, and only a FIRST failure has nothing to keep. The
shape is one line and every multi-fetch screen spells it:

```ts
setThing((current) => (current.status === 'ready' ? current : failed(cause)));
```

Analytics was the one screen without it, so changing the window from 30 days to
7 and failing destroyed every Goal card on screen.

**Where the error goes is decided by what failed, not by where there is room.**
`RegionError`'s rule against a page-top banner is scoped to a screen whose
regions fail **independently** — an error a long way from the control that
caused it is an error whose subject the merchant has to guess. Three screens are
not that shape: Analytics reads one payload and draws a card per Goal from it,
Destinations reads one payload and draws a card per route, and the builder's
save acts on the whole draft. `PageError` is that case, and it is drawn without
a surface behind it, because a page-scoped error is not a region and must not
look like one.

**An error names a door that is on this screen** (§8). Pass `onRetry` to
`RegionErrorState`, `RegionError` or `PageError` and the door is one button,
**"Try again"** — the one retry word (ADR 0131). Reload is
the fallback when no local retry is possible. Keep the previous accepted data
visible when a refresh fails, with a clear stale-data explanation.

**Loading names the concern.** `RegionSkeleton` displays “Loading [region]…”
as an accessible status. Placeholders stay static; a pending read must never
claim that there are no results. Empty campaigns explain the goal → design →
publish sequence and offer the first action.

**A region's error carries no dismiss control.** It clears when the next fetch
succeeds, so there is no path where a merchant hides a failure and then reads
the stale data underneath it as current.

**A failure is drawn even where nothing else is.** A read that failed
silently leaves the merchant unable to tell there was anything to see, and no
failure ever reads as empty.

## 14. Unavailable

There has always been a shared decision function; what was missing is a shared
*rendering*. This is the largest surface for disagreement — twelve renderings
had grown, in four families — and the one a merchant is most likely to feel.

**Why is the server's; how is the surface's.** `goals/availability.ts`'s
`renderingFor()` maps `ready | locked | unavailable` × `creation_flow |
settings_list` to `offer | upsell | explain | hide`, and **no surface ever
renders `unavailable` as an upsell**. That half is load-bearing: a paying
customer must never be shown an advertisement for Pro, and we must never offer
to sell a merchant a WooCommerce licence we do not have.

**`locked` and `unavailable` never collapse into one sentence.** They mean
opposite things — *you have not bought the tier* and *this site is missing
something* — and collapsing them is precisely how the two failures above happen.
Three places had collapsed them.

**What each badge colour means**, because this is where the collision was:

| Colour | Meaning | Where |
|---|---|---|
| **Amber** (`warning`) | **The site is holding this back.** | Suspended, *Paused*, *Needs X* |
| **Grey** (`secondary`) + a lock | It costs money. | every Pro upsell |
| **Green** (`success`) | It is working. | *Delivering* |
| **Red** (`destructive`) | It is broken. | *Failing* |

Amber previously meant *suspended*, *paused*, *needs a plugin* **and** *buy Pro*
depending which screen a merchant was on. `StartingPoints` had the rule written
in a comment and was following it; `GoalCard`, `Gallery` and the Destinations
card were doing the opposite.

**A refusal is `aria-disabled`. A busy control is `disabled`.**

- A control refused because of what the site IS keeps focus, so the sentence
  saying why it cannot be pressed is a sentence a keyboard user can reach. The
  handler declines; pointer events stay on, because turning them off would also
  stop a click from focusing the control.
- A control that is merely BUSY — a save in flight, a prefill round trip — takes
  the real attribute and gets out of the way for the half-second it is working.

Radix's `DropdownMenuItem` takes `disabled` as a prop and renders
`aria-disabled` rather than the HTML attribute — but its keyboard then skips the
item, and the reason with it. A refused option-menu item sets `aria-disabled`
itself and stays a keyboard stop (ADR 0139); `disabled` is kept for busy.

**A refusal is marked before the click, with the reason, and the reason is
announced with the control** (§8). In a menu the reason has two lengths
(ADR 0139): a few words on screen and the full sentence in ⓘ, and the sentence
is the item's description, so both are heard. That last clause is not decoration: `GoalCard`
passed its refusal as the card's ordinary `notes`, which carry no `id`, so
`aria-describedby` pointed at the title and a screen reader heard a dimmed
button and no reason at all. `ChoiceCard` and `TemplateCard` both take a
`reason` with an id of its own.

**Nothing spells a tier's name.** `tierName()` for a badge,
`tierProductName()` for a sentence — both read `tiers.json` through
`window.wconvertAdmin.tiers`, so renaming the product is a manifest edit rather
than five strings and a release.

**A locked design is a link, never a disabled button.** The design is not on
this install to be used, so an "unavailable" control would be a control for
something that is not there. What a merchant can do is look at it, so that is
the affordance.

## 15. Direction

**Every box is written in logical properties.** `inline-start`/`inline-end`,
`block-start`/`block-end`, `ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`, and
`text-start`/`text-end`. Across every `.tsx` this project wrote and across 4,470
lines of `index.css` there are zero exceptions. `components/ui/` — the code
nobody wrote — carried six, and those files are WConvert's from the moment they
land.

The exceptions, and they are the only ones:

- **A symmetric centring transform.** `left-[50%]` with `translate-x-[-50%]`
  lands in the same place either way round.
- **`data-[side=…]` slide-ins.** Radix has already resolved the side for the
  current direction; rewriting it logically would resolve it a second time.
- **`box-shadow`, which has no logical form.** The selected-block rail is the
  one physical direction in `index.css`, and it states a `:dir(rtl)` override
  beside itself.
- **Coordinates of a laid-out picture.** The Flow map's cards, pills and lines
  sit at the `left`/`top` its layout computed, already mirrored for RTL, inside
  a scroll box that is itself `dir="ltr"` (ADR 0142). A logical property would
  mirror them a second time. The words on each card still take the page's
  direction.

**A directional glyph is mirrored.** A Back arrow, a submenu chevron, a
disclosure twist, the corner arrow marking an A/B arm — `rtl:-scale-x-100` in a
component, `:dir(rtl)` in the stylesheet. There was no `rtl:` variant, no
`[dir=rtl]` selector and no `:dir()` rule anywhere in the codebase before this,
so `OptinList`'s `CornerDownRight` — the entire visual grammar of the nesting —
pointed away from the row it belonged to on every RTL install.

**A glyph that is symmetric, or that means up or down, is left alone.** Up is up
in Persian: a list runs top to bottom whichever way the words run, which is why
`BlockTree.mirrored()` swaps ← and → and nothing else.

**A Radix root takes `dir={useDirection()}`.** Every Radix primitive resolves
its direction through a `DirectionProvider`, falls back to `ltr` when there is
none, and then writes that answer onto the DOM as a real `dir` attribute — which
beats inheritance. So one root saying `ltr` pins everything under it the wrong
way round inside an admin the browser had laid out correctly. `Tabs` and
`DropdownMenu` take it at the root; `PopoverContent` and `TooltipContent` take it
on the portaled content, so no call site has to remember it. The Radix `Select`
that first shipped without it — the Leads filter opened a popup reading LTR — is
deleted: a tiny list is a native `<select>`, which inherits the direction for
free (ADR 0139).

`admin-rtl.test.tsx` asserts each of them, and asserts the logical-property
convention over `components/ui/*.tsx`; `admin-stylesheet.test.ts` asserts it
over `index.css`. That pair is the guard.

## 16. Responsive

**Every table goes through `shell/DataTable`**, whose `data-label` is enforced
by the prop type — so the 900px-and-below restack into row-cards cannot be
forgotten.

**A control strip wraps and a control's label wraps with it.** The height in the
four strips is a MINIMUM, not a fixed size: *"Erfassungsdatensätze als
CSV-Datei herunterladen"* in a `whitespace-nowrap shrink-0` button takes the
whole screen sideways at 360px.
_Amended by [#269](https://github.com/wp-sms/wconvert/pull/269): **a one-of-N
`OptionStrip` may scroll inside itself instead**, below 640px, with
`.wconvert-option-strip--scroll`. Its choices stay one row, its cut edge says
there is more, and the page still never moves sideways. Toolbars and footers
still wrap._

**A long unbreakable token wraps.** `overflow-wrap: anywhere` on the data cell,
because a 60-character email, a captured field value or a provider error
carrying a URL otherwise overflows its own card on all four reading screens.
`anywhere` and not `break-word`: only the former lets the long word count
towards `min-content`, which is what makes a content-sized track shrink to fit
rather than clip.

## 17. Floors

- **WCAG 2.1 AA**, enforced by lint. AAA is explicitly not the bar.
- **360px** on the reading screens. The builder adapts down to phone width
  rather than refusing: one editing drawer at 1000px and below, phone layouts at
  640px and below (ADR 0038, amended 2026-09-23 — it used to refuse below
  782px).
- Any dragging gesture owes a **single-pointer alternative** (WCAG 2.2 SC 2.5.7).
- **No dark mode in 0.1.0.** `dark:` is bound to a class no element carries, so
  the vendored `dark:` utilities never fire. When it lands it is a second set of
  values under the same names and a `.dark` on the mount node — no component
  touched. The tokens exist; no screen has been measured in it.

## 18. Deliberately absent

Not gaps. Each was decided:

| Absent | Why |
|---|---|
| Dark mode | out of scope for 0.1.0 |
| A sidebar | four sections across a header instead |
| Toasts | a message worth showing stays on the screen |
| WordPress admin notices | suppressed; the admin owns its page |
| `toggle-group`, `radio-group` | native radios already do it, for free |
| Decorative shadows, gradients and motion | Harbor uses solid surfaces and clear hierarchy |
| A dismiss control on a region's error | it clears when the next fetch succeeds |
| A loading spinner for a region | a skeleton mirrors what is coming |
| An ID on a screen | names, or "Deleted campaign"; the developer disclosure is the one exception |

## 19. Changing the system

- Components are **vendored from shadcn upstream** and then become WConvert's
  own files. Never copied from WP SMS.
- **Token names are WP SMS's; values are WConvert's.** Renaming one breaks the
  drop-in property with every component either product produces. Adding one is
  free.
- A new primitive arrives via `npx shadcn add` and is edited in place after.
- Changing a token here changes nothing until it changes in
  `resources/admin/src/index.css`. This project is a mirror, not a source.


## 20. Campaign management applies the shared grammar

- The four-column campaign list is a grid variant of `DataTable`. Thumbnails
  and names open saved-design details; explicit row actions lead to editing.
  Gallery reuses those rows and semantics. On cards, identity is the heading,
  status/results retain their labels, and actions form the footer.
- Use `StatusBadge` everywhere: **Draft**, **Published**, **Suspended** and
  **Deleted**. Publication is a snapshot state, not proof of current visibility.
  **Unpublish** returns a campaign to Draft. Saved changes are neutral information.
- The anchored grouped row menu is a `DropdownMenu`, not a modal. A publishing
  confirmation uses the primary action; deletion and replacement use destructive
  actions. A known missing design explains why publication is disabled.
- Campaigns, results, previews and vocabulary can fail independently. Draw the
  failed concern with a shared error and Retry. Keep accepted results, dates and
  links together during loading or failure. Skeletons reserve the upcoming
  thumbnail and field layout in either view.
- Busy state belongs to the affected campaign family. Navigation waits for
  pending writes; unrelated families remain actionable.
- **One name per thing, lowercase in a sentence** (ADR 0131). A **lead** is
  the person; a **submission** is one form fill. "Email or phone", never
  "identifier". **Send** and **send again**, never push or re-push. **Shown**
  is the one name for impressions. **Keep in WConvert only** is the one name
  for local mode. Editor tabs are **Screens · Design · Display rules ·
  Destinations** (one **Edit** tab replaces the first two, ADR 0134), and the
  way from one screen to another is a **line**, never a path, destination or
  connection (ADR 0142). The rest of the editor's words are `CONTEXT.md`'s
  list: Look, Screen, Line, Follow-up question, Only if…, Form, All other
  answers, Then. `tests/js/flow-words.test.ts` refuses the retired ones. Domain nouns (campaign, goal, lead,
  destination) are lowercase mid-sentence; capitals start a title, a button
  or a sentence. US spelling.
- **More than two row actions go in a ⋯ menu**, with icons and labels. A
  row menu holds actions on that row. A list's foot is one line: its count,
  dates and pages (ADR 0132).
- **An inline disclosure's chevron sits beside its words**, not at the far end
  of the row; a card disclosure keeps the whole-row trigger (ADR 0132).
- **One primary action per screen, even when empty.** An empty list carries
  its own Create button, so the page header drops its copy until a row exists.
- **A filter chip that would filter to nothing is not offered.** Status chips
  show All, the statuses in use and the selected one.
- **A count is shown against what it is out of.** A campaign's result reads
  "105 email submissions · 2.5% of 4,210 shown", not the count alone.
- Tier names come from the shared vocabulary. The header’s temporary `#` account
  link is an explicit user-approved exception, removed when an account destination
  is supplied. It is not a general permission for dead links.
- New stylesheets must join the type/RTL source-contract checks. Verify actual
  WordPress at desktop and 360px, including keyboard selection, long labels,
  RTL and effective coarse-pointer target sizes. Source tests cannot prove layout.

## 21. Editor cards, lists and disclosures

These contracts apply in Edit, Flow inspectors, Theme & layout, Display rules,
Destinations and their dialogs. See ADR 0108 for journey semantics; presentation
must not imply that mutually exclusive paths are sequential visitor steps.

### Ownership and cascade

- Put the layout class on the element that owns the layout. A route list uses
  `.wconvert-journey-routes__list`, not `.wconvert-journey-routes > ol`: adding a
  visibility wrapper must not remove its reset, spacing or card treatment.
  Direct-child selectors remain useful *inside* an owned component.
- Generic native-control defaults must have lower specificity than component
  classes. Use `:where()` for the generic element/attribute selector. Never let a
  text-button reset erase a navigation card's padding, border or background.
  Shared `data-slot` components retain their own variants.
- Fix the owning rule in place. Do not append competing overrides for the same
  property or add `!important` to conceal an ownership/specificity problem.
  Use the existing utility-layer convention only when overriding important
  Tailwind utilities deliberately, and document that boundary.
- Control lists explicitly reset markers, margin and padding. Preserve list
  semantics where WebKit suppresses them with `list-style: none`. Prose lists keep
  their bullets. Show priority once; the last way is “All other answers”, not another
  numbered decision. Never globally strip list markers to fix one component.

### Card anatomy and text

- Route cards use a white `--card` surface, `--border`, shared corner radius,
  12px insets and 12px between cards. Expanded content has its own 12px inset and
  one divider; avoid nested tinted panels for ordinary settings.
- Route condition text uses the note role (13px, medium/semibold); its destination
  uses the micro size (12px, normal weight). Keep explanation text secondary,
  without shrinking actionable labels to the 9px metadata role.
- **One collapsible** (`shell/Disclosure`, ADR 0131). The whole row is the
  trigger; a trailing 16px chevron turns when open; the body's inline start
  lines up with the title text. `card` is bordered; `inline` has no border, for
  "Other details", "For developers" and help inside something else. No browser
  triangle, no leading chevron, no icon swap, no text-only toggle. Plus/minus
  is for adding and removing.
- Use a fixed badge/icon column, `minmax(0, 1fr)` for the label, and a fixed
  trailing indicator. Labels allow wrapping, including unbroken merchant text;
  decorative icons never shrink. Do not truncate conditions needed to predict
  the visitor's path.
- Navigation cards show their title and context on separate lines. Action rows
  wrap with an explicit gap and remain separated from the last card. Do not
  align controls by inserting spaces or relying on paragraph margins.

### Interaction and verification

- Every enabled action has pointer feedback and visible keyboard focus. Hover
  must not change geometry. Selected/open state remains identifiable; destructive
  actions use the shared destructive treatment. Disabled controls keep their
  disabled appearance and do not respond as enabled actions.
- Native `details`/`summary` provides disclosure behavior. A custom button must
  expose `aria-expanded`; decorative icons are hidden from assistive technology.
  Follow the [WAI disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/).
- Inspect the real WordPress cascade, including portal dialogs. Test a collapsed
  and expanded route, fallback-only routing, grouped follow-ups, results, contact
  fields, display-rule controls and destination selection. Include long labels,
  a narrow inspector, keyboard focus and disabled/destructive actions.
- Check reflow at 320 CSS pixels as well as desktop. The map may pan in two
  dimensions; text/forms in its inspector must still wrap. See
  [WCAG reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- Tests that render components in jsdom do not establish visual correctness.
  Record real-browser computed styles and overflow checks for cascade defects,
  together with the states actually inspected. Never describe a partial sample
  as proof that every screen or locale is correct.


## 22. Journey map hierarchy

The Flow map is one readable map (ADR 0142). The approved prototype is the
review gate: claude.ai/artifact/DSepKjR4jpkGcKEKiFM2m9.

- **Top to bottom, readable at Fit.** Fit never goes below 70%; a larger map
  scrolls, and the overview in the corner shows where you are and pans on
  click. Plain wheel scrolls; Ctrl/⌘-wheel and pinch zoom inside the map only.
  The toolbar is − % + · Fit, nothing else.
- **A card is kind, name, and where it goes.** Kind tile and word (Question,
  Message, Form, Result, Ending), the name in `<bdi>`, an "Only if …" chip, and
  "Then → X" or "If skipped → X" as buttons that open the control which sets
  them. A form says what it saves; a result lists its results with answer dots;
  an early ending says "Ends without saving details", and an ending some
  visitors reach without the form says "Some visitors end here without saving
  details". Screen numbers never
  appear on the map.
- **"Only if" splits the line.** A screen with one plain line in draws the
  labelled line through it and a dashed line around it ("Includes X" /
  "Without X" on choose-several, "X" / "All other answers" on choose-one). With
  several lines in, it stays inline with its own dashed "If skipped" line.
- **Several follow-ups are one box**: "Any of these" in, "None of these" dashed
  around, members listed in asking order. A run of follow-up messages is boxed
  the same way.
- **Every line has a "+"** that inserts a screen there; a line's label opens the
  exact rule. Labels and "+" are reserved in the layout, so they never cover a
  card or each other, and are at least 44px on a coarse pointer. There is no
  drawing mode and nothing drags.
- **Highlighting never fades text.** The selected card has an outline and
  `aria-current`; its own lines are drawn dark and bold (an answer's line keeps
  its color, bolder) and its neighbours outlined. Teal marks only a visitor's
  path, so it never reads as an answer. A trace dashes the screens it skipped
  and draws the lines it did not take quietly. Outlines, not shadows, so both
  survive forced colors.
- **A question's lines read in the order they are checked**, left to right
  (right to left in RTL), "All other answers" last, and the screens they lead
  to share the row below it. Crossing fewer lines can override the order on a
  dense map; the pills still say which answer each line is.
- **Keyboard**: one roving tab stop. ↑/↓ move through cards in reading order,
  ←/→ along a row (swapped in RTL), Home/End, Enter selects, Escape clears a
  trace. Tab goes from the active card to its buttons, then its line labels and
  "+", then out of the map. Reading order is DOM order.
- **Try a visitor** lives inside the map: one control per question reached,
  resolved by the loader's own trace. Any edit clears it.
- Expose journey issues through one count/list and affected card markers.
  Reuse the publication validators and their repair addresses; an empty list
  does not prove that all visitor cases have been tested.
- Check straight campaigns, one follow-up, answer lines rejoining, follow-up
  boxes, two forms, quiz results, several endings, "Only if" at a rejoin, 12 and
  20 screens, a version 2 tree and RTL with mixed-direction names, at 1440,
  1280×800, 900, 390 and 320 wide.

### Merchant editing tasks

- Add questions with an explicit answer type. If the chosen path is after contact
  collection, explain the constraint and offer a named valid position. Never
  silently redirect an explicit path insertion.
- For independent follow-ups, show the source answer, position in the group and
  shared continuation. Reorder both shown and skipped paths as one undoable edit.
  Preserve custom order.
- Lead deletion dialogs with the visitor outcome. Hide alternate continuation
  controls for a unique safe continuation, but keep them available. Ambiguous
  exits require an explicit choice. Optional signup removal includes its fields,
  consent and configuration, with historical Leads preserved.
- Stage new result rules until a heading and deliberate answer selection exist.
  Opening or cancelling a dialog must not invent a matching rule. Keep the
  fallback last and explain first-match priority.
- Retiring a used answer must list the exclusive behavior being removed. Preserve
  shared screens and protect contact collection. Mixed or negative conditions
  require explicit repair; never broaden them automatically.
- Offer Undo and a visitor walkthrough after structural changes. A test starts
  from the real entry and must not claim reachability or delivery it did not
  observe. Keep submission failure controls available under test details.
- Carry the changed screen's name into the walkthrough and suggest cases from
  its actual conditions, choices and result priority. Treat these as manual
  checks; never fabricate answers or imply every suggested rule is reachable.
- When a dependency review opens another screen's rule, provide a return action
  that restores the pending choice or answer-type review, replacement selection,
  disclosures and keyboard focus. Preserve the rule edits made during the detour.
- Use shared input components inside dialogs, including locally staged forms.
  Verify field heights and keyboard focus, narrow layouts and scrollable bodies.
- Match service compatibility to the provider contract: SMS uses the `phone`
  audience channel. Explain missing dependencies rather than presenting a falsely
  empty provider list. Creating a shared destination and selecting it for a
  campaign remain explicit, distinct actions.

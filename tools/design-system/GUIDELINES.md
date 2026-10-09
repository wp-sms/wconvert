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
| `note` | 13 | descriptions, notes, help text |
| `body` | 14 | the body of the admin |
| `heading` | 16 | a region heading, a card title, a section in an editor |
| `section` | 20 / 600 | reading-page section headings |
| `metric` | 36 / 600 | dashboard impact and target totals |
| `title` | 24 | compact editor title and footer wordmark |
| `display` | 44 / 500; 36 on phones | reading-page heading |
| `brand` | 26 / 600; 22 on phones | header wordmark |
| `item` | 15 / 600 | campaign and goal identity |
| `result` | 22 / 500 | compact result figure |
| `figure` | 30 | the one emphasised figure per Goal |
| `label` | 11 | builder furniture and quiet frame metadata |
| `meta` | 9 | tracked builder furniture captions only |

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
- `InfoTip` owns contextual help in Analytics and Leads: a 16px Info glyph in a
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
   switch happens at a count the manifest does not control.
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
below, an error under that. **One select** (`components/ui/native-select`) and
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
pasted ID. The one exception is campaign Details' closed "For developers"
disclosure, which shows the campaign ID with Copy, because the free page
events identify a campaign by nothing else.

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
| `Popover` | an explanation they asked for; never a substitute for a control the screen should have shown |
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
- **Footer:** fixed. Back or Cancel at the start, an optional short note, the
  primary action at the end, and an error beside the actions. Footer controls
  take the toolbar scope.
- **Dirty:** Escape, an outside click or ✕ asks "Discard changes?" only when
  something was typed (`dirty`), and the question is drawn inside the dialog.
- **Never nested.** A dialog that leads to another view opens it in place with
  Back. A destructive confirm is an `AlertDialog` that says what survives; red
  is for delete and remove only.

Template discovery dialogs are `PickerDialogContent` — a Large `AdminDialog` —
with a single scroll body and a separate action footer. Back and Use/Install
stay reachable in short and phone windows. Pack and collection pagination stays
outside the scroll body. Use-case choices and screen exploration belong to
inspection, never dropdowns on result cards. A single result keeps the ordinary
card size. Long placement, measurement and journey guidance uses labeled
progressive disclosure beside the preview. Dialog headers align to the start
on every viewport; close controls have a 32px target (44px for coarse pointers).

Creation cards open inspection before the draft action. Shared cards place the
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
value is read against. (782px is the *builder's* floor and a different number.)

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
`aria-disabled` rather than the HTML attribute, so a menu item is already on the
right side of this line.

**A refusal is marked before the click, with the reason, and the reason is
announced with the control** (§8). That last clause is not decoration: `GoalCard`
passed its refusal as the card's ordinary `notes`, which carry no `id`, so
`aria-describedby` pointed at the title and a screen reader heard a dimmed
button and no reason at all. `ChoiceCard` and `TemplateCard` both take a
`reason` with an id of its own.

**Nothing spells a tier's name.** `tierName()` for a badge,
`tierProductName()` for a sentence — both read `tiers.json` through
`window.wconvertAdmin.tiers`, so a second rung is a manifest edit rather than
five strings and a release. At launch every rung answers *"Pro"*, so nothing on
screen changes; what changes is the day the ladder splits, which is the whole
reason the manifest exists.

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
way round inside an admin the browser had laid out correctly. `Tabs`,
`DropdownMenu` and `Select` are the three, and `Select` shipped without it: the
Leads screen's Optin filter opened a popup reading LTR, while Analytics and
Destinations used native `<select>`s and inherited the direction for free.

`admin-rtl.test.tsx` asserts all three, and asserts the logical-property
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

**A long unbreakable token wraps.** `overflow-wrap: anywhere` on the data cell,
because a 60-character email, a captured field value or a provider error
carrying a URL otherwise overflows its own card on all four reading screens.
`anywhere` and not `break-word`: only the former lets the long word count
towards `min-content`, which is what makes a content-sized track shrink to fit
rather than clip.

## 17. Floors

- **WCAG 2.1 AA**, enforced by lint. AAA is explicitly not the bar.
- **360px** on the reading screens; **782px** on the builder, which refuses
  below it and says so in a translatable string.
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
  Destinations**, and a journey's link to another screen is the **next
  screen**, never a destination. Domain nouns (campaign, goal, lead,
  destination) are lowercase mid-sentence; capitals start a title, a button
  or a sentence. US spelling.
- **More than two row actions go in a ⋯ menu**, with icons and labels.
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
  their bullets. Show priority once; a fallback is “Everyone else”, not another
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

- Keep all cards and connections readable during selection and testing. Emphasize
  relevant connections with stroke weight and selected cards with an outline;
  never fade an entire card's text to imply that it is unrelated.
- Below 80% zoom, show a larger-type summary within unchanged card geometry,
  including on the selected card. Select a summary to inspect locally. Overview
  is for orientation; use Show selected screen for detailed reading.
- Keep zoom, its percentage, Fit journey, Show selected screen, View options and
  Edit connections together in one wrapping toolbar. Grouping, previews, Tidy up
  and keyboard-accessible pan actions belong in View options.
- A follow-up group starts with its source, count, “ask every match” explanation
  and named continuation. Show questions discloses the members; Edit individual
  connections expands the graph. These are distinct actions.
- A branching card summarizes the answer-path count and fallback. The editable
  connections carry full condition labels without line clamping; the inspector
  retains exact rules and priority.
- Expose journey issues through one count/list and affected card/group markers.
  Reuse the publication validators and their repair addresses. Repair opens the
  exact existing control and offers Back to issues; an empty list does not prove
  that all visitor cases have been tested.
- Preview & test separates Check the design, Try as a visitor and Explore answer paths.
  Predictions begin without assumed answers and stop at each unanswered question
  or submission choice. Diagnostics appear progressively beside the form. Walkthroughs
  highlight only reached transitions. Reset remains available, tree edits clear
  stale map traces, and neither mode creates Leads or sends destination requests.
- Keep the ordinary sequence horizontal. Place a proven optional detour below
  its entry, with top/bottom ports and the shared continuation on the main row.
  Vertical proximity must not imply that mutually exclusive paths both run.
- Stack competing alternatives in separate lanes in priority order. Show the
  shared result or submission once after those paths rejoin. Keep “ask every
  match” groups distinct from “choose one path” branches.
- Only simplify closed, single-entry paths with an identifiable rejoin. Keep
  nested forks and external entries explicit; never infer visitor behavior from
  a diagram's positions. Manual arrangements persist until Tidy up or a change
  that requires a new layout.
- Use meaningful condition labels and “Everyone else,” with numbers only when
  priority distinguishes multiple conditional paths. Labels open the exact rule;
  insertion buttons are separate. Prefer long straight segments over short
  elbows beside cards. Keep full rules in the inspector and accessible labels.
- Keep selection actions outside the pannable map, so they cannot obscure
  nodes/lines. Selecting a small detour includes its rejoin when readable;
  narrow or dense views prioritize the selected screen. Explicit “Show selected
  screen” always focuses that screen alone.
- Check simple sequences, one/multi-screen detours, ordered alternatives,
  grouped follow-ups, expanded groups, shared endings, external entries, measured
  long cards and RTL. Check actual browser framing at laptop sizes in addition
  to pure layout tests. Overlapping manually moved cards still need repositioning.

- Screen numbers are inventory positions, not visit order. Do not display them
  on flow cards or the flow inspector; keep numbers only for genuine sequences
  and branch priority. Names, screen type, Start and Paths rejoin orient the map.
- Edge insertion uses “Add screen here”, revealed on path selection, hover or
  keyboard focus (always available on touch). Its accessible name includes the
  visible label and destination. Drawing a connection remains a separate mode.
- Put the affected path and resulting source → new screen → destination at the
  top of insertion dialogs. Explicitly state path-only scope. Update the preview
  for a renamed screen, a closing screen, a changed location or an existing
  screen connection. Never promise continuation for a closing screen.
- Give distinct paths into a shared screen stable, separate attachment points
  and approach lanes; do not merge their editable lines before the destination.
- Prefer a central orthogonal corridor when clear; fall back to obstacle routing
  when a card blocks it. Reserve measured label/action rectangles against cards,
  including keyboard-revealed actions. If no safe location exists, keep controls
  in the path inspector rather than covering content.

### Merchant editing tasks

- Add questions with an explicit answer type. If the chosen path is after contact
  collection, explain the constraint and offer a named valid position. Never
  silently redirect an explicit path insertion.
- For independent follow-ups, show the source answer, position in the group and
  shared continuation. Reorder both shown and skipped paths as one undoable edit;
  dragging map cards changes layout only. Preserve custom order.
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

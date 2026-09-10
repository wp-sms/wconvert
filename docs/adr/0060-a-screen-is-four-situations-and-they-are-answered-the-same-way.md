# A screen is four situations, and every screen answers them the same way

A screen is not one thing. It is **empty, loading, failed and full**, at 360px
and at 1440, in LTR and in RTL, with features the site can use and features it
cannot. Consistency across this admin is whether two screens answer the same
situation the same way — and until now nothing said what the answers were.

This ADR states them. It documents the majority behaviour the code already had
rather than inventing a house style, and every rule below is one that at least
one screen was already following before it was written down.

## The gap this closes is in the guideline, not only in the code

The admin documents four **detail** rules — six type roles, two control heights
decided by the container, spacing from the Tailwind scale, every colour from a
token — and they are about static values. Of the fourteen sections in the design
system's `GUIDELINES.md`, exactly one covers a **scenario**, and that one is
empty states.

There is nothing on loading, nothing on where an error goes, nothing on how an
unavailable feature is marked, nothing on direction. **A guideline cannot
guarantee a consistency it never states**, so the drift below was not anybody
failing to follow a rule. There was no rule.

The three data states are the one thing that was already forced:
[`shell/loadable.ts`](../../resources/admin/src/shell/loadable.ts) defines
`Loadable<T>` as `loading | ready | failed`, so every screen must branch on all
three. What was unguaranteed is that the three branches **look alike** across
screens, and six audits found that in eleven places they did not.

## 1. Loading

**A region that fetches owes a loading state** (ADR 0039), and it is never the
empty state. `EmptyState` says *you have none*, which is a claim; while the
answer is still arriving it is a claim that is not yet true.

**A skeleton mirrors the layout it replaces.** That is the whole of why it is
not a spinner: the columns do not move when the data lands, so the screen does
not jump. Analytics drew a headless `DataTable` of four columns where a heading,
a row of four figures and a sparkline were coming; Destinations drew a
three-column table where a stack of settings cards was coming. Neither region
contains a table in any state.

| The region is | The skeleton is |
|---|---|
| a `DataTable` | `TableSkeleton` |
| a `ChoiceGrid` of cards | `ChoiceSkeleton` |
| a gallery of rendered designs | `GallerySkeleton` |
| a `StatRow` | `StatRowSkeleton` |
| a list of choices with a control at the leading edge | `RowsSkeleton` |
| anything else — a form, a run of sentences | `RegionSkeleton` |

**A text placeholder is sized in `1lh`, never in pixels.** A figure's box is its
LINE box and the type scale pairs a line-height with every size, so `1em` came
up four pixels short on two of the three numbers in a stat row. `1lh` is the
same height by construction whatever the scale does next, which is why no
skeleton in this admin states a `min-block-size`.

**Waiting 160ms is not a property of the loading state — it is a property of
what the placeholder replaces.** Both behaviours are correct and they answer
different situations:

- **A skeleton that replaces content the merchant was already reading waits.**
  That is the flicker case: the region has something in it, a re-read lands in
  tens of milliseconds, and a placeholder that appears and vanishes inside one
  is a screen that blinks. `TableSkeleton`, `ChoiceSkeleton` and
  `GallerySkeleton` — the last two because picking a different [[Goal]] puts a
  filled step back into `loading`.
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
one** — see §3.

## 2. Failure

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
regions fail **independently** — a screen has more than one thing on it that can
break, and an error a long way from the control that caused it is an error whose
subject the merchant has to guess. Three screens are not that shape: Analytics
reads one payload and draws a card per Goal from it, Destinations reads one
payload and draws a card per route, and the builder's save acts on the whole
draft. `PageError` is that case, and it is drawn without a surface behind it
because a page-scoped error is not a region and must not look like one.

**An error names a door that is on this screen** (ADR 0042 rule 4).
`RegionErrorState` carries *"Reload the page to try again."* by default rather
than asking ten call sites to remember it — nine spelled the identical string
and the tenth spelled nothing, which made the creation flow's second step the
one screen whose failure named no way out of itself.

**A region's error carries no dismiss control.** It clears when the next fetch
succeeds, so there is no path where a merchant hides a failure and then reads
the stale data underneath it as current.

## 3. Unavailable

This is the largest surface for disagreement — twelve renderings had grown, in
four families — and it is the one a merchant is most likely to feel. There has
always been a shared decision function; what was missing is a shared *rendering*.

**Why is the server's; how is the surface's.**
[`renderingFor()`](../../resources/admin/src/goals/availability.ts) maps
`ready | locked | unavailable` × `creation_flow | settings_list` to
`offer | upsell | explain | hide`, and no surface ever renders `unavailable` as
an upsell. That half is load-bearing: a paying customer must never be shown an
advertisement for Pro, and we must never offer to sell a merchant a WooCommerce
licence we do not have (ADR 0026).

**`locked` and `unavailable` never collapse into one sentence.** They mean
opposite things — *you have not bought the tier* and *this site is missing
something* — and collapsing them is precisely how the two failures above happen.
Three places had collapsed them.

**What each badge colour means**, because this is where the collision was:

| Colour | Meaning | Where |
|---|---|---|
| **Amber** (`warning`) | **The site is holding this back.** | [[Suspended]], *Paused*, *Needs X* |
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

`StructureView` has argued the first half since its roving tabindex was written.
Radix's `DropdownMenuItem` takes `disabled` as a prop and renders `aria-disabled`
rather than the HTML attribute, so a menu item is already on the right side of
this line.

**A refusal is marked before the click, with the reason, and the reason is
announced with the control** (ADR 0042 rule 3). That last clause is not
decoration: `GoalCard` passed its refusal as the card's ordinary `notes`, which
carry no `id`, so `aria-describedby` pointed at the title and a screen reader
heard a dimmed button and no reason at all. `ChoiceCard` and `TemplateCard` both
take a `reason` with an id of its own.

**Nothing spells a tier's name.** `tierName()` for a badge, `tierProductName()`
for a sentence — both read `tiers.json` through `window.wconvertAdmin.tiers`, so
a second rung is a manifest edit rather than five strings and a release
(ADR 0056). At launch every rung answers *"Pro"*, so nothing on screen changes;
what changes is the day the ladder splits, which is the whole reason the
manifest exists.

**A locked design is a link, never a disabled button.** The design is not on
this install to be used, so an "unavailable" control would be a control for
something that is not there — the trialware shape issue #7 names. What a
merchant can do is look at it, so that is the affordance.

## 4. Direction

**Every box is written in logical properties.** `inline-start`/`inline-end`,
`block-start`/`block-end`, `ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`, and
`text-start`/`text-end`. Across every `.tsx` this project wrote and across 4,470
lines of `index.css` there were zero exceptions before this ADR and there are
zero after it. `components/ui/` — the code nobody wrote — carried six, and
ADR 0036 holds those files are WConvert's from the moment they land.

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
so `OptinList`'s `CornerDownRight` — the entire visual grammar of ADR 0045's
nesting — pointed away from the row it belonged to on every RTL install.

A glyph that is symmetric, or that means up or down, is left alone. Up is up in
Persian: a list runs top to bottom whichever way the words run, which is why
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
over `index.css`. That pair is the guard that would have caught every RTL defect
this ADR was written from.

## 5. Responsive

**Every table goes through `shell/DataTable`**, whose `data-label` is enforced
by the prop type — so the below-639px restack into row-cards cannot be
forgotten. `components/ui/table.tsx` was deleted rather than left where somebody
would find it: it neither restacks nor reads RTL.

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

## The matrix

The artefact that answers *"do we deliver the same experience across the
admin"*. Read down a column to find a gap.

| Screen | Loading | Empty | Failed | Full |
|---|---|---|---|---|
| **Optins — list** | `TableSkeleton` | `EmptyState` + *Create an Optin* | `RegionErrorState`; refresh keeps rows under `RegionError` | table |
| **Optins — allowance** | placeholders in its own grid | n/a — a setting is never empty | `RegionErrorState` | four controls |
| **Analytics** | `RegionSkeleton` + `StatRowSkeleton` | `EmptyState` + *Go to Optins* | `RegionErrorState`; refresh keeps cards under `PageError` | a region per Goal |
| **Analytics — a Goal's Optins** | with the card | `EmptyState`, no action (the card above is the answer) | with the card | table |
| **Leads — log** | `TableSkeleton` | `EmptyState` + *Go to Optins* / *Show every Optin* | `RegionErrorState`; refresh keeps rows under `RegionError` | table |
| **Leads — retention** | placeholders in its own layout | n/a | `RegionErrorState`, independently of the log | radios + a period |
| **Destinations — routes** | `RegionSkeleton` | `EmptyState`, no action (the region below is the door) | `RegionErrorState`; refresh keeps cards under `PageError` | a region per route |
| **Destinations — types** | with the payload | `EmptyState`, no action (no door this admin owns) | with the payload | a list of types |
| **Creation — Goal** | `ChoiceSkeleton` | `EmptyState` | `RegionErrorState` + Retry | `ChoiceGrid` of Goals |
| **Creation — starting point** | `GallerySkeleton` | `EmptyState` + *Start with a blank draft* | `RegionErrorState` + Retry; creation failure stays on the choice | rendered Playbooks and effective setup facts |
| **Creation — customize** | in-flight status on the chosen starting point | n/a | uncertain create asks to check Optins | created draft opens the editor |
| **Builder — frame** | `BuilderSkeleton` (immediate; it holds the way out) | n/a | `RegionErrorState` | tabs |
| **Builder — Design** | none of its own — the index arrives behind `BuilderSkeleton` | `EmptyState` + the other Display Types | `PageError` above the tabs | the design in use + tokens |
| **Builder — Content** | with the design | `EmptyState` + *Pick a design* | with the frame | tree + inspector |
| **Builder — Destinations** | `RowsSkeleton` | `EmptyState` | `RegionErrorState` | bindable routes |
| **Milestones** | renders nothing, deliberately | the disclosure, collapsed — see the correction below | `RegionErrorState` | a next step + what was recorded |

Two columns are deliberately thin. *Empty* is `n/a` wherever the region holds a
SETTING rather than a collection: a retention period has no empty state, it has
a default. And the builder's frame has no empty state because an Optin that does
not exist is not reachable from it.

**Creation rows amended by [ADR 0072](0072-setup-choices-state-their-effect-and-scope.md):**
there are two choices, followed directly by the editor, rather than a third
preview-only step. Failed setup-detail reads do not remove the starting-point
cards; they offer Retry and say that the rules can be reviewed in the editor.

*Extended by [ADR 0068](0068-reading-pages-put-results-and-routes-before-occasional-settings.md): Analytics and Leads retain the last successful
response during a refresh and expose retry on failure. A later request owns the
result; a stale response cannot overwrite it. Dates and Lead row/export state
continue to describe the response actually shown. Occasional settings may start
closed with a saved-state summary, but a new error opens the disclosure.*

**Milestones is the one row that answers a situation with nothing, and it is
right.** A region that reserves height for something it will usually not draw
pushes the numbers down on every visit and then takes the space back; the honest
loading state for nothing is nothing. Its FAILURE is still drawn, because a read
that failed silently leaves the merchant unable to tell there was anything to
see — which is worse than the checklist ADR 0042 refuses. Both halves are
argued in place, and the row is here so the asymmetry reads as a decision rather
than as the gap it looks like from a distance.

> **Corrected: it said *three of the four*, and it said Milestones renders
> nothing when EMPTY. Only loading is nothing.** `Milestones.tsx` returns `null`
> for `loading` and draws `RegionErrorState` for `failed`, but its ready arm
> renders `WhatWasRecorded` **unconditionally** — so the collapsed *"What
> WConvert has recorded about this site"* disclosure is on screen in both of the
> remaining situations, with `NextStep` above it only while `stuckAt()` finds an
> unmet step. That is one summary row rather than a reserved block, so the
> argument above still holds; what was wrong was the count, and the row's own
> matrix cell already showed two nothings rather than three.
>
> Found by capture, not by reading: the design system's `Screens` group renders
> every screen in all four situations, and `screen-analytics-empty` has the
> disclosure in it. `milestones/api.ts` carried the same overstatement — *"the
> region renders nothing at all when everything is met"* — and is corrected in
> the same commit. The claim is true of `stuckAt()`, which returns `null`, and
> not of the region, which still has a disclosure to draw.

## What this does not decide

- **The settings column.** Thirteen WordPress classes and four debt selects are
  still inside the builder's settings column, waiting on a design (ADR 0035's
  staged boundary). Nothing here changes what they look like.
- **Dark mode.** The tokens exist; no screen has been measured in it.
- **The two deliberate native `<select>`s.** Analytics' window and the
  Destinations connection picker stay native and each says why in place.

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

1. **Brand header** — solid deep teal, with wordmark, Help,
   issue notifications and account entry. The top row is at least 78px.
   Four-section navigation sits on its own row, with the current section
   underlined and a compact, bordered installed-plan badge at the opposite edge.
2. **Light title area** — `h1`, useful description and page action on the mist
   canvas. Headline and CTA stay outside the dark header. The primary page
   action is a solid teal button with a white label.
3. **Main work area** — white work surfaces against mist. Campaign filters,
   controls, rows and metadata form a single sheet.
4. **Service footer** — matching deep teal, shared WConvert mark and wordmark, plan
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
| **2rem** | What *qualifies* what is already on screen — a toolbar filter, a row action, a control inside a table or footer | being inside `.wconvert-toolbar`, `.wconvert-table`, `.wconvert-footer` or compact `.wconvert-page-actions` outside the reading-page heading |

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

DM Sans is self-hosted with its OFL license. The system fallback covers missing
glyphs. Font assets use content-hashed URLs so different weights cannot share
stale cache entries. Do not reach for a Tailwind size outside this list. Before the roles existed,
103 of ~115 text elements on the builder were 14px and nine sizes were in use;
headings, body, labels and descriptions were separated only by weight and
colour.

## 5. Colour means something

- **Teal `#205c57`** is the primary action/link color. **Deep teal `#183c40`**
  frames the app; **mist `#EAF0ED`** is the canvas and work surfaces are white.
- **Surface roles are shared across screens.** Use `--card` (white) for cards,
  including goals and monthly targets. Use `--surface` (`#F3F6F4`) for inset
  content and table headers, `--secondary` for icon wells, and `--accent` for
  interaction states. Do not tint whole cards nearly the same color as the canvas.
  `--border` (`#CAD6CF`) separates surfaces; muted text is `#53675E`.
- **Semantic colors retain their meaning**: destructive failure, success
  converted, warning suspended or nearly-limit, info neutral fact. Status always
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
admin prints on every build.

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
value shown beside it, an onboarding tour on a working screen.

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

**The honest loading state for nothing is nothing.** Milestones draws no
skeleton, deliberately: a region that reserves height for something it will
usually not draw pushes the numbers down on every visit and then takes the space
back.

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

**An error names a door that is on this screen** (§8). Pass the retry button
as `RegionErrorState.action`, beside the error and its explanation. Reload is
the fallback when no local retry is possible. Keep the previous accepted data
visible when a refresh fails, with a clear stale-data explanation.

**Loading names the concern.** `RegionSkeleton` displays “Loading [region]…”
as an accessible status. Placeholders stay static; a pending read must never
claim that there are no results. Empty campaigns explain the goal → design →
publish sequence and offer the first action.

**A region's error carries no dismiss control.** It clears when the next fetch
succeeds, so there is no path where a merchant hides a failure and then reads
the stale data underneath it as current.

**A failure is drawn even where nothing else is.** Milestones answers three of
the four situations with nothing and still draws this one: a read that failed
silently leaves the merchant unable to tell there was anything to see.

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
| A loading state on Milestones | the honest placeholder for nothing is nothing |

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
- Tier names come from the shared vocabulary. The header’s temporary `#` account
  link is an explicit user-approved exception, removed when an account destination
  is supplied. It is not a general permission for dead links.
- New stylesheets must join the type/RTL source-contract checks. Verify actual
  WordPress at desktop and 360px, including keyboard selection, long labels,
  RTL and effective coarse-pointer target sizes. Source tests cannot prove layout.

# WConvert Admin — design system brief

WConvert is a WordPress lead-capture plugin: popups, floating bars, slide-ins
and inline forms, created goal-first. Its admin is React 19 + Tailwind v4 + 16
components vendored from shadcn, and it renders inside `wp-admin` on a page it
owns outright.

This bundle is that admin's real vocabulary — the token layer lifted verbatim
from `resources/admin/src/index.css`, and preview cards that reproduce the
vendored components' actual markup and classes against it. Nothing here is a
mock-up of an intention; every class string in the previews is copied from the
component that ships it, and every screen card is the live DOM of a running
install.

## What this system is for right now

**Deciding the shape of every control in the builder's settings column, all at
once.**

The admin is not under-designed. The one debt its own ADRs admit to is a staged
boundary: the builder's editors still emit WordPress-native controls —
`regular-text`, `widefat`, bare `<select>` — which `index.css` re-colours to
WConvert's tokens while leaving WordPress's box model, sizes and focus exactly
as WordPress drew them. The rule that boundary states is:

> change what a control LOOKS like now, change what it IS when its replacement
> lands.

What has been waiting is the decision about what each replacement *is*. That is
a question about the whole column at once — a ratio, a delay, a colour and a
piece of copy sitting under one another — which is why it is being asked on a
canvas rather than in a diff.

**Ask for 2–3 whole-column directions, not per-control fixes.** The point is
seeing them together.

## Verified inventory of the debt

Counted in code, comment lines excluded.

| Thing | Count | Where |
|---|---|---|
| WordPress classes | **13** | `builder/Tokens.tsx` ×4 (`regular-text`), `builder/SlotFields.tsx` ×5 (`widefat`), `builder/controls.tsx` ×2 (`regular-text`), `builder/rules/ObjectPicker.tsx` ×1, `builder/DevExport.tsx` ×1 (dev-only, behind `WP_DEBUG`) |
| Bare `<select>` | **6**, of which **2 are deliberate** | Debt: `builder/controls.tsx`, `rules/Who.tsx`, `rules/RuleRow.tsx`, `rules/AddRule.tsx`. **Keep:** `stats/Dashboard.tsx` and `destinations/settings.tsx` — both carry a docblock explaining why a native select beats the Radix one there |
| Bare `<input>` | ~30 | concentrated in `builder/Tokens.tsx`, `builder/controls.tsx`, `rules/HowOften.tsx`, `builder/SlotFields.tsx` |
| `<textarea>` | 3 | `destinations/settings.tsx`, `builder/SlotFields.tsx`, `builder/DevExport.tsx` — no vendored `textarea` exists |

The four files that carry the debt: **`builder/controls.tsx`**,
**`builder/Tokens.tsx`**, **`builder/SlotFields.tsx`**, **`builder/rules/*`**.

## Constraints — these are settled, not open

**ADR 0035 — the admin owns its page.** No WordPress chrome: no `nav-tab`, no
`wp-list-table`, no `.button`. Tailwind's preflight applies to the whole
document and utilities compile as unlayered `!important`, which is how they
outrank wp-admin's own high-specificity rules. *This bundle drops both, because
they change nothing on a blank page — and it is why a design has to be verified
in real wp-admin and never in the canvas.*

**ADR 0036 — components are vendored from shadcn upstream, and are then
WConvert's files.** Never copied from WSMS. Anything new arrives via
`npx shadcn add` and is edited in place afterwards.

**ADR 0037 — WSMS's token *names*, WConvert's *values*.** Renaming a token
breaks the drop-in property with every component either product produces; adding
one is free. Petrol `#0f6e79`, `--radius: 0.25rem`, and a hard offset shadow
`4px 4px 0` with no blur anywhere in the scale.

**ADR 0038 — WCAG 2.1 AA, enforced by lint. 782px builder floor. No dark
mode in 0.1.0.** AAA is explicitly not the bar. Note SC 2.5.7: **any dragging
gesture owes a single-pointer alternative**, which is a live constraint on
anything slider-shaped.

**ADR 0039 — a screen is regions, and scope decides placement.** Two control
heights: **2.25rem** for what a merchant came to the screen to use, **2rem** for
what qualifies what is already on it. Neither is a prop — being inside a
toolbar, a table or a footer is what makes a control small.

**ADR 0042 — the admin speaks only when it changes what you do next.** Eight
rules; the ones that bite hardest here are *say only what changes what the
merchant does next*, *never offer what will be refused — mark it before the
click, with the reason*, *an error names a door that is on this screen*, and
*one job, one control, and "selected" is decided in one place*.

**ADR 0054 — every control has the shape of its value.** The ADR this work
exists to finish. Read it in full; it already decides more than it looks like.

**ADR 0060 — a screen is four situations, and every screen answers them the
same way.** Empty, loading, failed and full, in both directions. It is what
`GUIDELINES.md` §§11–16 states, and what the `Screens` group renders.

## Already decided by ADR 0054 — do not re-open these

0054 is not an open question, it is four settled shapes plus a dispatch rule:

- **A control that enumerates reads the manifest; one that infers reads the
  value.** Neither arm names a token, and `Tokens.tsx` must keep naming none —
  a per-token control table is the thing ADR 0010 exists to prevent.
- **A free-text box is an escape you opt into, never the control you land on.**
  It is demoted, not deleted: reachable by pressing *Custom*, or by holding a
  value nothing in the bundle can read.
- **One-of-N is chips while N is small, and a popover list once it is not.**
  The switch happens at a count the manifest does not control (`font`, which may
  offer thirty families the site declares).
- **A colour is a Radix `Popover` whose trigger shows the current value.**
  `ColourField` already is this; `font` becomes the second token wearing it.
- **A measure is a slider**, one or two components (`padding: a b` → *Top and
  bottom* / *Sides*, named logically, never *Left and right*). Three- and
  four-value padding falls to Custom, deliberately.

## Two corrections to the working assumptions

**1. `toggle-group` and `radio-group` are refused, not missing.** The segmented
control this admin already has is **native radios in a `role="group"`**, and
`Tokens.tsx` argues it in place:

> Radios, because one of these excludes the others and that is what a radio
> group IS: arrow keys move between them, the set is announced as a set, and
> only the checked one is a tab stop. Radix's `ToggleGroup` would buy roving
> focus and arrow keys the browser already gives, at bundle bytes this admin
> prints on every build.

ADR 0055 amended 0054 to the same effect for the font popover — the rows are
native radios, not a `role="listbox"`, because a role is a promise the author
then has to implement. **Proposing a toggle-group or a Radix radio-group is
reversing a decision, not filling a gap.**

**2. So the genuinely absent primitives are four, not six:** `textarea`,
`switch`, `tooltip`, `slider`. Vendored today (16): `alert-dialog alert badge
button card checkbox dialog dropdown-menu input label popover select separator
skeleton table tabs`.

## Out of scope — do not "fix" these

- **Dark mode.** Out for 0.1.0 (ADR 0038), and `dark:` is deliberately bound to
  a class no element carries so the vendored `dark:` utilities never fire.
- **The two deliberate native `<select>`s** in `stats/Dashboard.tsx` and
  `destinations/settings.tsx`. Both are documented in place. They are not debt.
- **`builder/DevExport.tsx`.** Dev-only, behind `WP_DEBUG`.
- **The ~2,000 lines of hand-written screen layout** in `index.css`
  (`.wconvert-builder`, `.wconvert-gallery`, `.wconvert-block`,
  `.wconvert-themes`, `.wconvert-editor`). Not in this bundle on purpose: it is
  one-off layout, not vocabulary.

## And the thing generated screens get wrong here

**Helper text.** Every artboard will be read against ADR 0042 and anything that
does not change what the merchant does next gets deleted — reassurance copy,
restated labels, "you can always change this later", a description under a
control whose name already said it. ADR 0054 names a live example: *a text box
under the alignment chips, holding `center`*. The admin is quiet on purpose.

## What is in this bundle

| File | What it is |
|---|---|
| `tokens.css` | The token layer, lifted from `index.css`, plus a plain-CSS mirror so the file also stands alone |
| `shell.css` | The vocabulary half of the hand-written CSS: the `DataTable` skin and its restack, the rule that picks a control height, the chosen state of a `ChoiceCard`, the measure |
| `previews/foundations.html` | Colour, the six type roles, radius, the offset-shadow scale |
| `previews/actions.html` | `Button` — six variants, eight sizes, states, and the two heights |
| `previews/forms.html` | `Input`, `Label`, `Checkbox`, `Select` — the whole of what a settings column can be built from today |
| `previews/surfaces.html` | `Card`, `Alert`, `Badge`, `Separator`, `Skeleton` |
| `previews/layers.html` | `Dialog`, `AlertDialog`, `Popover`, `DropdownMenu`, `Tabs` |
| `previews/data.html` | The vendored `Table`, and `shell/DataTable` which is what list screens actually render |
| `previews/shell.html` | `Region`, `Toolbar`, `Stat`, `EmptyState`, `ChoiceGrid`, `Description` |
| `previews/navigation.html` | The page frame — header bands, nav states, widths |
| `previews/feedback.html` | When the admin speaks, and where the words go |
| `previews/controls.html` | The builder's composite controls, sliced from the live DOM |
| `previews/settings.html` | Every settings surface — rules, site-wide, Destination |
| `previews/guidelines.html` | The whole guideline, rules beside the components |
| `previews/today-design.html` | **The thing being redesigned** — Design tab, as it ships |
| `previews/today-content.html` | Content tab with a block selected, inspector open |
| `previews/today-rules.html` | Display rules with all four sections open — where the debt is loudest |
| `previews/screen-*-{empty,loading,failed,full}.html` | The four reading screens, in ADR 0060's four situations |
| `previews/screen-*-{…}-rtl.html` | The same sixteen, right-to-left |
| `previews/screen-analytics-nothing-live.html` | Analytics when Optins exist but none is published |
| `previews/screen-destinations-editing.html` | A configured Destination with its edit form open |

Each preview inlines its compiled stylesheet, so every card renders standalone.

## The `Screens` group — four screens, four situations, both directions

Captured the same way as `Today`, and for a different question. These four have
**no control debt at all**; they are already built from the shell primitives and
the vendored components. They are here because *no debt* is not the same as
*well designed*, and nobody had looked at them side by side.

**Thirty-two cards, which is ADR 0060's matrix made visible.** A screen is
empty, loading, failed and full — and the ADR's point is that consistency is
whether two screens answer the SAME situation the same way. That is obvious in a
grid and invisible in a diff of any one card, so the grid is the artefact:
`contact-sheet-ltr.png` and `contact-sheet-rtl.png` are four screens down by
four situations across.

Where each situation comes from, because two of them a seed cannot produce:

- **empty** is the site before the seed runs, and **full** is the same site
  after it — one boot, two phases, because they differ in rows rather than in
  anything about a request.
- **failed** is forced on the SERVER, by an mu-plugin filtering
  `rest_pre_dispatch`. It has to be: `messageOf()` exists because `apiFetch`
  rejects with WordPress's REST error body rather than an `Error`, so a 500
  synthesised in the browser would prove the error path against a shape
  WordPress does not send.
- **loading** is forced in the BROWSER, by a Playwright route that is never
  fulfilled. It has to be: Playground runs one worker, so a request held open in
  PHP deadlocks the server rather than rendering a skeleton.

**RTL is a real capture and not a mirrored screenshot.** The site is switched to
a right-to-left direction and the page re-rendered, so what the cards show is
Tailwind's logical properties resolving, `rtl:` variants firing, and Radix
roots reading `dir` — the three things ADR 0060 §4 is about. The strings stay
English on purpose: direction is what is under test, and keeping the words the
same is what makes the two grids comparable.

The data behind the populated state is seeded: four Optins across all three
states an Optin can be in, thirty days of counters on two of them, eight Leads
with and without a phone and with and without extra captured fields, and two
Destinations.

**The page header is in every card** — the petrol bar with the four-item nav —
so the header can be judged against what sits under it rather than on its own.
What is *not* in these cards is WordPress's own admin menu and footer, which
frame the page on the real screen. That frame is WordPress's and ADR 0035 says
it is not ours to design; it belongs in a screenshot, not in this system.

Two cards came from a **real development install** rather than the seeded one,
because seeded data could not produce them: Analytics when Optins exist but none
is published, and a Destination that is configured but bound to nothing with its
edit form open. They are not regenerated by `build.sh` and are left in place.

## The `Today` group is the real thing, not a reproduction

Those three cards were not drawn. They are the **live DOM**, captured out of a
running WordPress with the plugin activated, wrapped in wp-admin's own `<body
class="wp-admin wp-core-ui">` and served the same three stylesheets the real
page loads, in the same order: WordPress's `forms`, WordPress's `buttons`, then
the admin's `main.css`.

That ordering is the whole point and it is not incidental. The un-converted
controls take their **box model** from WordPress and only their **colour and
radius** from WConvert — so a card built from the admin's stylesheet alone
renders every native input with no border at all, which is Tailwind's preflight
winning a fight it does not win on the real page. Three details had to be right
before the capture matched:

- `<body class="wp-core-ui">`, or a native `<select>` keeps `appearance: auto`,
  ignores the height the admin sets, and renders ~20px wider than it does live;
- the app root `<div class="font-sans text-body …">`, or every control inherits
  wp-admin's 13px instead of the admin's 14px;
- wp-admin's own `body` font rule, for the same reason one level up.

**What that does not buy you.** These render on a blank page. The real admin
owns wp-admin's page with preflight on and unlayered `!important` utilities, and
a design still has to be verified there before it is believed (ADR 0035).

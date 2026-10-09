# 0130: The admin wears the wconvert.io brand

Date: 2026-10-09. Status: accepted.
Amends [0097](0097-harbor-is-the-shared-admin-frame.md)'s palette and mark,
and [0037](0037-the-admin-inherits-token-structure-and-owns-its-values.md)'s
`--primary` value. Harbor's frame, layout, type roles and motion stay as they were.

wconvert.io has an approved identity ("Espresso / ice blue / citron",
7 Oct 2026) and a real SVG mark. The plugin was still teal Harbor with an
italic CSS "w" in a square, a `dashicons-megaphone` menu icon, and teal, mint
and gold wp.org art. The plugin and the site now read as one product.

The site is the source, not a rulebook. A marketing page can be nearly
monochrome, but an admin needs a colour that says "you can click this" and
"this is selected". Where the two needs differ, the admin adds what it needs
and records why below.

## Source

The site's `src/styles/base.css`: ink `#302720`, accent `#67452e`, paper
`#faf6ed`, cool (ice blue) `#e0eff3`, warm `#eee8dc`, highlight (citron)
`#e2f475`, muted `#6b6056`, line `#ddd8ca`.

The marks are `public/images/brands/wconvert-mark.svg` (espresso tile, cream W,
citron dot) and `wconvert-mark-inverse.svg` (cream tile, espresso W), copied
unchanged to `resources/admin/src/assets/branding/`.

## Four roles

| Role | Colour | Used for |
|---|---|---|
| Structure | espresso `#302720` | Text, buttons (`--primary`), the header and footer bands |
| Action | ink blue `#1f5a6b` | Links, selected tabs, chips and list items, checkboxes, the chart line, focus rings |
| Brand | citron `#e2f475` | One brand button per screen, and signals on the espresso frame |
| Plan and info | ice `#e0eff3` | The paid plan badge, *Explore Pro*, info and selected surfaces |

Ink blue is the one colour the site does not have. It is the dark end of the
site's ice blue, so it belongs to the palette. It is 18° of hue from Harbor's
teal, but it returns as a small accent, not as the frame.

## Token map

The names stay (ADR 0037). Only the values change, plus a few new tokens.

| Token | Value | Was |
|---|---|---|
| `--primary` | `#302720` espresso; fg `#faf6ed` | `#205c57`; fg white |
| `--action` (new) | `#1f5a6b` ink blue; fg white | |
| `--ring`, `--link`, `--chart-1`, `--info` | `var(--action)` | teal, or `#1c5fa8` for info |
| `--background` | `#f6f5f1`, a near-neutral warm white | `#eaf0ed` mist |
| `--foreground` (and card/popover fg) | `#302720` | `#243b37` |
| `--card`, `--popover`, `--sidebar` | `#ffffff` | unchanged |
| `--surface`, `--muted` | `#efede8` | `#f3f6f4` |
| `--secondary` (selected) | `var(--ice)`; fg `#163f4b` | green tint |
| `--accent` (hover) | `#ebe8e1`; fg `#302720` | green tint |
| `--muted-foreground` | `#6b6056` | `#53675e` |
| `--border` | `#dedad1` | `#cad6cf` |
| `--input` | `#857a6e` | `#74877d` |
| `--chart-5` | `#7a6f63` warm neutral | slate `#5b7078` |
| `--destructive`, `--success`, `--warning` | unchanged | |
| `--success-surface`, `--warning-surface`, `--destructive-surface`, `--info-surface` (new) | `#e6f2e9`, `#fdecc8`, `#fbe6e3`, `var(--ice)` | 5–14% washes of the hue |
| `--brand`, `--ice` (new) | `#e2f475`, `#e0eff3` | |
| `--overlay` (new) | espresso at 55% | black at 50% |
| `--stage` (new) | `#f1f1ef` neutral | warm `--surface` |

The frame (`shell/header.css`) is espresso too: `--frame-ink` `#302720`,
`--frame-text` `#faf6ed`, `--frame-muted` `#c9bfb1`, `--frame-edge` `#4a3f36`,
`--frame-tint` `#433830` for hover and the plan badge, `--frame-line` `#8a7d70`
for outlined controls, and `--frame-signal` `#e2f475`.

## Why each choice

**Espresso fills buttons.** Citron is the site's loudest colour, but it
measures **1.20:1** on white. So it fails as text, as a control edge and as a
focus ring, and it cannot be the primary. Espresso with paper text measures
14.62:1 and matches the site's dark button. Espresso also keeps ADR 0037's
refusal of green intact: it is a near-black brown, so green still means only
"converted". Across ~80 hardcoded greens in the editor, chrome tints became
tokens. Only the values that mean "saved" or "converted" became `--success`
or stayed green.

**Ink blue marks what you can act on.** With espresso as both text and
action, the first pass had no colour for links, selection, the chart or
focus. In a side-by-side with Harbor, everything Harbor's teal used to mark
(*Continue editing*, the checked box, the selected tab, the chart line) read
as body text. `--action` takes every use of `--primary` that meant "selected"
or "interactive" rather than "button": 167 CSS declarations and 12 Tailwind
classes. Two exceptions keep espresso: the editor bar's top rule (brand
frame) and a button fill in the journey answer repair.

**Links have two cues.** Ink blue is 1.90:1 against body text, under the 3:1
WCAG 1.4.1 asks of a colour-only link, so links are also underlined. One base
rule sets every underline to 40% of the link colour at rest and solid on
hover, so a column of row labels stays quiet. CSS that underlines uses
`text-decoration-line`, never the shorthand, which would reset that colour.

**Citron is the brand action.** It is the `brand` button: citron on a 1px
espresso edge with espresso text (12.13:1), inverting under the pointer as on
the site. **There is one per screen**, for the action that screen exists for:
*Create campaign* and *Review & publish*. On the espresso frame, citron
(12.13:1) marks the active tab, the unread dot and focus. It is never text on
a light surface.

**The canvas is quieter than the site's paper.** Paper `#faf6ed` is 57%
saturated, and across a full admin screen it read as yellow. The canvas is
`#f6f5f1` at 22%, with the surfaces and lines retuned to match. White cards
keep the same 1.09:1 separation, and borders still do the structural work.
Paper stays where it is brand: text on espresso, the mark, the wp.org art.

**Each meaning has its own surface.** On a warm palette, amber (hue 39°) sits
about 15° from espresso, and its old 10% wash measured **1.01:1** against
the canvas. *Before you can publish* was a box you could not see. Each
meaning now has a measured surface, every wash in the admin points at one,
and warning callouts also carry a 3px inline-start bar in `--warning`, so the
signal does not rely on colour alone. Info folds into the action hue, so
there is one blue, not two.

**Selected is ice, hover is neutral.** At one value, selected and hover were
the collision `index.css` already warns about. Selected is now ice with ink
text, so selection never reads as just another beige.

**The rest:**
- The paid plan badge and *Explore Pro* are ice, as the site's Pro card is.
- The design preview's backdrop (`--stage`) is neutral grey, so the chrome
  does not tint how a merchant judges their own colours. The journey map is
  product chrome and keeps the warm neutrals.
- The dialog overlay is espresso at 55%.
- "Published" is green in the editor header, as everywhere else.
- Page-heading actions show keyboard focus again. A `box-shadow: none
  !important` reset on them had also removed the focus ring. They now get a
  2px `--ring` outline on `:focus-visible`.

## Measured ratios

These are WCAG 2.x relative-luminance ratios, computed from the hex values
rather than estimated. Text needs 4.5:1. `--input`, `--ring` and the frame
signal need 3:1 (1.4.11).

| Pair | White | Canvas | Surface |
|---|---|---|---|
| `--foreground` `#302720` | 14.62 | 13.40 | 12.49 |
| `--muted-foreground` `#6b6056` | 6.12 | 5.61 | 5.23 |
| `--input` `#857a6e` | 4.19 | 3.85 | 3.59 |
| `--action` / `--ring` / `--link` `#1f5a6b` | 7.68 | 7.04 | 6.57 |
| `--destructive` `#b42318` | 6.57 | 6.03 | |
| `--success` `#17703f` | 6.13 | 5.62 | |
| `--warning` `#8a5a00` | 5.93 | 5.43 | |

Other pairs:
- **Selected:** `--secondary-foreground` on ice reads 9.64:1, action on ice
  6.52:1, and muted text on ice 5.19:1.
- **Hover:** foreground on `--accent` reads 11.95:1, and muted text on it 5.00:1.
- **Semantic surfaces:** each meaning's text on its own surface reads success
  5.32, warning 5.08 and destructive 5.49:1. Body text on the warning surface
  reads 12.53:1.
- **Fills:** paper on espresso reads 13.55:1, and white on ink blue 7.68:1.
- **Frame:** `--frame-muted` reads 8.05:1, citron 12.13:1, ice 12.40:1,
  `--frame-line` 3.65:1, and frame text on `--frame-tint` 10.54:1.
- **Brand button:** espresso on citron reads 12.13:1.
- **Tabs:** the vendored tab trigger's `text-foreground/60` would measure
  3.83:1 over `--muted`, so `components/ui/tabs.tsx` keeps
  `--muted-foreground` (5.23:1).

## The mark

`BrandMark` (`shell/Brand.tsx`) renders the site's paths as inline SVG JSX. It
needs no request and stays crisp at 29–34px. It takes `variant: 'default' |
'inverse'`. The header and footer sit on espresso, so they use **inverse**,
because the default espresso tile would vanish there. The editor bar is white
and uses the default. The wordmark stays live text, as on the site. The
footer's generic `svg` sizing and RTL mirroring exclude the mark, so it keeps
its size and never mirrors.

The wp-admin menu icon (`AdminMenu::MENU_ICON`) is the same artwork as one
monochrome path: the tile with the W knocked out by `evenodd`, then the dot.
WordPress's `svg-painter` tints it for each admin colour scheme.

wp.org `icon-128x128.png` and `icon-256x256.png` show the main mark on a paper
square. The banners use paper, the mark with a Manrope wordmark, the site's
"Turn more visits into *connections.*", and an espresso panel holding a sample
signup card with a citron button. All were rendered at exact size in headless
Chromium. The render script was not committed.

## Out of scope

- **Typography.** DM Sans stays.
- **Visitor-facing design.** `builder/themes.ts`, `resources/templates`, the
  loaders, and the prototype scenarios' per-business `accent` values are the
  merchant's design, not product chrome.
- **WordPress-native greys** in the content-lock block editor (`#dcdcde`,
  `#50575e`, `#1e1e1e`). Only that file's teal values moved.
- **wp.org screenshots.** They still show Harbor until they are regenerated,
  which is a follow-up.

## How it got here

It took three passes, all in one PR, each checked on a seeded Playground
(four Campaigns, 40 days of counters, six leads):

1. Espresso, paper and citron as the site has them.
2. After seeing it populated: semantic surfaces, link underlines, ice for the
   paid plan, the brand button, a neutral stage, a warm overlay and
   selected/hover separation.
3. After a side-by-side against Harbor on `main`: the ink-blue action colour,
   ice for selection, and a less saturated canvas. Three directions were
   prototyped by layering CSS over the same build: the action colour, a light
   header like the site's, and both. The light header was quieter but less
   anchored inside WordPress, and citron signals need a dark band, so the
   espresso header stays.

## Verification

- **Checks:** both admin builds, TypeScript and scoped ESLint pass. The full
  Vitest suite passes (220 files, 3,899 tests, exit 0), and so does PHPUnit
  (2,579 tests).
- **First pass on Playground:** with both plugins mounted, the loaded
  stylesheet was `wconvert-pro/public/admin/main.css`. Campaigns, Analytics,
  Leads, Settings and the editor were captured at 1280px and 360px in LTR and
  RTL, with **0px horizontal overflow** on every capture.
- **Mark:** the header mark renders inverse at 34px (29px under 600px), and
  the footer mark at the same sizes, unmirrored in RTL. The editor mark
  renders at 32px.
- **Frame:** the nav focus outline is solid, 2px, citron. The menu icon tints
  under the default and Ocean colour schemes.
- **Brand button:** it reads citron with espresso text and edge at rest,
  espresso with citron text on hover, and shows a 2px `--ring` outline under
  keyboard focus.

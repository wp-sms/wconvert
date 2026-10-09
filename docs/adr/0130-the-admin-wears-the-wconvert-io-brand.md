# 0130: The admin wears the wconvert.io brand

Date: 2026-10-09. Status: accepted.
Amends [0097](0097-harbor-is-the-shared-admin-frame.md)'s palette and mark,
and [0037](0037-the-admin-inherits-token-structure-and-owns-its-values.md)'s
`--primary` value. Harbor's frame, layout, type roles and motion stay as they were.

wconvert.io has an approved identity ("Espresso / ice blue / citron",
7 Oct 2026) and a real SVG mark. The plugin was still teal Harbor with an
italic CSS "w" in a square, a `dashicons-megaphone` menu icon, and teal, mint
and gold wp.org art. The plugin and the site now read as one product.

## Source

Values are copied from the site's `src/styles/base.css`: ink `#302720`, accent
`#67452e`, paper `#faf6ed`, cool (ice blue) `#e0eff3`, warm `#eee8dc`,
highlight (citron) `#e2f475`, muted `#6b6056`, line `#ddd8ca`. All three
brand colours are used, as on the site. The values that sit between two of
them, and the semantic surfaces, were chosen by measurement.

The marks are `public/images/brands/wconvert-mark.svg` (espresso tile, cream W,
citron dot) and `wconvert-mark-inverse.svg` (cream tile, espresso W), copied
unchanged to `resources/admin/src/assets/branding/`.

## Token map

The names stay (ADR 0037). Only the values change.

| Token | Value | Was |
|---|---|---|
| `--primary`, `--ring` | `#302720` espresso; fg `#faf6ed` | `#205c57`; fg white |
| `--background` | `#faf6ed` paper | `#eaf0ed` mist |
| `--foreground` (and card/popover fg) | `#302720` | `#243b37` |
| `--card`, `--popover`, `--sidebar` | `#ffffff` | unchanged |
| `--surface`, `--muted` | `#f5f0e5`, between paper and warm | `#f3f6f4` |
| `--secondary` (selected) | `#e9e2d4`, one step deeper than hover; fg `#302720` | green tint |
| `--accent` (hover) | `#eee8dc` warm; fg `#302720` | green tint |
| `--muted-foreground` | `#6b6056` | `#53675e` |
| `--border` | `#ddd8ca` | `#cad6cf` |
| `--input` | `#857a6e` | `#74877d` |
| `--chart-5` | `#7a6f63` warm neutral | slate `#5b7078` |
| semantic | unchanged | |
| `--success-surface`, `--warning-surface`, `--destructive-surface`, `--info-surface` | `#e6f2e9`, `#fdecc8`, `#fbe6e3`, `--ice` | 5–14% washes of the hue |
| `--link` (new) | `#67452e`, the site's accent brown | |
| `--brand` (new) | `#e2f475` citron | |
| `--ice` (new) | `#e0eff3`, the site's ice blue | |
| `--overlay` (new) | espresso at 55% | black at 50% |
| `--stage` (new) | `#f1f1ef` neutral | warm `--surface` |

The frame (`shell/header.css`) is espresso too: `--frame-ink` `#302720`,
`--frame-text` `#faf6ed`, `--frame-muted` `#c9bfb1`, `--frame-edge` `#4a3f36`,
plus `--frame-tint` `#433830` for hover and the plan badge, `--frame-line`
`#8a7d70` for outlined controls, and `--frame-signal` `#e2f475`. Every
hardcoded teal in the frame now reads one of these.

## Espresso is the primary, and citron is the brand

Citron is the site's loudest colour, but it cannot be the primary. On white
it measures **1.20:1**, so it fails as text, as a control edge and as a focus
ring. Espresso with paper text measures 14.62:1 and works in both directions.
That matches the site, where the dark button carries the action.

On the espresso frame, citron measures **12.13:1** and marks the active-tab
underline, the unread-notification dot and the `:focus-visible` outline.

On light surfaces it does one more job, the one it does on the site: the
`brand` button, citron on a 1px espresso edge with espresso text (12.13:1),
inverting to citron on espresso under the pointer. The edge gives the control
its boundary, since citron alone is 1.20:1 against white. **There is one per
screen**, for the action that screen exists for: *Create campaign* on the
list and *Review & publish* in the editor. Every other action stays espresso.
Citron is never text on a light surface.

Espresso has one cost. `--primary` is now the colour of body text (1.00:1
between them), so colour alone no longer marks a link. Harbor's teal gave
only a weak cue anyway, at 1.55:1 against its body text, which is under the
3:1 WCAG 1.4.1 asks of colour-only links. So a link has two cues:

- **The `--link` colour**, the site's accent brown, at 8.51:1 on white. It is
  only 1.72:1 against body text, so it is a cue, not the indicator.
- **An underline.** One base rule sets every underline in the admin to 40% of
  the link colour at rest and solid on hover. A whole column of row labels
  (the Review dialog has one) then stays quiet. CSS that underlines uses
  `text-decoration-line`, never the shorthand, which would reset that colour.

Links that carry an icon (the header help menu, the campaign footer) keep the
icon as the cue. Selected states keep their fill or border change.

Espresso also keeps ADR 0037's refusal of green intact. It is a near-black
brown, a hue the semantic palette never uses, so green still means only
"converted". The editor shows the rule at work: across ~80 hardcoded greens,
chrome tints became tokens, and only the values that mean "saved" or "converted"
(the journey map's *Details saved here* band, the publish confirmation) became
`--success` or stayed in its green tint.

## Semantics need their own surfaces on a warm palette

The first pass kept the semantic hues and their 5–14% washes. Seen populated,
**warning stopped reading as a warning**. Amber (hue 39°) sits about 15° from
espresso and the accent brown (24–26°), so it read as part of the brand. Its
old callout background measured **1.01:1** against paper: in Review & publish,
*Before you can publish* was a box you could not see.

So each meaning gets a surface that is a distinct, measured colour rather than
a wash: `--warning-surface` `#fdecc8`, `--success-surface`, `--destructive-surface`,
and `--info-surface`, the site's ice blue. Every 5–14% wash in the admin now
points at one of these. Warning callouts also carry a 3px inline-start bar in
`--warning`, so the signal does not depend on colour alone.

## The rest of the second pass

- **Ice blue marks the paid plan.** The site uses it for its Pro card, so a
  paid plan badge and the *Explore Pro* link on the frame use it (12.40:1 on
  espresso). It is also the info surface.
- **The design preview's backdrop is neutral.** `--stage` is `#f1f1ef`. Design
  tools keep the canvas grey so the chrome does not tint how a merchant judges
  their own colours, and most templates default to cool slate. The journey
  map is product chrome and stays warm.
- **The dialog overlay is espresso at 55%**, so the page dims rather than going
  grey.
- **Selected and hover differ.** `--secondary` (selected) is one step deeper
  than `--accent` (hover). At one value they were the collision `index.css`
  already warns about.
- **"Published" is green in the editor header too**, as it is in the Campaigns
  list and the Review dialog.
- **Page-heading actions show keyboard focus again.** A `box-shadow: none
  !important` reset on them had also removed the focus ring. That predates this
  ADR, and it came to light while checking the brand button. They now get a
  2px `--ring` outline on `:focus-visible`.

## Measured ratios

These are WCAG 2.x relative-luminance ratios, computed from the hex values
rather than estimated. Text needs 4.5:1. `--input`, `--ring` and the frame
signal need 3:1 (1.4.11).

| Pair | White | Paper | Surface |
|---|---|---|---|
| `--foreground` `#302720` | 14.62 | 13.55 | 12.86 |
| `--muted-foreground` `#6b6056` | 6.12 | 5.67 | 5.38 |
| `--input` `#857a6e` | 4.19 | 3.89 | 3.69 |
| `--ring` `#302720` | 14.62 | 13.55 | |
| `--destructive` `#b42318` | 6.57 | 6.10 | |
| `--success` `#17703f` | 6.13 | 5.68 | |
| `--warning` `#8a5a00` | 5.93 | 5.50 | |
| `--info` `#1c5fa8` | 6.46 | 5.99 | |

Other pairs: `--secondary-foreground` on `#eee8dc` is 11.98:1, and muted text on
it is 5.01:1. Paper on espresso (`--primary-foreground`) is 13.55:1. On the
frame, `--frame-muted` is 8.05:1, citron is 12.13:1, `--frame-line` (the
outline of the footer Help button) is 3.65:1, and frame text on
`--frame-tint` is 10.54:1. `--success` on its own tints (`#eff6f0`, `#f0f9f2`)
measures 5.58 and 5.70:1.

Second pass:
- Semantic text on its own surface: success 5.32, warning 5.08, destructive
  5.49 and info 5.48:1. Body text on the warning surface reads 12.53:1, and
  muted text on it 5.25:1.
- `--link` reads 8.51 on white, 7.89 on paper, 6.60 on `--secondary`, 7.30 on
  the warning surface and 7.22 on ice.
- Muted text on the new `--secondary` reads 4.75:1, and on `--stage` 5.41:1.
- Ice on espresso reads 12.40:1, and espresso on citron 12.13:1.

The vendored tab trigger's `text-foreground/60` would measure 3.87:1 over
`--muted`, so `components/ui/tabs.tsx` keeps `--muted-foreground` (5.38:1).

## The mark

`BrandMark` (`shell/Brand.tsx`) renders the site's paths as inline SVG JSX. It
needs no request and stays crisp at 29–34px. It takes `variant: 'default' |
'inverse'`. The header and footer sit on espresso, so they use **inverse**,
because the default espresso tile would vanish there. The editor bar is white
and uses the default. The wordmark stays live text, as on the site. The
footer's generic `svg` sizing and RTL mirroring now exclude the mark, so it
keeps its size and never mirrors.

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

## Verification

Second pass: I checked it again on a seeded Playground with four Campaigns, 40
days of counters and six leads. Captures cover Campaigns, Analytics with a goal
report, Leads with the detail dialog, goal picking, every editor tab and the
Review & publish dialog. The brand button reads citron, espresso, espresso at
rest; espresso, citron on hover; and shows a 2px espresso outline under
keyboard focus.

First pass:

Both admin builds, TypeScript, scoped ESLint, 12 focused Vitest files (826
tests, exit 0) and the admin PHPUnit filter (15 tests) pass. On Playground with
both plugins mounted, the loaded stylesheet was
`wconvert-pro/public/admin/main.css`. Campaigns, Analytics, Leads, Settings and
the editor (Edit and Flow) were captured at 1280px and 360px in LTR and RTL,
with **0px horizontal overflow** on every capture. Measured on the page:

- The header mark renders inverse at 34px (29px under 600px).
- The footer mark renders inverse at the same sizes, untransformed in RTL.
- The editor mark renders default at 32px. It is hidden on phones, as before.
- The active tab underline is `rgb(226, 244, 117)`.
- The keyboard focus outline on the nav is solid, 2px, citron.

The menu icon tints correctly under the default and Ocean colour schemes.

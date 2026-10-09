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

Values are copied from the site's `src/styles/base.css`, and none are
invented here: ink `#302720`, accent `#67452e`, paper `#faf6ed`, warm
`#eee8dc`, highlight (citron) `#e2f475`, muted `#6b6056`, line `#ddd8ca`.
The two in-between values (`--surface` and `--input`) were chosen by measurement.

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
| `--secondary`, `--accent` | `#eee8dc` warm; fg `#302720` | green tints |
| `--muted-foreground` | `#6b6056` | `#53675e` |
| `--border` | `#ddd8ca` | `#cad6cf` |
| `--input` | `#857a6e` | `#74877d` |
| `--chart-5` | `#7a6f63` warm neutral | slate `#5b7078` |
| semantic | unchanged | |

The frame (`shell/header.css`) is espresso too: `--frame-ink` `#302720`,
`--frame-text` `#faf6ed`, `--frame-muted` `#c9bfb1`, `--frame-edge` `#4a3f36`,
plus `--frame-tint` `#433830` for hover and the plan badge, `--frame-line`
`#75685c` for outlined controls, and `--frame-signal` `#e2f475`. Every
hardcoded teal in the frame now reads one of these.

## Espresso is the primary, and citron is only a signal

Citron is the site's loudest colour, but it cannot be the primary. On white
it measures **1.20:1**, so it fails as text, as a control edge and as a focus
ring. Espresso with paper text measures 14.62:1 and works in both directions.
That matches the site, where the dark button carries the action.

So citron appears only on the espresso frame, where it measures **12.13:1**:
the active-tab underline, the unread-notification dot and the `:focus-visible`
outline on the dark bands. It never fills a button and is never text on a light
surface.

Espresso also keeps ADR 0037's refusal of green intact. It is a near-black
brown, a hue the semantic palette never uses, so green still means only
"converted". The editor shows the rule at work: across ~80 hardcoded greens,
chrome tints became tokens, and only the values that mean "saved" or "converted"
(the journey map's *Details saved here* band, the publish confirmation) became
`--success` or stayed in its green tint.

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
frame, `--frame-muted` is 8.05:1, citron is 12.13:1, and frame text on
`--frame-tint` is 10.54:1. `--success` on its own tints (`#eff6f0`, `#f0f9f2`)
measures 5.58 and 5.70:1.

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

# Template pack experience — 14 September 2026

## Goal

Improve the structure and clarity of Template packs and the installed-pack
preview. The list helps a merchant find collections; the detail helps them
choose and inspect a design before the existing content-choice review.

## Behaviour

- Separate installed collections (Installed) from Available to install.
  Explore designs always opens the installed copy; Preview update is a separate
  action when a newer version exists. Checking and downloading remain explicit.
- Keep catalog connection details in a disclosure beneath the collections.
  Loading, retry and operation failures belong to the pack surface.
- Open a pack at its first design matching the draft's display type. Group the
  design list into matching and other formats, with format and screen metadata.
  Other formats can be inspected, but cannot continue into the current draft.
- Show one selected design with Desktop/Mobile (320px) and Form/Success controls.
  Measure the design at its requested width, then scale the composition to fit.
- Use a compact labelled design selector below 900px; the editor itself requires
  at least 782px. Keep the action footer visible and the content scrollable.
- Preserve selection after installation. Continue with this design opens the
  existing content-choice review; applying still requires its explicit action.
  All packs restores the originating card's focus and list scroll position.

No artwork, template trees, renderer rules, database schema or catalog protocol
changes are part of this follow-up.

## Validation

- Full JavaScript suite: 2,319 tests across 95 files passed, including 11 pack
  interaction tests and the stylesheet contracts. TypeScript and ESLint passed.
- The complete build passed, including Free and Pro admin assets.
- Live WordPress: desktop collection list and detail inspected; at 820 × 900,
  the compact selector changed the selected design, the mobile preview measured
  320px, tall content scrolled, and the footer remained visible without horizontal
  overflow. Form and Success controls were exercised. Continue opened the
  selected Punched ticket content-choice review, and closing it left Save draft
  disabled. The temporary viewport override was reset.
- Original Optins were not saved or published during this UI check.

## Final review

### Standards

The review found a missing inert boundary around the sample preview and scroll
position captured after the preview request instead of before it. Both are
corrected. The preview now follows the existing design-detail convention with
`inert` and `aria-hidden`; sample controls cannot receive input or enter the
screen-reader navigation. A delayed-response regression covers scroll restoration.

The review also noted duplicated ResizeObserver measurement as a judgement-call
maintenance smell. This bounded follow-up leaves the existing content-choice
stage unchanged; a shared stage can be considered when both preview surfaces
next change together.

### Spec

The single finding was the same missing inert preview boundary, now corrected.
No missing requirements or scope expansion were identified.

After those corrections, all 81 pack/gallery/detail tests, TypeScript, ESLint and
both admin builds passed. Live WordPress confirmed the sample wrapper is inert
and hidden from accessibility navigation, with the draft still unchanged.


## Screenshot-led layout refinement

The follow-up removes the standalone library-source row: Your designs and
Template packs now share the Browse designs title row, with the draft format in
a compact badge. The accessible dialog description remains available without
using a visible paragraph. Header utilities override the vendored DialogHeader
column layout through the component's normal class-merging mechanism.

The collection list uses a green Installed group label, a neutral Available to
install label, and a pack count, replacing the repeated introduction and group
description. Amber remains reserved for updates. Pack-card descriptions and
explicit preview/install actions are preserved.

The pack header and body share one rail-width value. All packs sits above the
design list; collection identity aligns with the preview column. The selected
design, sample label and preview controls share a wrapping toolbar. The compatible
installed footer retains the content-choice explanation and action without a
second readiness headline.

Validation: 373 pack/gallery/detail/stylesheet tests, TypeScript, ESLint and both
admin builds passed. A combined WordPress visual check and one follow-up verified
the layout. At 1512 × 806, the main header is 65px high and the preview stage is
451px high; the title and tabs share a row, both column edges align, and Fieldwork
fits in the visible stage. At 820 × 900, the compact selector and footer remain
visible without horizontal overflow. The temporary viewport override was reset;
no draft was applied, saved or published.

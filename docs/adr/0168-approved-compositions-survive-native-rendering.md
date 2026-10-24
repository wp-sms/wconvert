# 0168 — Approved compositions survive native rendering

Date: 2026-10-24. Status: accepted.

The first implementation of the fifty approved campaign prototypes passed
registration and journey checks but changed their palettes, typography, image
crops and layout. A screenshot comparison of Deadline Scoreboard exposed the
missing fidelity check. A valid native tree is not evidence of visual fidelity.

## Decision

Refine the fifty explicit native trees against the approved prototype at desktop
and phone widths. Preserve existing leaf identities. Offers, dates, codes, forms
and actions remain native; original decorative vectors may be image assets.
Repeat the comparison after binding Playbook copy and on real WordPress.
The prototype is a reference, not a runtime dependency or HTML import format.

Add three bounded, optional presentation capabilities:

- Split `narrow_layout` selects natural wrapping (the default), stacking, or
  reversed stacking below 40rem of available design width. This is independent
  of the 24rem typography-token breakpoint. The explicit compact arrangement
  avoids squeezing a form while retaining desktop proportions. The manifest
  exposes these choices in the existing structure inspector.
- Grid `narrow_basis` selects a minimum track width at the existing 24rem
  breakpoint. Columns still auto-fit; no fixed column count is introduced.
  Nested grids reset the override, and omitted values retain the normal basis.
- Countdown `precision: minutes` omits seconds while retaining the exact real
  deadline. `density: stacked` draws the three/four units as a rail and returns
  to a horizontal compact row below 24rem. Existing timer defaults are unchanged.

All options survive normalization, snapshots, copy binding and catalogue export.
Code-only panels retain their shell during capture conversion, and adjacent
coupon eyebrow labels survive acknowledgement pruning. Removing capture restores
the code to the same container and sibling position, without new stored metadata.
No arbitrary CSS, scripting or markup is added to templates. Consent visibility
still follows site configuration. Editable coupon actions avoid repeating a
merchant-configurable code in a button label. Form inputs retain 16px text and
controls retain their touch targets even where the prototype was smaller.

## Cost and verification

The initial compiled changes measured 18,438 B Free / 31,805 B Pro gzip. Pro
exceeded its existing ceiling by 61 B. Allocate 128 B to Pro (31,872 B total)
for these presentation capabilities; Free remains at 18,480 B. The checks
remain hard, flagless gates, and there is no added runtime dependency.

The review uses the shipping renderer, approved-reference screenshots, all
screens at eight widths in LTR and RTL, and disposable WordPress journeys.
Default announcement controls keep aligned heights. Stress-copy labels may grow
vertically while overlap and overflow checks remain enforced. A deliberately stacked form is distinguished from an accidentally wrapped
field/button row in the composition check. Evidence and the remaining practical
adaptations are recorded in `docs/reviews/black-friday-fidelity/`.

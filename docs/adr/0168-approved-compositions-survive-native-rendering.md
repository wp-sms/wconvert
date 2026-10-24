# 0168 — Approved compositions survive native rendering

Date: 2026-10-24. Status: accepted.

The first implementation of the fifty approved campaign prototypes passed
registration and journey checks but changed their palettes, typography, image
crops and layout. A screenshot comparison of Deadline Scoreboard exposed the
missing fidelity check. A valid native tree is not evidence of visual fidelity.

**Amended by [ADR 0169](0169-campaign-fonts-are-local-assets.md):** review
fonts did not establish installed-font fidelity. Font delivery must preserve
the declared typefaces inside the real plugin too.

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

The next real-plugin review adds three explicitly approved reusable controls:
divider `pattern` (`solid` or `dashed`), code `appearance`, and `text-weight`.
A proposed receipt-edge control was declined and removed before finalization.
The receipt's original oval eyes and transparent zigzag footer are ordinary
image assets; no new decoration kind or silhouette control is added. The
footer's transparent pixels reveal the real page around the cream teeth.
Receipt ledger rows, labels, percentages and the action
remain editable native leaves with their original identities. Code `appearance`
selects the existing boxed default or plain selectable text with no invented
border or padding; plain code follows the existing alignment token. The
`text-weight` token lets figures and other text use the declared font’s 900/950
weight rather than silently stopping at the browser’s usual bold 700. Existing
emphasis remains at least 700, and designs without an explicit weight keep their
previous appearance.

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
remain hard, flagless gates, and there is no added runtime dependency. The later receipt and form-alignment
corrections allocate a further 192 B to each loader for the approved rule/code/text controls and field-label baseline alignment. This is a fixed
allowance for the implemented capabilities; neither gate gains a bypass or
percentage tolerance. Final compiled measurements are recorded with the real
plugin fidelity evidence.

The review uses the shipping renderer, approved-reference screenshots, all
screens at eight widths in LTR and RTL, and disposable WordPress journeys.
Default announcement controls keep aligned heights. Stress-copy labels may grow
vertically while overlap and overflow checks remain enforced. A deliberately stacked form is distinguished from an accidentally wrapped
field/button row in the composition check. Evidence and the remaining practical
adaptations are recorded in `docs/reviews/black-friday-fidelity/`.

### Offer figures are not sentence headlines

The Extra-Ten Coupon's `10%` display now declares `offer_amount`, a heading
Slot Role distinct from `headline`. Both PHP copy transfer and editor role
controls read the manifest, so ordinary campaign sentences cannot be bound
into the oversized numeric display. A design switch with no source offer
amount leaves that slot empty and the preview/editor names what must be
filled. It does not assume the sample discount is an actual store offer.
Adding a form retains the amount on the offer and gives the acknowledgement
a readable 32px heading. Adding a generic heading never automatically assigns
`offer_amount`; that specialized role remains available only for an explicitly
chosen numeric offer block.

The reported shoe screenshot was reproduced by transferring Closing time's
words into Extra-Ten's former `headline` slot. Direct fresh creation through
the real WordPress setup picker, including inspecting Closing time before
Extra-Ten, preserved the selected coupon's own copy. An out-of-order response
check also preserved each setup's ID and revision. These checks establish the
role collision and guard the investigated creation paths; they do not prove
which interaction produced the original screenshot, whose request history
was unavailable.

Coupon values remain merchant-authored: a setup cannot assert that its sample
coupon exists in a store. An empty code shows `YOUR CODE` only in the admin
preview, with an instruction to supply the real coupon. That placeholder is
never saved into the campaign or sent to visitors. Disposable visual-review
fixtures explicitly configure the approved fictional code from the source
design, while functional journey fixtures continue using `REVIEW10`; the
review record must distinguish those configured examples from an untouched
new setup.

### Inline width is not the phone viewport breakpoint

The real WordPress review found that a 390px inline design is wider than the
existing 24rem narrow-token breakpoint, although its nested splits already
stack below 40rem. Twelve Month Deal and Home Edit had therefore retained
large desktop headings, grid tracks and image heights. Preserve the shared
24rem contract: these two authored designs use the existing safe `clamp()`
style expressions and container-relative lengths for fluid base sizes. The
calendar grid's `em` basis follows its local fluid text size, retaining six
columns on desktop and four on a 390–430px inline container. Home Edit's image
and heading similarly fit those intermediate widths without relying on a
viewport-specific renderer override.

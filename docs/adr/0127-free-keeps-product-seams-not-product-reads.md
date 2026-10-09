# 0127: Free keeps the product seams, not the product reads

Date: 2026-10-05. Status: accepted for the free 1.0.0 wp.org submission (#96).
Amends [0122](0122-product-activity-uses-retained-anonymous-dimensions.md),
[0123](0123-quiz-results-select-products-by-category-and-attributes.md),
[0125](0125-product-warnings-are-current-catalog-advice.md),
[0082](0082-template-packs-install-as-validated-local-data.md) and
[0083](0083-installed-packs-supply-campaign-starting-points.md). Completes
[0116](0116-free-shows-nothing-it-cannot-run.md) §3 for work that landed after it.

The WooCommerce recommendation, quiz-cart and product-health work (#205–#220)
put three kinds of code in free: capability probes, product reads, and
product-facing UI. Each was tested against five installs — free only, Pro
without WooCommerce, Pro with WooCommerce, Pro deactivated with leftover
Campaigns, and a template import on free. Only some of it can move.

**Product reads move to Pro.** The public `/product-matches` route and the
admin `/product-filters` route live in `pro/modules/journeys/src`, registered by
that module with the `data-product-matches` payload attribute it needs. A
category result exists only where the journeys module does; on free the
Campaign is suspended, so no visitor could reach the route. The loader's
`products.ts` moves to `pro/modules/journeys/loader/` for the same reason:
free's loader entry never imported it. `journey-capture.ts` stays in free,
because free's own admin (`journeyTestState.ts`) imports it.

**Seams and probes stay in core.** `CommerceSupport`, `JourneySupport`,
`ResultProductSource`, `ProductStats` and its report are what drive suspension,
the publish, capture and import refusals, draft repair, safe export and
retention after a downgrade ([0122](0122-product-activity-uses-retained-anonymous-dimensions.md)).
Moving them would break the downgrade and import cases. `ProductHealth` keeps
the `wconvert_check_products` seam and reads no catalog itself: the journeys
module answers for quiz results only when nothing else has (priority 20),
cart-recovery for recommendations and cart buttons (priority 10). `locked.json` stays, because Pro reads free's copy for higher-rung
upsells.

**Product UI is gated on the capability, not the tier.** One predicate per
side — `CommerceSupport::productModuleActive()` and `productModuleActive()` —
asks whether journeys or commerce is active. The Campaigns list asks for
product checks, and the endpoint reads any campaign, only then. The privacy
disclosure of product activity, in `DataMap` so the policy text and the
settings screen cannot disagree, also stays while a removed module's retained
rows may exist (`ProductStats::tracked()`), and activation re-schedules their
pruner. The product report renders no placeholder while it waits on an install
with no product module, but still shows retained activity.

**Free names no product (0116 §3).** Eight strings written after 0116 named
"WConvert Pro" on states a free install reaches after Pro was removed or by
importing a design. On
free each now reads *"This design uses elements this site can't display."*;
paid installs keep their wording. The admin uses `unlessFree()`; PHP asks
`WpProPresence::installedTier()`.

**Third-party marks leave the free ZIP.** The Mailchimp and Brevo marks move to
`pro/modules/destinations/admin/` and fill a `providerMarks` slot from Pro's
admin entry. Free falls back to the plug icon. 0029(b) allowed them; they were
never rendered on free, so carrying them was cost without use.

**Template packs hide until a catalog is configured.** No catalog is configured
by default, so the picker's Template packs tab and the goal screen's Browse
template packs button appear only when `TemplateCatalog::configured()` is true.
A premium pack's "Pro" badge never renders on free.

**Two zeros free cannot earn are not drawn.** Analytics hides the cart-return
and basket-addition cards where the cart module is absent and nothing was
recorded for them; the report data, monthly targets and period comparison are
unchanged. Leads offers the question-answer export where journeys run, or where
the listed submissions already carry answers, so a downgraded site keeps it.

# PR 300 approval refresh — 20 October 2026

Reviewed the current renderer and campaign revisions on `codex/template-polish-review-scope` after the shared close/select/phone icon correction. This report approves 31 setups: the 25 unique members of the six curated collections and the six considered-essentials setups. It does not approve the remaining 101 stale studio setups.

## Visual review

All 56 screens/results in scope were inspected, including acknowledgements and every coffee quiz result. `screen-index.json` maps each four-screen board to its setup and step. `visual/` pairs 320 and 1280px; `middle/` pairs 390 and 768px; `wide/` pairs 320 and 1440px; `stress/` pairs 320 and 1280px with longer copy/consent and RTL. Every board in all four folders was visually inspected. Text, spacing, form grouping, wrapping and button hierarchy remain usable. Close crosses are centred and select chevrons have visible size and text clearance. No new source design defect was found in this refresh.

`native/` contains mounted WordPress screenshots for 25 non-commerce setups at 320/1280px. `commerce/` contains all six commerce setups at both widths, including the coffee question and three results. These screenshots were also inspected. Real product data is loaded; products without artwork omit the image. Repeated coffee names are seeded fixture products, not template content.

Two capture-harness mistakes were detected during inspection and corrected before approval: the viewport override affected the newest browser tab, so incorrectly sized phone files were replaced after asserting `innerWidth === 320`; four commerce phone captures preceded asynchronous product loading, so they were replaced after waiting for actual product actions. The final evidence files contain the corrected output. Screenshots alone are not proof of successful loading; future captures must assert the expected content before saving.

## Automated and practical checks

- `inventory-layout.json`: 8,384 cases across 263 registered designs/setups, four widths, both directions, normal/long content; zero reported failures. This is regression coverage, not editorial approval of the full inventory.
- `scope-layout.json`: 896 cases across the 31 reviewed setups; zero reported failures.
- `controls.json`: 4,192 cases, covering 2,760 close controls, 408 select controls and 128 phone controls; zero reported failures. Fine-pointer close targets use the runtime's 32px threshold, coarse-pointer targets 44px. Other controls retain the 44px check.
- `studio-journeys.json`: all 31 journeys passed. Submission journeys included simulated failure/retry. Static actions and the coffee quiz are not labelled submission-retry tests.
- `native/results.json`: actual WordPress form submissions and acknowledgements at both widths. Recorded validation checks exercised missing required data and invalid email; not every phone recapture repeated every negative case. Phone and multistep service enquiry submissions reached their acknowledgements. Marketing consent was explicitly selected where present.
- `commerce/results.json`, final screenshots and `commerce/cart-check.json`: real WooCommerce recommendations, quiz results and action links; a phone add-to-cart changed the seeded cart from one item to two, with the visible confirmation in `cart-result.png`.
- `coupon.json`: the configured test coupon applied a 10% discount to a 100 subtotal.
- `registration.json`: all 132 curated setups prepared successfully in native WordPress.
- `wordpress-summary.json`: 83 local captures, weekday preference persisted, nine resource emails intercepted locally. The alternative “Either works” value was not submitted in this refresh. No external email or SMS was sent.
- `proof.json`: complete, hashed six-setup batch coverage at all required studio and WordPress widths. `manifest.json` pins native screenshots for every reviewed setup.

The disposable instance uses WordPress 7.1.3, WooCommerce 11.1.2 and the current mounted plugin. Browser viewport testing is not a physical-device or cross-browser claim. No conversion-performance claim is made. Real delivery and hosted publication are outside this review.

## Code-review correction

Independent specification and standards reviews found that changes under `resources/phone/` were missing from shared review-scope detection. Added that directory and its regression test; both reviewers rechecked and reported no remaining findings. The library audit now distinguishes the existing close-control target thresholds from the larger form-control threshold. No approval criteria or revision hashes were weakened.

## Collection scope

The following collections use the reviewed setups: sale-planning, launch-a-collection, service-enquiries, reader-relationships, black-friday-2026, help-shoppers-choose. Collection approval is recorded separately after setup imports, with current revisions and discovery evidence. Existing campaign data is not modified by catalogue compilation. No Worker or R2 upload is part of this change.

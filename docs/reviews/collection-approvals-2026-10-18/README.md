# Bundled collection review — 18 October 2026

Fresh review of the 24 unique setups used by all six bundled collections, against the current renderer on base commit 8387a91d. The October 17 coupon renderer change had invalidated earlier approvals. No renderer, template or setup content changed during this review. Approvals are imported through the existing tooling, not edited or bypassed.

## Observed and tested

- All 42 prepared screens/results inspected in the 11 paired desktop/320px boards under visual/. All 11 long-copy/RTL boards under stress/ were also inspected. Each campaign audit covers 672 cases across eight widths (320–1440px) and both directions, with zero flagged layout, contrast or control-size failures. The incidental design audit covers only three matching design screens; it is not a complete library audit.
- All 24 studio journeys passed. Forms exercised invalid input, simulated failure, preserved answers, retry and completion where applicable; links and finder routes were checked. See studio-journeys.json.
- WordPress 7.1.3 / PHP 8.1.34: 36 configured desktop/320px journeys passed for the 18 non-commerce setups. All 98 native screenshots were inspected, including acknowledgements, failure states, phone-country selection and copied-code feedback. Real local leads were saved; empty/invalid forms and missing required consent were refused. Mail handoffs were intercepted; no external messages were sent. Resource links and a real WooCommerce 10% coupon were exercised. See native/native.json.
- WooCommerce 11.1.2: the six commerce setups were exercised with fictional products and baskets at desktop and 320px. Basket additions were confirmed; empty-cart conditions suppressed relevant campaigns; all three coffee results linked to the expected products; an empty catalogue retained its shop link. All 20 commerce screenshots were inspected. See commerce/results.json. An initial attempt lacked the disposable fixture; after seeding it, the full commerce run passed.
- Six candidate collection memberships and prepared previews inspected, including Free availability and calendar boundaries. Candidate discovery leaves existing campaigns unchanged. See discovery/discovery.json. Publication and the subsequent six-collection native discovery check are recorded separately after importing these decisions.

## Decision and limits

Approve these 24 setups and the six collections listed in manifest.json for editorial use. No scoped setup requires revision. Fields, consent, headings, action placement and acknowledgements remain coherent; longer popup content scrolls within the phone viewport. The native commerce fixture intentionally has no product photos; product choices, prices and actions are real local WooCommerce results. Studio product cards are explicit placeholders.

This is Chromium desktop/phone emulation, not physical-device or translated-language certification. RTL uses English stress text to check layout. No external delivery, conversion lift, live Nexus/R2 acceptance or complete 128-setup library approval is claimed. The other 104 setup reviews remain stale and outside these bundled collections. Merchants still configure their own resources, products, offers, dates and delivery providers before publication.

## Evidence integrity

manifest.json records exact setup revisions and SHA-256 hashes for the fresh captures and result files. Review records also bind this report and the manifest. Evidence was produced during this review; no earlier screenshots or results were reused. Post-publication/build results are separate so this evidence remains immutable.

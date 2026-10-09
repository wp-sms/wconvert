# Product recommendations: release candidate

5 October 2026. **Ready for staging and a merchant pilot, not publicly released.**
The approved local design and existing demo campaign are unchanged.

## What is included

Main product → useful extras → when to show them. Shoppers can add one eligible
simple product directly, receive clear feedback and continue shopping. Products
requiring options use their product page. Existing link campaigns keep their
click-based behavior and history. Confirmed additions have a separate Goal and
supporting item-addition count; they are not purchases or proven revenue uplift.

## Completed checks

| Check | Evidence / result |
| --- | --- |
| Design-library review gate | Renewed 18 affected setups and five collections; regenerated the five runtime revision references. No collection membership/copy changes. |
| Existing designs | All 122 prepared setups / 241 screens and results retain identical markup and styles. Fresh desktop/320px visual review of every collection setup screen. |
| Responsive library checks | 1,928 width/direction/screen cases; zero automated layout findings. Visual review is recorded separately. |
| Current packaged runtime | WordPress **7.1.2**, PHP **8.3.33**, WooCommerce **11.1.2**: 21 recommendation checks + 14 addition checks passed. |
| Older packaged runtime | WordPress **6.8.10**, PHP **8.1.34**, WooCommerce **10.3.6**: the same 35 checks passed. |
| Real cart UI | Classic Woo template fixture updates its mini-cart; Twenty Twenty-Five updates the modern mini-cart without opening its drawer. Woo 10.3's older Blocks mini-cart also updates after a keyboard addition. |
| Narrow storefront | Actual WordPress page embedded at 390px and 320px viewport widths; readable single-column controls, measured document width equals scroll width. This is not a physical-phone or Safari test. |
| Rollback and tier changes | Branch-base package rollback, candidate re-upgrade, Basic downgrade and Elite restoration all preserve saved campaign snapshots and statistics. Frontend still boots; unavailable commerce is absent. |
| Packages | Core, Basic, Pro and Elite build and pass artifact boundaries. Loader and optional commerce budgets pass. No test fixtures or paid implementation in the Free package. |
| Regression checks | Prior complete runs: 3,764 JS tests and 2,544 PHP tests. Final lifecycle check: 33 PHP tests. Fresh template-studio suite: 36 tests. Type/static/source checks and final build pass. |

The earlier CLI command flags did not prove runtime versions. The harness now pins
versions in the blueprint and reports actual PHP/WordPress/Woo versions; the two
rows above use those verified values. Do not reuse an earlier requested PHP
version as measured evidence. Woo 10.3 was selected for the older WordPress series
using the [official compatibility table](https://woocommerce.com/document/update-php-wordpress/).

Screenshots, runtime JSON, HTTP check logs, `package-cycle.json` and the separate
`library-review.md` sit beside this checklist. The five collections pass the normal
`templates:collections:check`; historical reviews outside these collections were
not silently renewed. The package checksums are in `artifact-checksums.json`.

## Candidate files

The dated handoff copy is `dist/recommendations-rc-2026-10-05/`.
Header versions remain **0.1.0**; identify this local candidate using its SHA-256
manifest, not that development version alone. No tag, hosted release or deployment
was created. Packages were built from the recommendation development changes on
this branch; the checksum manifest identifies their exact bytes.

Install the **Core** and **Elite** ZIPs together on a staging copy for this feature.
Basic and Pro ZIPs are supplied for package-boundary verification; direct additions
require Elite and WooCommerce. Do not install all three Pro tiers side by side.

## Short staging walkthrough

1. Create a campaign with **Increase basket value → Add useful extras**.
2. Choose one main product and two or three sensible extras. Use an automatic
   product-page placement for a classic theme, or insert the campaign block in the
   product template for a block theme. Check the sample visit before publishing.
3. Open the product page as a shopper. Add one extra, check its quantity and the
   native cart, then try another. Each pending button must add only once.
4. Check a sold-out extra and a product needing options. No misleading success or
   unconfigured option should be added. Verify the existing link campaign too.
5. Review the results in the completed-day report window. Today's additions enter
   the standard report tomorrow; previews must not create shopping results.

For a staging rollback, restore the previous paired Core/Pro plugin files from the
staging backup. Do not uninstall to roll back: uninstall intentionally removes
plugin-owned data. The tested file rollback preserved campaign snapshots and stats.

## Before public release

- Walk through setup with a merchant using a real catalog and useful pairings.
- Test that store's theme, option/add-on plugins, cache, currency/tax setup and cart
  drawer. The classic fixture and one official block theme are a bounded matrix,
  not a promise that every extension is supported.
- Check physical phones/Safari and assistive technology. Keyboard behavior and
  responsive browser layout were checked; a full accessibility audit was not.
- Measure the planned 50–500-product and larger-catalog cases, then run the normal
  code-review/CI and versioned public-release process.

Existing safeguards reject unsupported option/validation extensions rather than
bypassing them. The Woo interactivity refresh bridge remains version-sensitive.
Concurrent cart writes from unrelated plugins, production load and sales uplift
are not established by this local candidate.

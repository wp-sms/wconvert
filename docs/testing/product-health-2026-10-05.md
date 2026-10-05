# Product warnings — 5 October 2026

Implemented the first approved maintenance extension, ADR 0125. Campaigns shows
page-scoped product warnings and campaign details offer Review products beside
the explanation. Recheck reads the current catalog. It does not change product
stock, publish a draft, mutate a basket or count visitor activity.

## Verification

- Full PHPUnit: 2,568 tests, 15,774 assertions passed.
- Final affected UI tests: 50 passed (product checks, campaign list/navigation);
  campaign details' three tests also passed before the final adjacent action.
- Full Vitest: 3,794 passed, one existing builder Undo/Redo test exceeded its
  five-second limit during the concurrent suite. That exact test passed alone
  in 1.1 seconds without a source or timeout change. This is not a clean single
  full-suite run.
- TypeScript, ESLint, PHPStan and source contract checks passed.
- Both Free and Pro admin builds passed on Node 22.23.3. Existing Vite chunk-size
  and mixed-import notices remain. No visitor loader code or budgets changed.
- Eight grouped real HTTP checks passed on disposable WordPress 7.1.2,
  PHP 8.3.33 and WooCommerce 11.1.2. Coverage: admin permission/batch bounds,
  healthy and basket-dependent sources, stock changes, published/draft
  separation, reserve products, empty/deleted filters, failed Store API reads,
  ordinary quiz links, unavailable main products, missing cross-sells,
  unsupported addition offers, warning recovery and unchanged cart/statistics.
- Local authenticated browser: warnings open details, recheck clears the valid
  link-only fallback's false warning, and Review products opens the correct
  editor. Verified the warning panel at desktop and 320px width.

The full PHP run exposed an old LoaderContractTest expectation for the pre-ADR
0124 Free byte limit. Updated the expected diagnostic to the existing 14,624 B
limit; the limit and runtime were not changed in this slice.

Evidence: [Woo checks](../reviews/product-health-2026-10-05/woocommerce.txt),
[test results](../reviews/product-health-2026-10-05/checks.txt),
[desktop](../reviews/product-health-2026-10-05/desktop.png),
[phone](../reviews/product-health-2026-10-05/mobile.png).

Reproduce with the existing disposable recommendations-spike server and run
`node tools/visual-tests/recommendations-spike/check-product-health.mjs`.
The script uses only that server at port 9445, not a saved merchant site.

## Limits

These are current catalog checks for displayed rows, not continuous monitoring
or a whole-store audit. Category checks intentionally share the runtime's bounded
candidate window. Display rules, placement and visitor baskets still affect
appearance. This slice does not implement ordering or variation selection.

Release ZIPs were not regenerated for this maintenance extension. Rebuild and
validate them before release, complete the existing manual storefront cart
pass, and follow required PR/CI gates. No public release or push was performed.

# Product recommendations release checklist

Review date: 5 October 2026. Scope: the current product-link recommendation
slice approved from prototype B. The later direct-add slice has its own [verification record](../../testing/recommendation-additions-2026-10-05.md); the original evidence below describes the link-based slice.

The local demo and automated checks support a merchant walkthrough. They do not
establish broad theme compatibility, merchant usability or increased sales.
Nothing has been deployed or released by this review.

## Checklist in plain language

| Check | Current status |
| --- | --- |
| Show the right extras and accurate prices | Passed in the local demo and real WooCommerce integration checks |
| Hide items already in the basket and unavailable products | Passed; both selected products and cross-sells covered |
| Hide the offer when nothing useful remains | Passed in the live demo and integration checks |
| Work on phones and with a keyboard | Checked on the local block theme at 1280, 390 and 320 pixels; broader accessibility review remains open |
| Keep testing separate from real shopping and results | Sample basket unchanged after preview calls; click contracts covered by automated tests; production guest report walkthrough remains open |
| Make setup clear | Simplified settings and sample product selector; setup guide prepared; merchant walkthrough remains open |
| Build and package without breaking existing features | See engineering evidence below |
| Be easy to stop | Unpublish is the existing stop action; rehearse upgrade and rollback with the final release candidate before release |

## Evidence from this review

- Local storefront: Twenty Twenty-Five block theme, WooCommerce 11.1.2, manual
  campaign block in the demo brewer's product template. Three cards showed
  filter $15, brush $8 and jar $12 with an empty basket.
- Keyboard: tabbing reached the product link with a visible focus ring. Enter
  opened the correct filter and brush product pages. Those other product pages
  did not show the brewer's WConvert offer.
- Added the filter using the native WooCommerce button: only brush and jar
  remained on returning to the brewer. Added brush and jar: the offer stayed
  hidden. Removed those three test items using the Blocks mini-cart: the three
  cards returned without a page reload. The basket was restored to its original
  empty state; no order was created.
- Inspected desktop and 390/320-pixel storefront layouts. At 390 pixels the
  measured document width equaled the viewport width. Product cards stacked,
  names wrapped, prices and buttons remained readable.
- Expanded the disposable real-site HTTP checks from 12 to 21. Guest and
  authenticated sessions cover selected and cross-sell order, main-product
  exclusion, empty and exhausted baskets, unrelated pages/baskets, invalid
  signed page context, sold-out/draft/private products, missing cross-sells,
  unavailable/consent-blocked sample baskets and the exclusion preference.
  Sample calls left the real two-item fixture basket unchanged. Classic
  automatic placement and block-template manual placement markup were checked
  for the expected anchor, signed context and absence of duplicates.
  The disposable site ran WordPress 7.1.2, PHP 8.3 and WooCommerce 11.1.2.
- Existing regression tests cover stale responses, consent withdrawal, hidden
  pages, context expiry, product click conversion callbacks and safe product
  URLs. These are test evidence, not a live analytics report demonstration.
- Fixed two sample-tester details discovered in the walkthrough: single-product
  selection now uses **Change** instead of a meaningless reorder control;
  pending basket reads say **Checking…** instead of **Would not show**.
- Corrected the disposable product fixture's repeat settings: an explicit zero
  session maximum suppresses rendering; the fixture now omits that limit.
- Found and fixed a packaging blocker: Free included two Pro-only Vite configs,
  and `build.sh all` ignored the failed artifact gate because its Free build
  function ran on the left side of `&&`. Added the missing exclusions and made
  the build steps unconditional so shell failure handling remains active.
  A regression test reproduced the false-success exit before the fix and
  verifies a rejected artifact now stops before the ZIP command.

Screenshots: [mobile basket exclusion](release-mobile-basket-exclusion.png),
[restored desktop demo](release-desktop.png), and
[sample visit](release-sample-visit.png).

## Engineering verification

- Full JavaScript suite: 209 files, 3,753 tests passed with two workers.
- Full PHP suite: 2,540 tests, 15,321 assertions passed.
- Final sample-tester changes: 619 focused tests passed, including pending
  status assertions, sample behavior, editor and stylesheet contracts.
- Full Free/Pro build passed, followed by rebuilt Free/Pro admin assets after
  the sample polish. Existing admin bundle-size warnings remain; frontend
  loader budgets were not increased.
- Loader contract and commerce size check passed: commerce 2,968 bytes gzip;
  combined Elite loader plus commerce 29,971 bytes.
- TypeScript, ESLint, PHPStan and source contract passed before final packaging;
  final changed TypeScript/JavaScript files were rechecked.
- Free and Basic/Pro/Elite ZIPs built successfully; all four passed the artifact
  contract. These are local development candidates, not published releases.
- After the packaging fix, the release-guard and artifact-contract suites
  passed: 86 tests, 183 assertions. Shell syntax and final whitespace checks
  also passed. The 21 integration checks passed again in a fresh fixture.
- Final browser review confirmed the compact viewed-product selector, the
  **Checking… → Would show** transition and three sample cards. The local
  published campaign was not edited, and the test basket was restored.

## Before public release

- [ ] Agree that the first shipped scope is product links and click reporting,
  or finish the separately planned cart-addition and outcome work first.
- [ ] Have a few merchants create and test a campaign without coaching. Record
  confusing steps and fix recurring problems. No invitations have been sent.
- [ ] On a staging store, verify a real guest product click reaches the report
  and that preview/admin visits do not inflate it, including consent settings.
- [ ] Install the exact packaged candidate on staging; rehearse upgrade from
  the prior release, unpublishing and rollback. Keep the old package and backup.
- [ ] Complete the intended support matrix: declared WordPress/PHP/WooCommerce
  versions, classic and block themes, cache behavior, RTL, screen reader use,
  longer product names and larger catalogs. Third-party drawers, currencies
  and product-option extensions are unverified until tested explicitly.
- [ ] Review release notes, known limits and the setup guide, then approve the
  release and monitor the first installs.

## Merchant walkthrough

Use [the setup guide](../../guides/product-recommendations.md). Ask merchants to
pick a main product and useful extras, choose where they appear, test an extra
already in the basket, handle an unavailable extra, and explain what a result
means. Record completion without help, time, mistakes and questions. Do not
promise conversion gains from this small usability round.

## Later addition slice

The [addition verification record](../../testing/recommendation-additions-2026-10-05.md)
records the new local behavior and tests. Its release packaging is currently blocked
by stale renderer-bound setup/collection reviews. Re-review affected entries and
regenerate reviewed collection snapshots before building release ZIPs. Earlier ZIP
checks above belong to the product-link slice, not this later implementation.

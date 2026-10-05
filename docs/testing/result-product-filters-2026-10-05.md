# Category and attribute quiz results — local verification

5 October 2026. Implementation of recommendations plan slice 6. Not yet packaged or released. The earlier release candidate predates this feature and
product activity reporting.

## Verified

- Full PHP run: **2,558 tests / 15,727 assertions** passed. Final repository
  promotion checks passed **35 tests / 141 assertions**, including refusing an
  unmapped category result without replacing the existing published design.
- Full JavaScript run: **3,779 passed**, with one stylesheet role-scale failure.
  Replaced the literal font size with the shared role; all **660 affected tests**
  then passed, including both hand-picked and filtered lookup recovery, one quiz
  completion after Retry/back/forward, editor preview races and fallback states.
- TypeScript, focused ESLint, PHPStan, source contract and loader/combined feature budgets passed.
  Both local admin bundles and all paid loaders built. Free runtime unchanged.
- Actual WordPress **7.1.2 / PHP 8.3.33 / WooCommerce 11.1.2**:
  `check-result-filters.mjs` passed **8 grouped checks**: category descendants,
  stable ordering, stock/visibility/purchasability exclusions, attribute matching,
  AND intersections, empty matches, malformed/stale/cross-taxonomy values,
  bounded authenticated pickers, and deleted-term rejection.
- Transfer round-trip clears category, attribute and product references, preserves
  the filtered-source placeholder and refuses use until remapped. Basic supports
  the transferred feature; existing manual result selections remain intact.
- Local `wconvert.local` browser: opened the actual editor, saw Brewing resolve to
  brewer/filter, changed the value to Care and storage and saw brush/jar, then
  used Undo to restore Brewing. The filter panel measured 311px wide with no
  horizontal overflow; its selects use the existing 13px type role and 36px
  control height. No editor draft changes were left pending.
  The published inline visitor demo mounted correctly. Automated pointer
  interaction with its closed shadow root was unavailable in the browser tool;
  complete/retry behavior is covered by the mounted-runtime tests above.

## Local demo

Campaign **Demo · Coffee finder by category**:
`01M45PA77YJQWXDQ1QTMP97MH9`. Page:
`http://wconvert.local/wconvert-demo-coffee-finder/`.

Open **Your result → For your next brew → Recommend products**. The live preview
shows matching existing coffee demo products. The demo adds a global **Demo use**
attribute to those demo products. It is isolated to its own local page and leaves
the accessories campaigns and existing cart contents unchanged. Local preview
uses no product activity or quiz counters; visitor runs count normal demo activity.

## Remaining release work

Merchant walkthrough and pilot, PR review/CI, fresh package checks and the supported
version/theme matrix. No production uplift or third-party compatibility claim.
The product selection is a bounded oldest-ID candidate window, not a ranked or
exhaustive catalog search. Variable parents link to their product page; exact
variation combinations and direct quiz additions remain outside this slice.

Screenshot: [editor matches](../reviews/result-product-filters-2026-10-05/editor-matches.png).

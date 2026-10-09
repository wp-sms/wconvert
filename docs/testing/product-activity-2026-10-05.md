# Product activity verification

5 October 2026. Local implementation of recommendations plan slice 5; not a public
release. [Contract](../adr/0122-product-activity-uses-retained-anonymous-dimensions.md).
The earlier recommendation release-candidate ZIPs do not contain this slice.

## Completed

- Full PHP suite: **2,552 tests / 15,689 assertions** passed.
- Full JS suite with two workers: **213 files / 3,773 tests** passed.
- Final focused product collector/report checks: **9 tests** passed after UI copy
  and product-name grouping changes. Final table CSS was visually checked below.
- TypeScript, ESLint, PHPStan and source contract passed; both admin bundles built.
- Optional commerce bundle **5,292 bytes gzip**, against the explicit 5,400-byte
  budget. Main Elite loader remains **27,026 bytes**; other loader code unchanged.
- Real disposable WordPress **7.1.2 / PHP 8.3.33 / WooCommerce 11.1.2**:
  21 existing product recommendation checks, 14 addition checks and **7 new product
  activity checks** passed (42 grouped checks total).
- New integration checks prove actual SQL aggregation, valid served-card views and
  clicks, rejection of forged/cross-product/cross-campaign/oversized/foreign-origin
  and server-only assertions, authenticated reports, accepted-addition replay,
  isolation from journey totals, paused history and scoped expiration. A temporary
  fixture inserted expired product/screen/headline rows; cleanup removed only
  product dimensions and the fixture removed its remaining test rows afterward.
- Local `wconvert.local` demo served signed cards. Actual browser intersection
  observations appeared as one Shown each for the visible filter and brush. No
  historical counts were fabricated and the existing basket was not changed.
- Browser review of the real editor details report at the normal panel width and
  actual iframe viewports of **320px and 1280px**. Table client/scroll widths both
  204px at 320 and both 428px at 1280: no horizontal table overflow. Product names
  use the full width of narrow row cards. Shared table styles now also reach the
  editor's portaled details dialog.

Screenshots: [normal panel](../reviews/product-activity-2026-10-05/local-report.png),
[320px](../reviews/product-activity-2026-10-05/report-320.png),
[desktop](../reviews/product-activity-2026-10-05/report-desktop.png).
The browser viewport override did not resize the existing panel, so the actual
iframe document widths were measured rather than assuming the override worked.
The temporary wrapper file and tab were removed after review.

## Where to see it

Analytics → a recommendation campaign → Product activity. Analytics excludes
today. In the editor use Campaign actions → Campaign details to include today.
The first recorded day is shown; older campaign counters do not contain product
history. Anonymous product activity retains 90 days, independent of lifetime
campaign totals and campaign-level attributed sales.

## Next work

- Plan slice 6 is now implemented locally: category/attribute product-finder
  results. See [verification](result-product-filters-2026-10-05.md).
- Validate on a real merchant catalog and theme/extensions, with physical phones,
  assistive technology and catalog/load measurements. This responsive check does
  not prove those compatibility cases.
- Review/CI, then rebuild and revalidate release packages including this slice.
  The previous package/runtime matrix remains evidence for the previous candidate.
- Controlled pilot with sufficient traffic to measure basket impact; activity
  counts alone do not establish sales uplift or causation.

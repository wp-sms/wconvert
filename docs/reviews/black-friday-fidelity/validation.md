# Fidelity validation

This is the earlier renderer review. The later [actual WordPress review](../black-friday-wordpress/review.md) and [verification record](../black-friday-wordpress/validation.md) supersede its completion claims and contain the current fonts, responsive fixes and plugin captures.

- 50 unchanged approved prototype references compared with native first screens at 1440 and 390 viewport widths; all prepared screens captured at 320 and 1440.
- 3,648 measured cases: design and filled campaign, every screen, eight widths, LTR/RTL, ordinary and lengthened copy. Zero layout, contrast, input-size, touch-target or close-overlap findings (`layout-audit.json`).
- 800 default CTA checks across the same eight widths and both directions. Zero wrapped labels (`cta-audit.json`). Deliberately lengthened merchant labels may wrap.
- 672 signup-bar transition cases, ordinary/lengthened copy and both directions: zero composition failures (`announcement-audit.json`).
- 100 current WordPress journeys: 50 campaigns at 320 and 1280, zero failures or skips (`results.json`). The disposable real WordPress mounted the current Free and Pro plugins; forms reject invalid input, retain input after a simulated server failure, save a local Lead on retry and reach their acknowledgement. Configured buttons and copyable coupons are exercised.
- Capture conversion regression: 597 tests pass, covering email/phone conversion and round trips across the design library, including the two coupon-placement regressions discovered during this review.
- Source normalization: 301 designs survive registration unchanged.
- Shared-renderer visual comparison: 270 existing campaign decisions and 13 collections carried only after pixel-identical comparison of their unchanged content against d7688edf. The fifty changed campaigns received new reviews.

The review uses local preview fonts. Front-end font delivery still depends on site configuration; no external font service was enabled. It does not claim pixel identity, real customer delivery, conversion performance, physical-device testing or live campaign publication. Concrete native adaptations are recorded per design in `review.md`.

- Final `npm run preflight` passed all 17 stages: 3,864 PHP tests / 23,533 assertions, 5,423 JavaScript tests, 92 studio tests and 70 catalogue-service tests, plus contracts, PHPStan, TypeScript, ESLint, build, POT coverage, conversion acceptance and revision/approval gates. Vitest used two workers to avoid contention with local preview servers; no timeouts or assertions were relaxed.
- All 50 have current editorial approvals and recorded design revisions. The batch gate passes; 48 unrelated existing design-history changes remain outside this batch.
- The local-only catalogue release is `1135e183f7bfd304c45330ae2af0ae3e066c0b989e5cd930ddf790721879b30e`. Its 34 Free designs/setups and verified images were installed into `wconvert.local`; the active Pro plugin supplies the other 16. All 50 resolve to one current picker card and a matching setup. Older archive revisions remain available for existing saved campaigns.
- Local admin screenshots verify the installed Streetwear Poster and corrected Deadline Scoreboard. The narrow app panel scales the desktop preview down; full-size renderer comparisons are saved alongside these screenshots. No campaign was published and no hosted catalogue was uploaded.

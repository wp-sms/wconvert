# Flow editor follow-up verification

30 September 2026. Continues the [initial implementation review](../flow-editor-ux-2026-09-29/verification.md).
User requested implementation and validation, with Luna xhigh for simple testing.
Two Luna xhigh agents ran routine checks, prepared larger fixtures, and checked
three existing WordPress demo journeys. The parent reviewed their results and
performed the dense-map, RTL, zoom, and final code checks.

## Fixes found during validation

- Issue badges now include their visible issue count in their accessible name.
- Reopening Preview & test in retained Sample answers mode now focuses the dialog
  heading. Previously focus could remain on the trigger outside the modal.
  A regression test failed before the fix and passed after it; the real-browser
  retest also confirmed the heading was focused inside the dialog.
- Added reusable valid 12- and 20-screen graph fixtures, six routing/layout tests,
  and an unpublished disposable WordPress authoring-fixture route.

## Automated evidence

- Full baseline suite: **188 files / 3,457 tests passed**, plus typecheck and ESLint.
- The new larger-flow suite: **6 tests passed**. Covers readiness, capture boundaries,
  route question budgets, matching/fallback branches, stale-answer pruning, screen
  reorder invariance, card non-overlap and RTL mirroring. Longest fixture routes
  contain six and ten questions; no supported scale or route-limit change is implied.
- After accessibility fixes: **81 editor/group tests passed**. This overlaps the
  broad suite and should not be added to its count.
- After the GitHub runner block, local `npm run check:loader` passed every loader
  and phone size budget. `composer test` passed on PHP 8.5.8: **2,360 tests /
  14,125 assertions**. These local results do not replace the blocked CI matrix.
- Final typecheck, touched-code ESLint, Free/Pro admin builds, source contract and
  whitespace checks passed. Existing Vite large-chunk advisories remain.
- [PR #196](https://github.com/wp-sms/wconvert/pull/196) is open.
  [CI run 36673635060](https://github.com/wp-sms/wconvert/actions/runs/36673635060)
  could not start any jobs: GitHub reported failed account payments or a spending
  limit. Dependent PHP/frontend jobs were skipped. This is not passing CI; resolve
  the GitHub account issue and rerun before merge.

## Browser evidence

[The Luna smoke report](browser-smoke.md) records simple signup, optional quiz signup
(skip and submit), independent matching follow-ups, sample routes, and visited paths.
No existing campaign was saved or published, and all submissions were in Preview.
A tab open across an asset rebuild initially failed to import an obsolete lazy chunk;
one reload restored the map and the repeated operation passed.

Additional parent checks used a fresh local WordPress Playground on port 9417 with
an unpublished 20-screen draft. No real destination delivery was enabled.

| Check | Result |
| --- | --- |
| 20-screen Fit | All cards fit at 16% in the sampled 1512px viewport. This is an orientation view, not a promise that every title is readable at that scale. |
| Find last question | Search found Business question 9 (screen 18); Show selected returned it and the shared save screen to readable local focus (98–100%). |
| RTL | Actual document direction was RTL; entry and ending positions reversed, all 20 measured card rectangles had no overlaps, and search/selection worked. |
| Mixed-direction text | A long Arabic/English question wrapped in its card and remained editable in the inspector. Page width was 1512px and inspector scroll/client widths both 380px. Temporary edit was undone; Save draft disabled again. |
| Actual 200% Chrome zoom | Native Chrome reported 200%; CSS viewport changed from 1512 to 756px, DPR from 2 to 4. Editor used Map/Edit screen switching; page and inspector had no horizontal overflow. |
| Zoomed test dialog | Sample answers dialog scroll/client widths both 722px; Escape closed it and restored focus to Preview & test. |

Evidence: [selected dense screen](large-20-selected.jpg), [whole-map fit](large-20-fit.jpg),
[actual 200% zoom](browser-zoom-200.jpg), [RTL mixed question](rtl-mixed-question.jpg).
Browser zoom was reset to 100%, the disposable direction control returned to LTR,
and the QA tab was closed. Chrome logged one view-transition opt-in abort during
navigation through the harness direction page; no map rendering failure was observed.

## Remaining limits

Merchant task sessions, spoken VoiceOver testing, full translated-locale coverage,
and comparable before/after performance timings are still pending. The 12-screen
fixture has automated coverage; the parent live-browser stress sample was the
20-screen fixture. These checks support improved readability, repair navigation,
and testing continuity, not a claim that every user will finish tasks faster.

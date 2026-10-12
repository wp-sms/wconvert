# Full template library polish — 12 October 2026

Reviewed all 107 source designs and all 153 registered, filled campaign setups, including designs outside the curated studio batches. This review addresses the recurring mismatch between technically valid templates and polished, usable output. The branch remains unmerged.

## What changed

- Rebalanced form groups, consent placement, panel insets, split proportions and confirmation screens. Removed redundant decoration and duplicate confirmation copy where they weakened the hierarchy. Preserved distinct template palettes and compositions.
- Corrected string-valued split ratios that the renderer ignored. Reworked announcement layouts to accommodate their actual campaign copy and longer text.
- Made supporting copy at least 14px, retained 16px form inputs, and improved close-button contrast and clearance. The studio now renders the shipping close control, so this previously missing part of the preview is reviewed too.
- Added realistic input examples to the actual playbooks as well as their design sources. Prefill replaces source content, so reviewing a raw design alone did not catch these omissions.
- Made the service-enquiry repair branch explain the assessment process rather than repeat the opening question. Simplified callback acknowledgements.
- Fixed the real phone library's upward-opening country panel: filtering to one country previously left a large gap above the field. The panel now stays anchored to the input. Pointer-driven tests check the gap, selection and mobile full-screen selector.

## Visual evidence

Every screen and result was individually inspected at 320px and 1280px: 220 source-design states and 298 filled-campaign states, totalling 1,036 renderings. The 130 lossless contact sheets are in `screens/`; `screens/index.json` maps each row to its design/setup, screen and result. Desktop renderings are fitted onto the contact sheet; phone renderings retain their original width.

The final boards were split between the primary reviewer and the specification/standards reviewers. Filled-campaign boards 1–40 received specification review and 41–75 standards review. Earlier source-design review covered boards 1–28 and 29–55 respectively; changed boards and designs without a filled campaign were inspected again. Final reading-guide and repair-enquiry changes were also checked in native WordPress screenshots. Neither independent review reported a remaining blocker.

`audit.json` records the final source hashes and automated results. `evidence-manifest.json` binds the screenshots, board index and reports to their contents.

## Automated and practical checks

| Check | Observed result |
| --- | --- |
| All source designs and filled setups | 16,576 cases; zero flagged findings |
| Widths | 320, 390, 520, 640, 768, 960, 1280 and 1440px |
| Directions and copy | LTR and RTL; authored and expanded copy |
| Layout checks | Overflow, composition, text/field contrast, close collisions, control and input sizes |
| Studio visitor journeys | 153 passed, including simulated validation, failure/retry and completion |
| Native WordPress forms | 13 setups × two widths: 26 completed journeys with local Lead capture |
| Native commerce | Six setups at both widths; actual WooCommerce additions, empty-basket suppression and three coffee-finder results |
| PHP suite | 2,819 tests / 17,019 assertions passed; subsequent source-pin checks: 11 / 331 passed |
| JavaScript | Full run: 4,253 passed and two obsolete copy locators failed; both corrected and passed in an 80-test targeted rerun. Subsequent affected coverage: 83 tests plus six phone tests passed |
| Studio/export tests | 38 passed |
| Other checks | Typecheck, lint, source contract and relevant builds passed |

Native tests ran against disposable WordPress 6.8.3 / PHP 8.1 at localhost:9453, with local capture and fictional test data. They did not modify the user's `wconvert.local` site. The reports and final successful screenshots are stored alongside this document and under `native/`. The selected native journeys include newsletter, guide, workshop, class, repair, callback, VIP phone capture, optional SMS, consultation, fullscreen and the explicit repair branch of the service enquiry.

## Repeatable review, and its limits

Run `npm run templates:audit:library` with the local studio running (default localhost:9452; override `WCONVERT_STUDIO_URL`). The command rebuilds the output, audits the complete inventory with authored and expanded copy, and exercises every registered setup's default studio route. Audit findings cause a nonzero exit. Use `node tools/visual-tests/library-polish.mjs capture` to generate fresh boards, then inspect every screen; a passing geometry check does not establish design quality. The guidelines now require both.

The studio journey runner follows one default route per setup, not every possible graph branch. Every result layout was visually checked, and selected branches were exercised natively. Native WordPress verification covers the 13 form setups and six commerce setups named in the reports; it is not a claim that every registered setup has received a complete configured-site review. Existing editorial approvals remain revision-bound and have not been bulk-renewed from this visual audit. Remaining stale approvals require the appropriate visitor-route and configured-site evidence before publication.

No physical-device testing, external email/SMS delivery or measured conversion claim is made. CI was not used. Hosted R2 deployment and licence integration remain deferred; this change neither publishes a hosted catalogue nor bypasses its approval gate.

# PR #190 merge readiness

Reviewed 28 September 2026 against freshly fetched `origin/main`. Main has no
commits missing from this feature branch. This pass reviews the full feature
scope, with code inspection concentrated on compatibility, routing, publication,
capture, deletion, template validation and Free/Pro boundaries. It is a developer
review, not an independent reviewer approval or an exhaustive usability study.

## Recommendation

Ready for review and merge into main after the checks below. No known blocking
finding remains from this pass. Merge is still a separate owner decision; no merge
or release was performed. The repository's release workflows run on a published
GitHub Release, so merging main does not itself publish a plugin release.

## Review and repair

- Legacy ordered journeys retain their evaluator. Explicit graph upgrades create
  stable screen/edge references; storage order and map coordinates do not route
  visitors. Rule priority, hidden exits and save boundaries were checked against
  the PHP and JavaScript validators/evaluators and their regression coverage.
- Publication checks protect required saves/results, reject unreachable screens,
  loops and invalid question dependencies, and retain incomplete work as drafts.
  Optional-signup deletion removes owned data definitions while preserving other
  submissions; campaign editing prunes obsolete destination bindings together.
- Capture validates against the published route and freezes reached questions at
  the accepted-save boundary. CSV/privacy exports retain readable question data;
  destination delivery uses the accepted submission snapshot.
- Found and fixed a malformed-POST case: nested answer arrays could reach condition
  comparisons before validation and emit an array-to-string warning. A regression
  test reproduced the warning; answer shapes are now checked before route
  evaluation. The narrower per-question check still rejects arrays for single
  choice and text questions.
- Inspected tier registration, premium fallbacks, renderer mounting, editor draft
  and Undo behavior, result selection, and deletion/insertion safeguards. Build,
  source and artifact contracts supplement this risk-focused review.

## Template JSON compatibility

All **60 bundled designs** were inspected: 41 Free library entries, 16 Pro display
designs and 3 Pro journey designs. Every JSON file parses and survives registration
and journey validation. No bundled JSON change is required.

All shipped trees remain version 2. They do not need a forced conversion simply
because the editor supports version 3. Added 61 regression checks (catalog coverage
plus one per design) for explicit upgrades, JSON round-trip and reversed storage
order: visited screen IDs, retained answers, selected results, submission ownership
and reached-question prefixes remain consistent. For the small shipped question
examples these checks enumerate answer combinations, including blank answers and
multi-selection subsets. This checks behavior preservation; it does not claim
every design is ready to publish without merchant configuration.

Template packs continue to use the existing version-2 import contract. This pass
does not add import support for arbitrary version-3 graph packs. Product finder
still requires the merchant's products/links where specified; URLs, consent,
destinations and other site-specific settings remain publication checks.

## Local verification

- Full JavaScript suite: **177 files, 3,192 tests passed**, one worker.
- Added template upgrade/round-trip coverage: **61 tests passed** separately after
  the full suite started. No production JavaScript changed in this pass.
- Full PHP suite after the malformed-answer repair: **2,136 tests, 11,513
  assertions passed**. The subsequent redundant-check cleanup was checked with
  the capture regression tests and PHPStan.
- Full TypeScript and ESLint passed; the added template test also passed both.
- PHPStan passed over 459 files. Source, template, loader and phone contracts passed.
- Rebuilt all bundles and Free/Basic/Pro/Elite ZIPs; each artifact contract passed.
  ZIPs were rebuilt after the final PHP repair. Existing admin chunk-size advisories
  remain; loader/phone size budgets pass.
- [Release browser smoke](2026-09-28-release-browser-smoke.md): created a campaign
  from the actual service-enquiry template; edited, saved, reopened and reloaded;
  verified both conditional paths and a simulated accepted enquiry. Reopened two
  saved graph QA drafts and an untouched legacy newsletter. Edit and Flow agree.
- [Previous persistence checks](2026-09-28-persistence-browser-checks.md) cover
  follow-up order/deletion, destination selection, result rules, Back pruning,
  optional signup skip and pending-review return/focus.

## Explicit limits

GitHub CI remains waived and VoiceOver deferred by the owner. Local PHP execution
used 8.5.8, not a fresh runtime-version matrix. Browser visitor submissions were
simulated; no campaign was published and no real delivery was sent. Before broad
release, perform staging publication/delivery checks and successful WooCommerce
catalog selection, and run occasional-merchant usability sessions. These are
release follow-ups, not evidence of a current failing merge check.

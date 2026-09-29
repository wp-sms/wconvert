# Implementation slices and verification

The core implementation is present in source. The plan's end-to-end and release
qualification work remains open; see [the audit](../../reviews/ad-blocking-audit.md)
and [the contract](contract.md).

## Implementation evidence (2026-09-29)

- Baseline Free/Basic/Pro/Elite loader sizes: 14,011 / 24,524 / 25,496 /
  25,761 bytes gzip-9. Implemented sizes: 14,107 / 24,611 / 26,146 /
  26,426 bytes. The measured caps are 14,336 / 24,832 / 26,368 /
  26,624 bytes; all four pass `npm run check:loader` and `check-phone`.
- The complete JavaScript suite passed 3,409 tests in 181 files with two
  workers. `composer test` passed 2,330 tests and 13,893 assertions.
  TypeScript, ESLint, PHPStan, source contract, full bundle build, and loader
  checks passed.
- The staged Free, Basic, Pro, and Elite packages passed the artifact contract,
  including the check that lower tiers carry no Pro detector identifier.
- The inspector now waits briefly before reporting unobserved loader execution,
  offers a manual recheck, and treats a missing loader tag as ambiguous rather
  than proof that an optimizer aggregated it.
- WordPress Playground with PHP 8.1 loaded both plugins and passed the five
  `bin/verify-loader-replacement.php` checks. A real REST dispatch of the
  inspector's empty beacon batch returned 204 and left the stats table at zero
  rows.
- A standalone build of the actual probe was exercised in Chromium, Firefox,
  and WebKit. Each yielded `not_detected` on a clean page and `detected` when
  `.adsbox` was hidden with `display:none!important`. These synthetic tests
  establish browser geometry behavior, not extension detection rates.
- Live extension/filter-list, DNS-only, optimizer, and complete-loader-block
  comparisons remain untested. No delivery alias is justified yet. Those are
  release qualification cases, not claims made by this implementation.

## Slice 1 — reproducible baseline

Build the existing Free/Basic/Pro/Elite bundles and record current gzip sizes.
Use a real WordPress test instance using the repository README's Local or
Playground workflow. Use a disposable site/profile with inert destinations and
test contact details. Do not generate fake Leads on the merchant's real site.

Create representative fixtures: popup, inline, Pro bar/slide-in, a capture
journey, and a click-through offer. Exercise display, capture and impression/
click reporting separately. Use server counter deltas/Lead records to verify
receipt; browser request success alone is insufficient.

Record browser/OS, extension version, enabled lists and their update time,
default/custom settings, exact URL and relevant filter rule, asset and REST
requests, console errors, visible result and server result. Store the sanitized
evidence in `docs/reviews/ad-blocking-baseline.md` when tests actually run.

Minimum matrix:

| Environment | Configurations |
| --- | --- |
| Chrome | Clean; supported current AdBlock Plus or uBlock Origin Lite configuration |
| Firefox | Clean; uBlock Origin default; extra annoyance filters |
| Brave | Shields default; stricter configuration |
| Safari macOS/iOS | Clean; available content blocker with configuration recorded |
| Network-only blocking | DNS blocker, with no extension; record known detector blind spot |
| WordPress optimizers | Unoptimized; supported defer/delay/aggregate configuration; warm page cache |
| Browser failures | Offline, slow response, CSP denial, unavailable storage, background/prerender |

Use currently available extensions for each browser; do not assume desktop
Chrome can run Firefox's extension build. Report untested environments as
untested, never passed. Signed-out pages are essential; admin inspection alone
does not prove the visitor path.

Exit: reproducible baseline and an explicit decision whether any path alias is
needed. Failure to identify a blocking filter is not evidence to build bypasses.

## Slice 2 — Free reliability and diagnostics

Likely existing files:

- `resources/loader/src/beacon.ts`, `boot.ts`, `inspect/arrival.ts`,
  `inspect/run.ts`, `inspect/report.ts`, `inspect/panel.ts`.
- `src/Frontend/InspectorEnqueue.php`, `InspectorTag.php`, `InspectorLabels.php`.
- `tests/js/loader-beacon.test.ts`, `inspector-funnel.test.ts`,
  `inspector-panel.test.ts`, relevant PHP inspector/beacon tests.

Implement transport behavior and minimal boot milestones from the contract.
Make arrival diagnostics update as milestones become available; the current
one-time arrival snapshot is not enough for delayed loaders. Use bounded checks
or a tiny milestone notification with a retained state for late listeners, not
continuous polling. After a bounded wait say “not observed yet,” with a manual
recheck for deliberately delayed JS. A no-matching-Campaign page is normal and
does not produce a warning.

Add the explicit empty-batch analytics connection check and translated result
copy. Separate request status from campaign eligibility and from actual capture.
Verify PHP permissions, anonymous query-parameter behavior and no-cache headers.

Exit: a blocked loader, an optimizer-moved loader and a failed analytics endpoint
produce distinguishable evidence without affecting Campaign decisions or form
submission. Free gains no paid rule identifier or detector code.

## Slice 3 — Pro rule, detector and authoring as one complete feature

Proposed new files:

- `pro/modules/premium-triggers/loader/ad-blocking.ts`: evaluator adapter.
- `pro/modules/premium-triggers/loader/ad-block-probe.ts`: bounded DOM probe.
- `pro/tests/js/ad-blocking.test.ts`: status, lifecycle and rule coverage.

Wire through:

- `resources/rules/manifest.json`, `src/Rules/RuleLabels.php`,
  `src/Rules/DisplayPlan.php`, and any manifest control/type declarations.
- `pro/modules/premium-triggers/loader/index.ts` and `module.json`;
  existing tier composition should inherit the module without a new tier entry.
- `resources/admin/src/builder/controls.tsx` and `builder/rules/` authoring,
  help, summary, validation and sample-visit components.
- `resources/loader/src/types.ts` only for a minimal generic diagnostic seam,
  and inspector explanation/panel code for non-boolean measurement reasons.
- Free/Pro manifest, label, module and artifact parity tests.

Do not ship an authorable rule before its evaluator and validation are present.
The same delivery slice must support draft save, reload, Undo/Redo, publish,
published payload, live behavior, summary and diagnostics.

Use a semantic single-select for the two statuses. If no reusable enum control
exists, add one small manifest-driven control with allowed-value validation in
both runtimes; do not special-case an unchecked free-text value in PHP.

The sample tester uses the shared matcher and one hypothetical detection fact.
The real-page inspector uses its own actual evaluator, displays pending/unknown
reasons and does not invent a second definition of audience matching.

Exit: complete merchant flow works on real WordPress with clean and blocked
profiles; unknown never becomes “not detected”; all tier and byte gates pass.

## Slice 4 — release qualification and documentation

Repeat the baseline matrix on the implementation and record deltas. Add explicit
cosmetic-hiding and complete-loader-block tests. Check reader-facing copy,
keyboard operation, focus, translated strings and narrow editor widths.

Update `CONTEXT.md` with the bounded observation, its storage behavior and its
Condition classification. Add an ADR when implementing the accepted contract,
and amend relevant passages of ADR 0048 (minimal boot observation) and ADR 0104
(condition diagnostics and authoring) in the same commit. Update privacy/data
documentation only with actual data flows; no new privacy setting is proposed.

Publish a support procedure covering missing loader, failed request, unknown
detector result, whole-plugin blocking, delayed JavaScript and false positives.
Do not promise the inspector is equivalent to a logged-out visit or that an
empty-batch response proves real events were accepted.

Exit: evidence attached, unsupported cases explicit, all required checks green.
Follow the repository's branch/PR workflow for implementation; no direct main
push. This planning request itself does not publish a release.

## Required acceptance cases

| Area | Cases and expected outcome |
| --- | --- |
| No rule | No detector DOM nodes, timers, storage calls or requests. Ordinary Campaign behavior unchanged. |
| Clean probe | Valid unaffected samples yield not detected; only that authored status matches. |
| Hidden bait | Stable selective hiding yields detected; control remains measurable. |
| Bad measurement | Hidden/removed control, inconsistent samples, exceptions, missing body or interrupted visibility yield unknown; neither status matches. |
| Lifecycle | Multiple Campaigns share one evaluator; cleanup on settle/stop; no callback after stop; inspector probe can coexist; no new probe on completed bfcache restore. |
| Audience logic | ALL/ANY and OR branches preserve existing semantics; missing Pro module suspends the entire Campaign; unknown measurement does not suspend independent branches. |
| Timing | Settling detection may release achieved thresholds; never replays an earlier click/exit/scroll-up; fresh later gesture still works. |
| Availability | Free/Basic do not execute or ship detector implementation; Pro/Elite do; paid absence cannot widen audience. |
| Save/publish | Blank draft repair, enum validation, impossible ALL combination, stable row IDs, Undo/Redo, reload, published round-trip. |
| Simulation | One coherent hypothetical status; no actual probe, network, storage or events. |
| Inspector | Tag present but loader blocked; tag replaced by optimizer; delayed start; missing/malformed payload; no eligible Campaign; anonymous inspector URL; probe 204/429/403/404/5xx/offline/CSP/timeout. |
| Beacon | API absent/false/throw uses one fallback; true uses none; fetch failure stays isolated; hidden+pagehide do not duplicate; prerender is held; stop removes listeners. |
| Capture | Analytics failure does not prevent accepted capture, success UI or server capture count; capture failure is not attributed to a blocker without evidence. |
| Stats integrity | Empty diagnostic batch adds no counters/Lead; partial blocking can lose impressions without inventing a corrected denominator. |
| Presentation | Targeted popup/inline/paid overlay, collision priority, dismissal, pacing, schedule, A/B family and Reopen still follow existing behavior. |
| Privacy | No persistent result or identity; no form values in diagnostic markers; no external probe requests; no consent-status inference from blocking. |

Use DOM tests for deterministic classifier/lifecycle cases, and actual browser
tests for computed layout and extension behavior. A jsdom geometry mock is not
evidence that an extension detects or hides the real bait.

## Validation commands and evidence

During implementation, run the focused Vitest/PHPUnit cases for each changed
seam, then the repository checks relevant to the final change:

```sh
npm test
npm run typecheck
npm run lint
npm run check:loader
npm run build:inspector
npm run build:inspector:pro
composer test
composer phpstan
composer verify:source
```

Build the changed admin bundles and staged Free/paid artifacts using the
repository's existing build procedure; verify the artifact contracts and real
WordPress boot. CI's required aggregate check remains the merge gate. Capture
baseline/final gzip bytes for every tier, detector time/node/request counts,
browser matrix outcomes and known limitations. Do not relax gates to fit code.

The plan files alone need link/whitespace review, not application tests.

## Conditional follow-up — delivery compatibility mode

Only open this work after a reproduced filter blocks WConvert's real delivery
path and a tested alternative improves the intended functional experience.

First distinguish script blocking, cosmetic host hiding, capture-route blocking
and analytics-only blocking: renaming one path will not fix all four. Prefer a
stable configurable asset path over rotating random names on every request;
preserve ordinary cache/version behavior. Do not silently route around a
visitor's explicit analytics choice.

A separate design must specify asset generation/location, CDN and page-cache
invalidation, Free/Pro replacement, multisite/subdirectory URLs, upgrade and
uninstall cleanup, endpoint mapping and rate limits. In particular, existing
session pacing derives site scope from the capture endpoint path: renaming that
route without a stable scope would reset limits. Inspect all endpoint-derived
state before proposing aliases. No alias can promise universal unblockability.

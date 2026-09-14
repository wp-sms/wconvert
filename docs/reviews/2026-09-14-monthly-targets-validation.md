# Monthly Analytics targets — production validation

Approved direction: D combines soft progress panels with every saved target
visible together, after actual impact and before Goal detail. Behavior contract:
[ADR 0090](../adr/0090-monthly-targets-are-optional-benchmarks.md).

## Local verification

- PHPUnit: 1,900 tests, 9,138 assertions pass on local PHP 8.5.8.
- Vitest: 99 files, 2,354 tests pass; focused Analytics/target suite: 30 tests.
- PHPStan (configured PHP 8.1 floor), TypeScript, ESLint: pass.
- Source contract, loader tier isolation and gzip budgets: pass.
- Free and Pro production admin builds: pass.
- Real WordPress: authenticated GET `/monthly-targets` returns 200 with the
  site month and cutoff. Anonymous GET and POST both return 401.

Tests-first guards include complete month/leap-day boundaries, zero-day month
handling, validation and stale-month refusal, failed option writes, history and
uninstall coverage, cancel/reuse/removal, failed read/save retention, late-read
protection, and month-preserving report/editor links.

This is local verification, not a claim to have executed the hosted PHP-version
matrix. Existing unrelated React test warnings and loader named/default-export
warnings remain non-failing.

## WordPress browser verification

Luna checked the production page while authenticated as the local administrator:

- Impact cards → compact no-target row → Results by goal.
- Save Leads target 100, reload and confirm persistence.
- Edit to 50, Cancel and confirm 100 remains.
- Clear, Save and reload to confirm optional empty state.
- Metric explanations and dialog input focus.
- Last 7 complete days: September 7–13; last 30: August 15–September 13.
  Monthly target scope stays September 1–30, counted through September 13.
- Target results and campaign/variant links retain `month=2026-09`.
- At 390×844, scroll/client width are both 390px with no observed overlap.
- No visible timezone label.

No campaign publication, pause, deletion, winner or visitor/counter mutation was
used for this QA. The target option did not exist before testing. After clearing
through the UI, its exact value was `{"2026-09":[]}`; guarded cleanup removes
only that test-created empty value to restore the original absent option.

The throwaway A/B/C/D preview was moved outside the plugin to
`/tmp/wconvert-analytics-prototype.torMz3/analytics-prototype`; no switcher or
sample API is included in the production commit. This is a temporary local
archive, not a durable artifact or a running preview promise.

## Independent reviews

Standards: no actionable findings against the repository rules or smell baseline.

Spec: one first-day edge case identified and corrected in `e76ccec`: an empty
monthly report's date anchors must not link to today's in-progress captures.
The action is now disabled along with CSV export, covered by regression, and
independently rechecked as closed. No remaining spec findings.

## Hosted check limitation

[PR 161](https://github.com/navidkashani/wconvert/pull/161) contains the feature.
[CI run 34875754590](https://github.com/navidkashani/wconvert/actions/runs/34875754590)
did not start its jobs: GitHub reports an account payment/spending-limit blocker.
The merchant explicitly instructed proceeding with local verification. No
billing, workflow, permissions or branch-protection settings were changed.

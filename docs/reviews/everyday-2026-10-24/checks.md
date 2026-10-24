# Everyday implementation checks

The native handoff is checked against the approved prototype before catalogue packaging. All 50 trees match, allowing only the production configuration adaptations documented in review.md.

- 251 total native designs survive registration.
- 3,828 PHP tests / 22,889 assertions pass.
- 5,291 JavaScript tests pass; 938 converted drafts pass the PHP verifier.
- 92 template-studio tests and 70 template-server tests pass.
- Source, loader and admin contracts, PHPStan, TypeScript, ESLint, production builds and POT coverage pass.
- Catalogue revisions and all existing/new approvals are current.
- All 100 desktop/mobile WordPress journeys pass, with no skipped cases.
- All 20 saved-deadline countdown cases pass.
- All 5,632 responsive cases pass: 88 screens, eight widths, LTR/RTL, normal/longer copy, source and prepared trees.
- All 50 designs and matching setups are in the local release. The public catalogue exposes all 50 collection members and tiers: 35 Pro, 15 Free, no new bundled Free entries. See release.json.

An initial preflight run hit editor test timeouts while browser audits ran concurrently. A complete JavaScript rerun passed with two workers and unchanged test timeouts. No tests were skipped or relaxed. The remaining preflight steps also passed independently. A final complete preflight run then passed all 17 steps (exit 0), using `VITEST_MAX_FORKS=2 VITEST_MIN_FORKS=1 VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1 npm run preflight`. No repository test-concurrency configuration was changed.

No live template-server deployment or merge has been performed. The local catalogue release was validated by the shipping PHP catalogue reader. The MySQL CI job and full CI visual suites still run in GitHub when the PR is ready; this local evidence does not claim those remote jobs have passed.

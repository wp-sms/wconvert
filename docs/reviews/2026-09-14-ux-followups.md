# Campaign setup UX follow-ups

Implemented in the existing Goal outcome-contract branch; see ADR 0086 and the
[11-tab before/after report](goal-outcome-before-after.html).

## Delivered

- Task-based names across the 21 bundled campaign setups and a derived setup checklist.
- Audience-service default for email/SMS; explicit Collect only and forwarding suppression.
- Format browsing, with atomic design/format Apply and one-step Undo.
- Campaign / Campaign setup labels, with Display rule sets for the smaller rule bundles.
- Offer-or-content Goal copy and Link clicks measurement.
- Prepared [first-time-user test](first-time-user-test.md), not executed sessions.
- Local research app and tabbed HTML status updates, separate from historical market evidence.
- Curated pack definitions bumped to 1.2.0 with reviewed source fingerprints; existing installed
  packs and saved merchant copy are not rewritten. No database changes.

## Verification

- Full PHP: 1,886 tests; full frontend: 2,339 tests. Focused checks rerun after final changes.
- TypeScript, ESLint, PHPStan, all build targets, 50-design validation, source and loader contracts.
- Real WordPress REST: missing audience service blocks list publication; explicit local collection
  succeeds; Goal remains fixed after unpublish; missing lead-magnet delivery setup is refused.
  Temporary writes were rolled back; no messages or retained customer submissions.
- Browser: new Goal/setup labels, actual inline checklist, format browsing, cancel without a
  draft edit, and the connected-service default in the existing editor. No user draft saved.
- HTML: 11 report tabs toggle correctly and local links resolve. The original research HTML has
  six matched tabs/panels including the new status section. Research app production build passes.

## Not claimed

No real participant sessions, end-to-end mail delivery, confirmed subscriptions, booked work,
attributed revenue, complete device/accessibility matrix, production release or research redeploy.
GitHub Actions jobs are blocked before execution by account payments/spending-limit settings.
Resolve that account issue and obtain green required checks before merge. Recruit participants
and a disposable test-site owner for the next usability round.

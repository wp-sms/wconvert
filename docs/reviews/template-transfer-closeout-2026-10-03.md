# Template transfer review follow-up

Reviewed PR #200 against `ea08c344b93c2507f6c72b2a2438976f20cfb63b` in
independent standards and specification passes.

## Standards review

- Fixed: replacing an import could lose its future cleanup because WordPress
  deduplicates identical single cron events within ten minutes. Replace the old
  deadline. Verified with actual multipart upload and WordPress cron: a seeded
  deadline at now + 1760 seconds becomes now + 1860 seconds after replacement.
- Fixed: link editing now uses the shared Input with an explicit label binding.
- No additional actionable archive/authentication/local-path/locking findings
  were reported by this pass.

## Specification review

- Fixed: Keep current content passed through an older content binder that could
  turn a version-3 graph journey into version 2. Preserve the imported graph and
  remap its internal references with the rest of the design. The regression test
  failed before the fix and passes afterward.
- Fixed: validate the complete candidate after content matching, privacy
  preparation and link changes, and again before media creation. A malformed
  transformed graph is refused. Image URLs have their separate policy checks.
- No material scope creep was identified.

## Verification

- PHPUnit: 2,485 tests / 15,114 assertions pass. PHPStan, TypeScript, ESLint,
  production builds and source contract pass.
- Original 26 frontend failures resolved. The full run passed 3,596 tests and
  timed out in two unrelated suites under concurrent local load. Those two
  suites plus transfer tests passed when rerun serially: 148 tests. CI remains
  the merge gate for a clean complete run.
- Node 22 gzip checks pass without increasing budgets: Free 14,583 B, Basic
  25,057 B, Pro 26,581 B, Elite 26,812 B. Phone and combined ceilings pass too.
- Native WordPress 6.8.3 / PHP 8.1 single-site and multisite checks cover denied
  permissions, restricted MIME types, exhausted quota, failure on the second
  sideload, unwritable progress checkpoint, rollback, successful retry,
  idempotence, unchanged campaign persistence, and staging cancellation.
  The reusable guarded harness is `bin/verify-template-transfer.php`; invoke it
  only in a disposable WordPress after defining `WCONVERT_VERIFY_TRANSFER=true`.
  It creates test campaign/media records and deliberately leaves successful
  imports for inspection.
- Verified current fullscreen creation controls in the native browser and
  updated the stale visual-test selectors. Existing geometry assertions remain.

An abrupt PHP process exit between attachment insertion and checkpoint can
leave an unused attachment. Handling that would require the deferred orphan
collector; this remains explicit in ADR 0113. No schema or dependency was added.

Merge only after the exact PR head's **CI / Required checks** succeeds.

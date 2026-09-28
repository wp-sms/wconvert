# Merchant workflow stabilization

Follow-up to the merchant scenario plan and implementation, 28 September 2026.
Scope: review and push the existing feature branch without merging; persistence;
harder journey scenarios; contextual testing and return from dependent-rule edits.

## Additional changes

- Test this change retains the affected screen name and offers suggested checks
  derived from its actual visibility conditions, answer paths, choices, results
  and optional signup. Deleted screens receive a removal/continuation check.
  Tests still start at the real entry with no answers preselected. Suggestions
  explicitly do not prove reachability or winning priority.
- Opening a referenced rule preserves the pending answer review. Returning
  restores the choice, replacement, retirement disclosure or answer-type review,
  without reverting edits to the dependent rule. The review recalculates remaining
  dependencies and explains when none remain.
- Browser verification exposed a focus timing race: focus could fall onto the
  question before the restored review rendered. Restoration now occurs before
  paint, so the pending review exists when focus is moved.

## Verification

Browser walkthroughs ran on Sol at xhigh, as requested, using dedicated copies of
Demo 04 (home/business enquiry) and Demo 05 (coffee recommendation). See
[browser evidence](2026-09-28-persistence-browser-checks.md) for saved campaign IDs,
scenarios, screenshots and limits. Original demos remain unchanged.

Automated coverage includes follow-up order for every three-interest combination,
custom ordering and external entries, shared screens and protected capture,
first-match branches, hidden continuation, capture ownership and optional skip.
The graph/rules/capture regression selection passed 58 tests in 11 files.

New regression checks cover suggestions derived from real rules and deleted
screens, plus returning to a pending review after actually changing the referenced
branch condition. The return test checks the retained rule edit, replacement,
expanded retirement disclosure and keyboard focus.

The final merchant editing, editor, visitor-test and guidance selection passed
83 tests in four files. Browser rechecking confirmed the repaired focus return,
including after an actual branch condition edit.

Free and Pro admin bundles rebuilt locally. TypeScript, targeted ESLint and diff
whitespace checks were run. The bundles retain the existing large-chunk advisory.
No dependency was added, storage migration introduced, campaign published or
real visitor submission sent. GitHub CI and VoiceOver remain excluded by request.

These are developer verification results, not a claim that merchant usability or
real external delivery has been validated. PR #190 remains unmerged.

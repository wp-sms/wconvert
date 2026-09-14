# Analytics validation — 14 September 2026

Scope: PR #160, compared with main at `5613394e0de95717c656692c284fdc6a1b63df6e`.
Browser validation uses GPT-5.6 Luna with extra-high reasoning, as requested.

## Standards

One finding: **[P3] missing inline amendments in ADR 0068.** It still described
daily bars, expandable breakdowns, a delivery-gap display and milestones after
reports, while ADR 0089 replaced that presentation. The repository requires
bilateral inline amendments. Fixed by amending 0068 and naming it from 0089.
No other actionable standards violation was identified.

## Spec

One finding: **[P1] successive child winners omitted older retired arms.**
The specification requires complete, inspectable family history. Selecting B
over A and then C over B leaves A under B under C. The report originally read
only direct children, so A remained in Goal totals but disappeared from family
contributions, comparisons and CSV. A focused check reproduced 60 Goal results
versus 50 family results.

Fixed by collecting every descendant once, using the existing parent links.
The UI regression first failed on the missing earliest design, then passed
alongside assertions for complete family totals and CSV. No storage or
publication behavior changed. No separate missing requirement or scope creep
was identified.

Review summary: Standards — 1 documentation finding, fixed; Spec — 1 historical
reporting defect, fixed. Both independent reviewers rechecked and confirmed
their fixes. No outstanding finding from either axis.

## Local automated checks

- PHPUnit: 1,890 tests, 9,072 assertions passed.
- Vitest: 2,344 tests in 98 files passed, with two workers.
- TypeScript, ESLint and PHPStan passed.
- Free source contract and all loader tier budgets/contracts passed.
- Free and Pro admin builds passed.

This is local verification, not a claim that GitHub's PHP-version matrix ran.

## Browser evidence

- Overview, impact and individual historical-report navigation passed.
- 7/30-day complete periods and comparison toggling passed.
- Exported report CSV matched visible totals: 3 results and 14 appearances.
- Disposable campaign and variant creation passed; never-published draft
  variant was excluded from Analytics as specified.
- Pause and resume passed through the Analytics confirmations. Status refreshed
  correctly, history stayed visible, and resume explained publication of the
  latest saved draft. The disposable campaign was paused again afterward.
- The two paused designs appeared in the family comparison. The winner dialog
  explained retirement, retained history, lack of statistical proof and that a
  paused selection stays paused. The browser check cancelled this dialog.
- Two successive winner selections through authenticated WordPress REST
  requests each returned 204. Selecting B over A and then C over B produced
  the real three-generation history covered by the regression test. These
  requests, not a final browser confirmation click, exercised the writes.

- After both winner selections, Luna verified all three distinct designs in
  the root comparison. Both historical reports remained reachable and exposed
  no mutation controls; the current design remained paused.
- Cleanup verified all three disposable campaigns unpublished and soft-deleted
  through the existing repository. Historical rows remain inspectable; nothing
  was hard-deleted. Existing user campaigns were not mutated.

## GitHub CI exception

The original CI attempt and one rerun were refused before jobs started because
of the account billing/spending limit. The user explicitly instructed proceeding
without GitHub CI after being informed of this limitation. Merge relies on the
local checks above and the recorded review; CI is not represented as green.
No billing, spending limit, workflow or branch-protection setting was changed.

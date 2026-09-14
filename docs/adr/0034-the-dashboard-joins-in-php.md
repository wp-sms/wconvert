# The dashboard joins in PHP, not in SQL

[#28](https://github.com/navidkashani/wconvert/issues/28) draws the analytics
screen, and it needs `wconvert_stats` interpreted through `wconvert_optins`
([ADR 0020](0020-conversions-are-interpreted-at-read.md)). **It reads the two
tables with two statements and joins them in PHP.** There is no `JOIN`, there
is no third widening of [`Connection`](../../src/Database/Connection.php), and
`wconvert_stats` still ships no secondary index.

**Amended by [0089](0089-analytics-starts-with-impact-and-keeps-history-inspectable.md):** single-window reads remain two
statements. Analytics comparisons use one interpretation read and two counter
reads, sharing the same metadata rather than repeating it per window.

## The signature question came before the query

`Connection::results()` takes **one** table and a `literal-string` with one
`%i`. A two-table join needs two, so the obvious first move is to widen the
interface — for the third time.

That interface deliberately offers no raw `query()`, and its own docblock says
what to do here: it was widened for `delete()` (the eraser and the retention
prune, [ADR 0018](0018-erasure-deletes-rather-than-anonymises.md)) and for
`upsert()` (the atomic counter,
[ADR 0019](0019-analytics-stores-daily-counters-not-events.md)), and *"two
widenings on the same pattern is a pattern; the third one should be read as
pressure to stop rather than as precedent."*

So the question asked first was what the `JOIN` actually buys. The answer is
nothing.

## The join denormalises tens of rows onto thousands

A [[Goal]] is a fact about an [[Optin]], and an install has tens of Optins. A
counter is a fact about one Optin on one day, and the window the screen reads
holds thousands of them.

`JOIN wconvert_optins ON …` attaches the Goal to **every counter row** so that
PHP can read it off each one. Read separately, the same fact is fetched once
per Optin and looked up in an array.

The join cannot pre-aggregate the difference away, either. Both the per-Goal
series and the per-Optin numbers need the **day** axis, so the rows crossing
the wire are the same rows with or without it — the `JOIN` only makes each of
them wider.

## And the interpretation would end up in two places

`Goal::headlineKind()` is PHP. Which kind counts as a Goal's headline is
declared on the enum, so a `GROUP BY o.goal` still hands PHP a bucket per
`(goal, kind)` and PHP still picks the headline out of it. The SQL would take
over half of one decision and leave the other half where it was —
[`GoalReport`](../../src/Goal/GoalReport.php) already holds the whole of it,
pure and provable without a database.

## Table-free alternatives to the index, rejected

`wconvert_stats` is keyed `(optin_id, stat_date, kind)` with `optin_id`
leftmost, so *"every Optin over a date range"* cannot use that key as a range
and is a scan.

- **`idx_stat_date`.** Paid on **every beacon** — the plugin's highest-volume
  write — to save one admin screen a read it takes on demand. That is the same
  asymmetry [ADR 0033](0033-the-lead-log-reads-without-a-new-index.md) decided
  the other way round for the lead log, and it decides the same way here.
  `tests/unit/Database/SchemaTest.php` still budgets this table **zero**.
- **An `optin_id IN (…)` list**, which would use the key as a prefix range per
  id. Two problems, and the second is fatal: the set is *every* Optin, so it
  filters nothing out; and a variable-length `IN` list is not a
  `literal-string`, so it cannot be expressed through this `Connection` at all
  without giving up the static guarantee that an injected identifier is
  unexpressible.
- **A pre-aggregated summary row.** A second copy of a number that can never be
  recomputed, kept in step by hand. ADR 0019 already refused counter columns on
  `wconvert_optins` as "a table wearing a trench coat"; this is the same table
  with a rollup job in front of it.

The scan is affordable because ADR 0019 books the whole table at **~29k rows a
year**, and [`StatRange::MAX_DAYS`](../../src/Stats/StatRange.php) caps the
window at one year. **Corrected by [0089](0089-analytics-starts-with-impact-and-keeps-history-inspectable.md):** this bounds
the returned window, not the scan of the unindexed table. Two comparison windows
mean two scans; larger installs need measured query-cost review.

## Consequences

- **`Connection` was not widened, and the count of widenings stays at two.**
  The next one still has the docblock's warning in front of it.
- **A single-window read is two statements** (three for the comparison added
  by [0089](0089-analytics-starts-with-impact-and-keeps-history-inspectable.md)),  and `bin/verify-stats.php` asserts exactly
  two against a real database — so an N+1 arriving later is caught by number
  rather than by review.
- **`Dashboard::of()` is pure and takes rows**, the same arrangement
  `GoalReport` has with the arithmetic and `StatDay` has with the site's
  timezone. The three TDD seams #28 names are all testable with no database.
- **The no-`wconvert_leads` invariant got two guards rather than one.**
  `tests/unit/Stats/NoCountComesFromTheLeadLogTest.php` walks the reporting
  classes' *dependency closure* — computed, not listed, so a `LeadRepository`
  injected into a report is caught on the commit that injects it — and
  `bin/verify-stats.php` reads the real **query log**, then writes a [[Lead]]
  and erases it and asserts no reported number moved. That is the derivation
  ADR 0018 depends on not existing, checked from both ends.
- **The window is asked for in DAYS and never in dates.** A date parameter is
  how "the merchant's today" quietly becomes the browser's today, which belongs
  to whoever is at the keyboard. The far end is `StatDay::today()`, read on the
  server. **Amended by [0089](0089-analytics-starts-with-impact-and-keeps-history-inspectable.md):** `completeDays()` derives
  the window ending yesterday, and `previous()` derives its adjacent comparison.
  `lastDays()` still serves list/editor reads including today; no route accepts
  caller-chosen date boundaries. Its length travels back on the payload, so the admin bundle
  never spells the default a second time.
- **Nothing that cannot be reached is shipped.** **Amended by
  [0089](0089-analytics-starts-with-impact-and-keeps-history-inspectable.md):** send events now exist. Analytics displays
  requests and accepted sends separately and does not present their difference
  as a failure population. The following describes the original pre-send build.
  `conversions − deliveries` is
  the delivery failure count
  [ADR 0020](0020-conversions-are-interpreted-at-read.md) names, and it is
  deliberately absent: nothing writes the delivery kind, so every branch that
  could produce it is dead in this build, and it is the same
  arithmetic-over-two-numbers-already-shown shape the "left without converting"
  figure is refused for. The card carries the sentence explaining the zero and
  no number behind it.
- **If an install ever does outgrow the scan, the escalation is cheap and the
  query is already the one that would use it** — add `idx_stat_date`, change
  one number in `SchemaTest::INDEX_BUDGET`, and change no code. It should be
  taken when someone can show the scan hurting, not before.

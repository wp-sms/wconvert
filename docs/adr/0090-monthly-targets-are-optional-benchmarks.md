# Monthly targets are optional benchmarks, not campaign controls

The merchant approved prototype D: B's soft panels and prominent progress with
A's practical view of every configured target together. Actual impact comes
first, targets next, then Goal/campaign detail. With no targets, a compact setup
row replaces the panels; nothing is enabled or populated automatically.

This amends [0089](0089-analytics-starts-with-impact-and-keeps-history-inspectable.md)
and [0034](0034-the-dashboard-joins-in-php.md). A monthly target is an authored
number, not an Optin's Goal, a new counter, or a prediction.

## Small, site-owned settings

One non-autoloaded WordPress option, `wconvert_monthly_targets`, holds month →
metric → positive integer. No table, column, index, transient or event ledger is
introduced. A transient could expire an authored decision; existing Optin rows
cannot represent a site-wide benchmark; computing on read cannot recover a
number a merchant chose. A dedicated table would add no needed query capability.
Uninstall removes the option alongside the plugin's other settings.

The management-only `/monthly-targets` endpoint reads the current month and
replaces only that month's settings on explicit Save. Blank removes a target,
never its results. Allowed metrics are `leads`, `offers`, `carts`; values are
integers from 1 through 100,000,000. An old dialog cannot save into a new month:
the server rejects a mismatched month with 409 and the draft remains available.
Closing the dialog refreshes the site month. Completed months are retained,
not editable here. Reusing the immediately previous month's targets explicitly
copies values into a draft; nothing renews or saves automatically. Concurrent
administrators follow the existing whole-option last-successful-write model.

## Progress uses Analytics' interpretation

Progress comes from the existing Dashboard and historical daily counters, never
the retained Lead log. Leads mean submissions including repeats, not unique
people or confirmed subscribers. Offers and carts mean clicks, not purchases,
orders or recovered revenue. Paused and deleted campaigns keep contributing.
Leads are available even before the first campaign; offer/cart fields become
available with relevant reporting history or current/previous saved targets.
Every saved target remains visible. Percentages may exceed 100%; the visual bar
stops at its maximum while the count and excess remain explicit.

Targets never publish, pause, resume, declare winners, or mutate recorded
results. This is an optional monthly benchmark, not an automated optimization.

## Calendar months stay calendar months

The server supplies the current site month, full-month start/end, and count
cutoff at yesterday. The first day has zero complete days, empty daily series,
and zero actuals; it never borrows the previous month's last day. There is no
visible timezone and no browser clock chooses these boundaries.

Targets stay scoped to the current calendar month independently of the report's
rolling 7/30/90-day selection. Their View results links name `month=YYYY-MM`;
the dashboard route accepts this alongside its existing day-count interface.
The named month takes precedence and is capped at the site's yesterday. Past
months resolve to their complete calendar boundaries; future months are refused.
Impact, Goal, campaign, variant and editor-return links preserve the accepted
month. A monthly report's comparison uses the immediately preceding equal number
of complete days, not necessarily the previous calendar month. On the first
day comparison is unavailable, CSV export is disabled, and the capture-history
action is disabled rather than linking an empty period to today's captures.

The overview starts the target read in parallel with its report, not after it.
This independent endpoint normally adds one metadata read and one bounded
counter read; first-day reads skip counters entirely. Existing normal dashboard
reads remain two statements, comparisons three. These date bounds limit
returned rows, not scans; no secondary index was added. Focus refreshes targets
without polling. Errors retain accepted month/counts with explicit retry;
older in-flight reads cannot replace a confirmed save. The editor keeps its
month and draft frozen, blocks duplicate/ambiguous close during Save, and never
changes displayed progress optimistically.

## Verification and prototype disposition

Tests cover month boundaries/leap day/rollover, metric validation, permissions,
historical counters, option write failures, no counter writes, removal and
explicit reuse, draft retention/cancel, stale reads, and month-preserving links.
Free and Pro admin builds share this feature; no loader or visitor-facing code
is introduced. Verify layout and persistence in the real local WordPress, then
keep the throwaway variant switcher and fixture data out of the shipped tree.

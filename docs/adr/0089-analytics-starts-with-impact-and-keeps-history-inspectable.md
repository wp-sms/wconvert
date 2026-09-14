# Analytics starts with impact and keeps history inspectable

The merchant approved the impact-first prototype (variant A), including its
compact reporting-period/comparison bar without a visible timezone. This is the
production implementation, using the existing daily counters and Optin metadata.
No table, column, index, option, transient or event ledger is added.

This amends the Analytics presentation in
[0068](0068-reading-pages-put-results-and-routes-before-occasional-settings.md),
and extends the reporting/history decisions in
[0019](0019-analytics-stores-daily-counters-not-events.md),
[0020](0020-conversions-are-interpreted-at-read.md),
[0034](0034-the-dashboard-joins-in-php.md),
[0058](0058-a-test-ends-when-the-merchant-says-so.md) and
[0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md).

## Compatible impact counts, not a global conversion rate

The overview shows captured Leads (form submissions, not unique people or
confirmed subscribers), offer link clicks, cart return clicks and appearances.
PHP groups Goals by their declared action; the admin does not duplicate Goal IDs.
Send events never inflate Lead counts. Clicks do not establish purchases,
recovered revenue or downstream conversions.

Goal reports lead with visitor actions. Resource requests and emails accepted
for sending are separate numbers, including on individual Optin reports. Their
difference is not presented as a queue or failure count. Headline fields used by
other screens keep their existing meaning. Rates remain actions / appearances,
with a dash for an absent denominator. Repeated appearances and submissions
remain counted. Exact daily tables accompany the current/previous trend lines;
missing rate denominators are gaps, not zero-percent points.

## Complete windows and explicit scope

Analytics requests `complete=true` from the existing read-only dashboard route.
The selected window ends yesterday in the site's calendar. Its comparison is
the adjacent preceding window of the same length. The server resolves both;
neither browser dates nor browser timezones choose them. Each window is capped
at 366 days. List/editor reads omit `complete` and still include today.

`Dashboard::compare()` reads one short Optin interpretation and two counter
windows: three statements, no per-Optin queries, no Lead-log dependency, no
design JSON transferred. The date limit bounds returned rows, **not the rows
scanned** by the unindexed date predicate. Comparisons cost two table scans;
measure that on larger installs before requesting any index/schema change.

The period bar contains the dates, a comparison switch and an accessible
explanation of complete days. Failed refreshes preserve accepted dates and
numbers, disclose the error and keep drill-down/capture links on that period.
Impact, Goal, Optin, experiment and comparison state are bookmarkable. Table
search and status filters are local. Export **report** CSV covers the accepted
period and selected impact/Goal/Optin/family, including rows hidden by those
local table filters (disclosed on its control). It exports each raw arm once,
with IDs, current status and optional comparison values. Merchant text is
quoted and protected against spreadsheet formula interpretation.

## History explains the total

Never-published drafts without counters do not appear. Publication history is
computed from `published_config IS NOT NULL`; counter-bearing rows are retained
even if that metadata is absent. Paused and soft-deleted Optins remain in both
totals and inspectable report rows. Deleted rows have no edit or resume action.
Status describes now, not the status when a counter incremented. Published is
not labelled Active: schedules, rules and unavailable dependencies may prevent
appearance. Site activation milestones are not mixed into a filtered report.

Campaign contribution tables group parent and child arms for presentation.
Family sums are not added into Goal or impact totals again. Opening a grouped
row opens its family comparison; an individual arm link opens only that arm.
Filtering a family keeps its complete contribution and history together.
Successive child winners can leave retired arms nested beneath former winners.
Reports collect all descendants, not just direct children; this keeps campaign
totals, comparison cards, search and family CSV consistent with Goal totals.

## Merchant actions reuse existing controls

An individual campaign report offers pause/resume via the existing publication
routes. Pause affects that design, not every arm. Resume explicitly confirms
that the latest saved draft will be published; server publication validation
still applies. No mutation is optimistic and reports refresh after success.

The A/B view compares current and retired arms over the selected dates and
offers a manual choice only where the existing variant capability and current
family permit it. It uses the existing winner endpoint and confirmation. This
does not establish statistical significance. Retired designs remain readable.
The data cannot isolate immutable test rounds: a surviving design's selected-
period counters may include earlier/later uses. The screen says so and invents
neither round start/end timestamps nor a saved winner record. Such a ledger
would need a separate storage proposal and explicit approval.

## Prototype verdict

Retain A's impact hierarchy, focused Goal/campaign reports and compact date bar.
Do not ship the alternate prototype layouts, layout switcher or sample data.
The production screen uses real server-provided labels, counts and capabilities.

## Verification

PHP covers complete-day boundaries (including leap day), one metadata read plus
two bounded counter reads, compatible impact arithmetic and historical rows.
UI tests cover navigation, accepted dates after failed/stale requests, comparison
toggling, filters, CSV safety, family totals, retired arms, pause confirmation,
resume refusals and manual winner selection. Local WordPress is checked with
existing data; no live publication/winner mutation is used merely for QA.

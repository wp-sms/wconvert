# Reading pages put results and routes before occasional settings

WConvert helps a business capture a Lead and send it to an optional Destination.
The user requested the same UI/UX care across the admin as the rebuilt editor,
with freedom to improve the flows. The receiving system still owns the Contact
and subsequent communication. This decision changes presentation and read-state
handling; it adds no storage, Goal, capture field or delivery behavior.

## Frame and reading order

The four reading screens keep their horizontal navigation inside WordPress.
White navigation, pale page headings and petrol accents share the editor's
visual language. Page actions occupy the trailing edge of the title row and
wrap naturally. Reading screens cap at 80rem; the existing wide override is
90rem. Tables become labelled row cards at 900px and below: real WordPress
review found the six-column Optin table clipped its actions at 641px under the
old 639px breakpoint. Values and actions must remain readable at 360px.

## Each page's job

- **Optins:** search by name and filter by status. An A/B family stays together
  if any member matches, and filter counts count families. Unmatched filters
  offer Clear filters. The performance footer names the server's period.
- **Analytics:** results come before setup history. Goal filters preserve the
  server's registry order and each Goal's own metric. Daily bars use the actual
  daily series, with zero-height quiet days and an expandable exact-number
  table. Optin breakdowns are expandable. No site-wide conversion average or
  cross-Goal leaderboard is introduced. A same-period excess of conversions over
  recorded lead-magnet deliveries links to Destinations. It is neither a terminal
  failure count nor a population of Leads awaiting delivery; see the correction
  in [0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md).
- **Leads:** submissions remain the total, including in the grouped view.
  Names are readable directly; other captured values open within their row.
  This is an immutable capture log, not a Contact profile or consent-status
  editor. [0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md)
  extends the applied scope to exact identifier/Lead-ID and date filters, bounded
  cursor pages, group-to-event drilldown and all-matches CSV export.
- **Destinations:** configured routes show their identity, target and health
  first. Add a destination reveals the available types. Settings open within
  the route; hiding them preserves edits, while Cancel restores stored values.
  Failure reports and existing connection and test actions remain available.
  Re-push stays visible for a failing route and otherwise lives with Settings.
  [0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md)
  also puts it beside skipped captures, names failure routes/captures and makes
  the test recipient explicit before a real push. These changes preserve the
  existing recovery scope and delivery semantics.

Site-wide frequency and Lead retention use a shared settings disclosure. Its
closed state reports the saved configuration. Contents stay mounted so folding
the section cannot discard an edit, and a new error opens it. Existing explicit
saves and destructive confirmations still apply.

*Extended by [0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md):
retention controls now hold an unsaved draft. Explicit Save confirms the actual
chosen deletion period; toggling and blur no longer write settings. Addressable
reading filters and editor return links preserve the investigation across pages.*

## Reading failures and history

The latest report or Lead-log request owns the visible result. Earlier requests
cannot overwrite it. A failed refresh preserves the last successful data;
Analytics explicitly identifies the previous report and keeps its actual dates.
Lead row shape, filter labels and export describe the same applied response.
Both screens provide retry controls.

Milestones follow the Goal reports. Later evidence can establish that an earlier
step happened: an impression rules out “nothing is live yet”, and a conversion
rules out “never shown”. Missing milestone dates remain missing; the UI does
not manufacture dates to fill the sequence.

## Verification boundary

Behavior tests cover filters, A/B grouping, disclosure edits and cancellation,
out-of-order reports, pending Lead grouping and incomplete milestone history.
Review uses the real WordPress admin for integration and an isolated fixture
preview of the shipping components for populated reports and captures. Fixture
requests terminate locally and cannot reach a provider. Delivery end to end is
a separate check requiring a named test destination and recipient.

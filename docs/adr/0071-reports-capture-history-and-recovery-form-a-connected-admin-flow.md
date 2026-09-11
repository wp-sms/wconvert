# Reports, capture history and recovery form a connected admin flow

A merchant needs to move from an Optin's result to its design, captured details
or forwarding problem without losing the question they were investigating.
The reading pages introduced by [0068](0068-reading-pages-put-results-and-routes-before-occasional-settings.md)
and publishing flow in [0070](0070-drafts-are-reviewed-and-explicitly-published-from-the-editor.md)
now share addressable routes. This extends navigation and existing reads; it
adds no table, index, delivery ledger or Contact lifecycle.

## Links carry the investigation

Hashes remain within WordPress's existing admin page. Report links carry days,
Goal and optional Optin; capture links carry Optin, complete identifier or Lead
ID, and optional start/end dates. A named Destination can be addressed too.
The editor's hash carries its Optin ID and a return link. Unknown, external,
oversized and nested-editor return links fall back to Optins.

Clean Back/Forward navigation is accepted. A requested hash change while the
editor is dirty keeps the accepted editor and its local state mounted until
the merchant chooses **Keep editing** or **Discard changes**. Keeping restores
the prior history entry, so Back still works on a later attempt. A busy editor
restores its accepted route instead of offering to discard an operation.
The narrow-viewport boundary preserves an editor already mounted, hidden and
inert behind the wider-screen notice; its Back action uses the same guard.
An already-open dialog can finish or close without losing its own draft. Initial
narrow visits still defer the editor chunk. Narrowing the window does not grant
access to hidden canvas controls or discard unsaved work.

Only the supported reading filters are bookmarks. Grouping, pagination cursors
and expanded capture details remain local view state; returning from the editor
does not promise to restore an exact page or open dialog.

## Results and their links describe the same accepted period

The report's requested period is distinct from the payload's actual days and
dates. Failed refreshes retain the previous numbers, label the requested period
and disclose the dates still shown. Editor return links, individual-result links
and capture links use that accepted payload. Capture links carry actual `from`
and `to` dates in the site's timezone. A focused report displays the selected
Optin's numbers and daily series, not its whole Goal's totals. Deleted Optins
retain Goal history but have no individual row; an unavailable focus offers a
route back to all results.

The delivery gap is **the nonnegative difference between conversions and
lead-magnet deliveries recorded in the same period**. It is not a count of
particular Leads awaiting delivery or a live queue count. A delivery today can
belong to yesterday's capture; re-push can also record another send. For example,
one new conversion still waiting and one delivery from yesterday produce a gap
of zero. The arithmetic is unchanged; its explanation now states its limits and
routes operational investigation to Destinations. Reports also explain the
conversion-rate denominator, missing impressions, deleted-Optin totals and
retention's independence from historical counters.

## Capture history shares one query with counts and export

[`LeadQuery`](../../src/Lead/LeadQuery.php) validates exact email/phone or Lead-ID
search, Optin and date constraints. Email and phone use the capture identifier
normalizers; dates include both named days in the site's timezone and become
ULID bounds. Partial-text and free-form field search are not introduced.

The first read supplies an upper ULID boundary before the current millisecond.
Subsequent pages use that snapshot and an opaque cursor containing the boundary
and last ID. Events page newest-first with `id < cursor`; groups page on
`MAX(id)` after aggregation, so a group's events and submission count are not
split across pages. New captures do not enter this view until refresh. This is
an upper bound, not a database snapshot: privacy erasure or retention can still
remove records while a merchant reads or exports them.

Grouping remains email-first, with phone groups only for rows without email.
**View submissions** preserves that exact group partition, the applied filters
and snapshot. A general phone search can match an email-bearing row with that
phone; drilling into a phone group cannot. The headline always counts matching
submissions, never people. Older/Newer controls expose bounded pages instead
of treating the default 50-row read as the whole log.

CSV streams every retained matching event across all pages under the applied
filters and snapshot, ignoring the page cursor. Grouping never exports group
summaries. A group's own export adds its group constraint. The CSV includes
Lead IDs for later lookup. It remains a manual download, outside WConvert's
control after export. No new indexes are added; selective Optin reads and
filtered grouping retain the query-cost tradeoff in [0033](0033-the-lead-log-reads-without-a-new-index.md).

## Recovery names its route and its scope

Terminal-failure rows link to the named Destination and the exact captured Lead.
A removed route or a capture no longer retained is explained without inventing
delivery history. The ring remains bounded diagnostics, not a per-Lead ledger.
Skipped-capture recovery sits beside the skipped explanation and remains
disabled while the destination cannot run.

Re-push still replays retained Leads for Optins whose **published** configuration
uses that Destination, since its last success; with no prior success, its scope
is the whole retained matching history. It does not target just the displayed
failure or skipped count. Existing queue limits and throttling remain, and
replaying a lead-magnet send can email the recipient again.

**Send a test** first shows the saved named route, sample email and possible
external effect. `test_sample.email` is a visible profile-address suggestion;
the POST requires the email explicitly and never substitutes the profile when
it is missing. The suggested sample contains email only, not fabricated name or
phone. **Extended by [0074](0074-destinations-declare-requirements-and-show-shared-usage.md):**
a saved MailPoet interest mapping exposes an optional, initially empty interest
sample. The merchant must enter its stable value explicitly and sees that it
applies to new subscribers only; no answer is invented by the endpoint.
Unsaved destination settings are identified because the test uses saved settings.
It runs the real provider push, creates no Lead, queues nothing and changes no
health or report counter. A successful handoff does not prove subscription or
inbox receipt. Connection testing remains a separate operation.

## Retention is a draft until explicitly saved

Selecting automatic deletion, typing a period, pressing Enter in the field and
leaving the field do not save. The merchant supplies a valid period and chooses
**Save retention**. Enabling or changing automatic deletion then confirms those
exact days before writing; no suggested 90-day policy is committed along the
way. Selecting keep-forever also needs an explicit save, without a destructive
confirmation.

The closed disclosure always describes the last saved policy. Failed writes
retain the draft and error for retry. Cancelling the confirmation keeps the
draft editable; **Cancel changes** restores the saved policy and its control's
focus. The deletion confirmation prevents duplicate submission and dismissal
while its write is pending. The existing site-wide option and daily prune are
unchanged; keeping forever remains the
default, and no existing policy changes merely by visiting the page.

## Verification boundary

Source and interaction coverage are recorded in the [flow review](../reviews/2026-09-10-flow-by-flow-ux.md).
Integration, responsive WordPress checks and CI status must be recorded there
from actual evidence. This decision alone claims no successful provider send,
test capture, retention write or recovery run.

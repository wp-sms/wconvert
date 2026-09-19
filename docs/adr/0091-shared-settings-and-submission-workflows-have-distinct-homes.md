# Shared settings and submission workflows have distinct homes

The merchant approved Leads prototype B (compact table/detail dialog) and
Settings prototype A (category navigation/focused forms), without a setup
banner. This amends [0068](0068-reading-pages-put-results-and-routes-before-occasional-settings.md),
[0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md)
and extends [0033](0033-the-lead-log-reads-without-a-new-index.md).

## Shared settings

The main navigation is Campaigns, Analytics, Leads, Settings. Settings has three
addressable categories: Visitor experience, Connections & destinations, Data &
privacy. No additional overview or banner. The category rail moves above forms
on narrow screens.

The 15 September fidelity pass completes the approved direction: searchable
category navigation, contextual Campaign/Leads links, separated explanatory
field rows and consistent Save/Cancel footers. Display-limit Save first reviews
the proposed site-wide values; only Apply writes. Connections distinguishes
stored remote accounts from reusable destinations without treating stored
credentials as a verified connection. Local services explicitly need no remote
account. Existing provider configuration and test-send safeguards remain intact.

The follow-up polish removes the global “Back to Leads” Settings action;
task-specific links (export and sending issues) remain. “Add a destination”
opens a two-step dialog: choose an available service, then name/configure the
route before saving. Unavailable services explain their prerequisites, distinct
from tier-locked services. Either step closes back to the stable Add trigger.

Site-wide frequency moves out of Campaigns and retention moves out of Leads;
contextual shortcuts remain. Leads reads a saved retention summary. Frequency
edits are one explicit Save/Cancel draft, never blur/toggle writes. Invalid
values do not silently substitute stored values. Retention retains its chosen
period confirmation and forever default. Dirty category/page navigation asks
Keep editing or Discard changes; reloads warn too. Pending saves cannot be
discarded by in-app navigation.

Destination setup preserves real provider-defined controls, masked account
choices, shared usage, availability distinctions and test safeguards. Campaign
bindings stay in the editor. The fictional Mailchimp reconnect example in the
prototype is not a new provider integration or credential API: only installed,
implemented providers are offered. WordPress-owned Connectors, timezone,
language and personal-data request tools are not copied into WConvert. Data &
privacy links to WordPress's existing export/erasure screens. Monthly targets
remain in Analytics.

*Amended by
[ADR 0093](0093-privacy-erasure-is-bound-to-one-explicit-identifier.md): WConvert
still does not copy WordPress's request-management workflow. Data & privacy now
explains one narrow exception WordPress cannot serve: after independently
verifying a phone-only requester, the merchant uses Leads' existing exact-phone
search and CSV, then confirms deletion of every retained Lead whose `phone`
column directly contains it. The destructive control lives with that exact
result scope, not as a second request inbox or a per-Lead row action.*

*Amended by
[ADR 0094](0094-privacy-guidance-reports-the-current-data-flow.md): Data &
privacy also contains a read-only “Where visitor data goes” disclosure between
retention and the existing export/request actions. It reports this install's
saved retention, configured destination types, browser-local state,
anonymous-count rate limit and external-copy boundary using the shared
settings-disclosure/loading/error vocabulary.
It links back to the existing settings owners and does not add an overview,
request inbox or separate compliance dashboard.*

## Submissions and operational recovery

Submissions is the default Leads workspace, not one of two peer tabs. No view
navigation, subtitle or Sending setup shortcut occupies space above the table.
A compact warning-styled Sending issues button appears beside the page actions
only when the health read reports affected destinations. Loading/failed reads
do not invent a count or action. The diagnostic route remains bookmarkable and
has its own heading and Back to submissions action. Shared setup remains under
Settings; problem-specific destination links remain in diagnostics.

This conditional diagnostic shortcut is a narrow exception to
[0039](0039-a-screen-is-regions-and-scope-decides-placement.md)'s two-action
header cap: it appears only when problems exist, alongside Refresh and Export,
and replaces persistent navigation rather than adding a new always-visible action.

A compact row shows captured name/identifier, Campaign, answer preview, capture
time and a detail action. The dialog exposes original answers, stable choice
value, captured consent and Lead ID. No invented source URL, subscription
status, sales stage or per-Lead delivery status. Repeated captures remain
separate events; email-first grouping and drilldown remain available. CSV
exports all retained matching events, not the visible page or group summaries.

The applied filter scope and count/CSV explanation live in a compact info
popover beside the submission total, not an extra permanent row. It opens by
click or keyboard and dismisses with Escape. It describes the last successful
query, including when a replacement read fails; the stale-results warning
remains visible independently of help.

Rows include initials when a name was captured, available Campaign Goal labels,
localized wall-clock dates and an Open action. Details put the captured message
first and link to the Campaign and retained submissions using the same identifier.
The latter explicitly leaves the current filters; it is an identifier search,
not a merged Contact or an inferred number of related people.

Purpose views are All submissions, Subscriber collection (email/SMS list Goals
only), and Enquiries. Resource requests remain in All submissions: requesting
a resource does not imply marketing subscription. Goal metadata includes
paused/deleted Campaigns and every ID, not the capped UI list. Each query
resolves that set once, including across export batches. An empty purpose
matches nothing and never drops its predicate.

Explicit Apply supports literal, case-insensitive substring search of captured
name/message and email/phone, up to 200 Unicode characters. Full canonical
identifiers and Lead IDs keep their exact paths. Counts, pages, grouping,
drilldown and CSV share predicates and the capture bound. A failed filter read
does not relabel previous rows/export. Search/purpose are bookmarkable;
paging/dialog state is not promised.

Secondary date/order controls are under Filters. Optional 7/30-day presets
include today on the site's clock; all retained dates remains the default.
Oldest-first uses forward keyset paging under the same upper capture bound;
groups sort by latest capture within each group. CSV keeps all matches, not the
display order. Purpose chips optionally receive server counts over the applied
search, Campaign and dates, disregarding only purpose and pagination. They reuse
the existing selected total and compute the other two counts on read, with no
new storage and no per-keystroke requests. An unsuccessful read never relabels
previous rows or counts. The Sending issues badge counts distinct affected
destination IDs, including retained diagnostics for removed routes, never
undelivered submissions. Unknown reads do not display zero.

Sending issues shows route outages/skips/unavailability and the bounded rejection
ring, linking to the capture and Settings setup. No known issues does not imply
delivery for every submission. Re-push requires review of its destination-wide
published-configuration scope, last-success boundary and possible duplicate
email; it is never a retry of just one visible failure. Test sends still
require an explicit recipient and use saved settings. No automatic retry or
delivery ledger is introduced.

## Cost and verification

No table, column, index, retention default or capture behavior changes. Text
search scans retained fields; it is not index-only and runs on Apply rather
than each keystroke. Date/Campaign filters can narrow a large log. A new index
requires measured need and separate approval. Purpose reads short IDs from the
existing Campaign table, without config blobs or widening the database interface.

Behavior tests cover navigation, drafts, details, search scope and recovery
confirmation. `bin/verify-lead-search.php` checks real SQL case handling, Unicode
and wildcard escaping using a read-only derived fixture relation, without
inserting invented captures. Browser QA uses real WordPress without saving
settings or sending to providers. The implementation review records evidence.

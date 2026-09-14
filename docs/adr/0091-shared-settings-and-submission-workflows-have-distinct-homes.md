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

## Submissions and operational recovery

A compact row shows captured name/identifier, Campaign, answer preview, capture
time and a detail action. The dialog exposes original answers, stable choice
value, captured consent and Lead ID. No invented source URL, subscription
status, sales stage or per-Lead delivery status. Repeated captures remain
separate events; email-first grouping and drilldown remain available. CSV
exports all retained matching events, not the visible page or group summaries.

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

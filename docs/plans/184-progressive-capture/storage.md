# Storage, requests and reporting

Status: implementation proposal for the accepted product plan. No runtime or
schema change is included in this planning work. The earlier two-table proposal
is withdrawn. Use existing Lead JSON, Action Scheduler and the existing daily
statistics table. The user explicitly approved the statistics column/key change
below on 2026-09-22 under `CLAUDE.md`'s storage rule. No other table/column change
is authorized by this plan.

## One Lead, with a small accepted-submission history

Keep `wconvert_leads` and its indexed canonical `email`/`phone` columns. Its
existing `fields` JSON becomes an explicit envelope:

```json
{
  "answers": { "name": "Example" },
  "capture": {
    "contract": "capture-contract-fingerprint",
    "receipt_key": "owned-receipt-option-key",
    "submissions": {
      "email-signup": {
        "accepted_at": "2026-09-22T10:00:00Z",
        "request_hash": "normalized-request-fingerprint",
        "purpose": "email_marketing",
        "values": { "email": "example@example.com" },
        "consents": [
          { "id": "n_email_consent", "purpose": "email_marketing", "text": "Email me news and offers." }
        ],
        "destination_ids": ["opaque-destination-id"],
        "handoff": "pending"
      }
    }
  }
}
```

This is a storage example, not a browser payload. Accepted timestamps, values,
purposes, exact consent wording and route IDs stay unchanged. A later SMS
submission adds a second entry and a previously absent canonical phone; it does
not replace email details. Its consent inherits its own submission's acceptance
time, not the first capture time. Only initial queue-handoff bookkeeping changes.

The ordinary form has one entry. The optional follow-up experience is bounded
to a primary signup and one optional signup for the other channel. This is a
small history within one capture, not an unbounded profile/event log.

Preserve `created_at` and the ULID's capture time at first acceptance. Additions
do not renew retention. Public Lead DTOs/CSV expose answers and explicit consent
fields, not internal metadata. Privacy export includes accepted evidence;
erasure and retention delete it with the Lead. Adapt the current flat-string
`Lead::fromRow()` deliberately so nested history cannot silently disappear.

## First-submit retries without a new table

At the first explicit Submit, obtain a stateless signed start grant before
sending captured values. It binds a random request secret, Campaign, capture
contract and absolute expiry. Issuing it stores no Lead or answers. Keep it in
page memory and reuse it for retries. Next/Back do not obtain grants or send data.

The first capture transaction claims a non-autoloaded WordPress option named
from the hash of the grant's secret. WordPress already has a unique option-name
index. This owned option is a temporary request receipt: expiry plus accepted
Lead ID, or a revoked marker. It contains no answers, consent, credentials,
email or phone. Create the Lead with a ULID minted at acceptance and write its
receipt mapping in the same transaction. The unique option key serializes
concurrent first requests. Identical normalized retries return the accepted
result; different values for an accepted submission are a conflict.

Do not reserve the Lead ULID before capture: its timestamp would differ from
`created_at`, invalidating existing retention and ordering assumptions. A short
receipt preserves the current Lead primary key and avoids a permanent new column.
Use a dedicated receipt store on the same database connection and handle option
cache invalidation explicitly. Disable autoload and schedule expiry cleanup.
This is transport retry bookkeeping, not a visitor identity or cross-visit session.

## Continuation and erasure

Return a signed continuation proof after first acceptance, bound to the Lead,
Campaign, receipt and contract. The optional addition requires it. Use an absolute
30-minute grant lifetime without renewal. Expiry offers a finish/close path and
never undoes saved information. Independent later signups are new captures.

Email/phone matches and exposed Lead IDs never authorize updates. Keep grants,
secrets and unsaved values out of URLs, logs, cookies, localStorage and
sessionStorage. Reload loses them; accepted captures remain.

Erasure changes the receipt to a revoked marker before deleting the Lead, in the
same transaction. Keep only its hash/expiry until the signed start grant expires.
Every first-request retry must present the original unexpired grant, so deletion
followed by a replay cannot recreate the Lead. After expiry the receipt can be
removed. Its owned option key is in internal Lead metadata, avoiding scans of
unrelated options. Pruning handles any unexpired receipt the same way. Missing
Leads provide no continuation, export, or queued payload.

## Atomic capture

The current database abstraction lacks transaction methods. Add narrow
transaction/row-lock operations and prove them on WordPress MySQL and Playground
SQLite. Verify supported storage engines; do not silently fall back to unsafe
independent writes where atomicity is unavailable.

First acceptance atomically writes the receipt, Lead/snapshot and server-owned
counters. A later submission locks the Lead, validates the declared addition,
appends its snapshot and increments only its channel/stage counts. It does not
increment overall Conversion or replace earlier fields. Retry checks compare
normalized request hashes. A failure rolls back all local changes.

The server derives fields, consent, order and allowed additions from published
data and accepted snapshots. Browser screen position and browser-supplied consent
wording are not authorities. Fingerprint capture requirements, purposes, consent
wording/resolved links, order and route bindings. Refuse stale-contract additions
with a refresh/review message while preserving earlier captures. Pure styling
changes need not invalidate the capture contract.

## Keep Action Scheduler

Each job carries only `(lead_id, submission_id, destination_id, attempt)` and
reads that submission's frozen snapshot, not a later version of the combined
Lead. Queue cleanup cannot erase consent history. Credentials remain in
Connections; shared Destination settings retain their documented effect.

Enqueue purpose-specific handoffs promptly after local commit. SMS does not
repeat the email welcome/resource action. Shared adapters must declare supported
purposes and handling for a later addition; accepting a phone does not establish
SMS consent. Capture failure remains separate from Destination failure.

Keep a small initial `handoff` marker in each accepted snapshot. A bounded
scheduled scan recovers a crash between commit and enqueue. Use an owned
non-autoloaded checkpoint and overlap by the maximum continuation window, because
a recently created Lead may gain SMS later. Do not advance the safe checkpoint
past unresolved handoffs. Scan by the ULID primary key; benchmark sustained load
and recovery after a long scheduler outage before adding an index or table.

Use unique pending job identity where supported. Mark initial handoff complete
once each route is scheduled or recorded as unavailable. Recovery/explicit
re-send select the accepted submission, not all current Lead data. Erased Leads
supply no payload to jobs. An unavailable route is distinguishable from a queue
failure, so it does not stall the initial-handoff scan indefinitely.

A provider accepting a message and losing its response remains ambiguous.
Neither a table nor Action Scheduler guarantees exactly-once external email
sending without provider support. SMS progression and ordinary accepted-request
retries must not enqueue the earlier action again; crash recovery keeps explicit
delivery uncertainty. Do not add a new general delivery ledger for this feature.

## Extend the existing statistics table

Proposed schema change: add `scope VARCHAR(160) NOT NULL DEFAULT ''` to
`wconvert_stats` and change its primary key from `(optin_id, stat_date, kind)`
to `(optin_id, stat_date, kind, scope)`. Use bounded ASCII scope identifiers and
verify key size/collation on supported MySQL and SQLite engines. No new table
or Lead column is proposed.

Empty scope holds existing Campaign totals. Channel scopes are closed values
such as `channel:email_marketing` and `channel:sms_marketing`. Screen scopes
identify a published flow revision plus a stable screen ID. Validate against
server-owned definitions; beacons cannot invent scope keys. Keep `kind` a closed
event enum rather than encoding a screen registry in it.

On publication, write a small non-autoloaded report-definition option keyed by
Campaign/flow revision, containing screen IDs, labels and order. No visitor data
or full Template is stored there. All counters for that revision share it, so
historical reports retain labels after screen edits. Retain definitions with
their anonymous stats and remove them on uninstall.

All existing dashboard, Goal, Campaign, milestone, target, comparison and A/B
readers must explicitly select empty scope. Otherwise screen rows could inflate
existing totals. Journey readers select channel/screen scopes and compatible
revisions. Update primary-key contracts and preserve counts after Lead erasure.

Closed screen events: shown, advanced, skipped, dismissed. Count each screen/event
once per mounted journey in memory; reloads can count again. Browser signals are
approximate and may be blocked/forged. They carry no Lead IDs, receipts, grants
or persistent visitor IDs. Keep accepted/channel counts server-owned. A callback
phone is not an SMS marketing signup; channel totals cannot be summed as Leads.

Count overall form Conversion on first server acceptance only. Remove the duplicate
browser conversion beacon on that path; click-only Campaigns keep theirs.
Screen appearances do not add Campaign Impressions. Ratios describe progression,
not exact abandonment or unique people. Benchmark representative six-screen
journeys, publication revisions, multi-year queries and report filters: the old
four-counters-per-Campaign/day budget no longer describes this workload.

## Alternatives

| Alternative | Decision |
|---|---|
| Existing Lead JSON | Use: at most two accepted submissions is bounded; keep consent and frozen queue inputs with the Lead. Prove locked updates and adapt readers/export. |
| Action Scheduler | Use for work and retries, with ID-only arguments. Not the only evidence store. |
| WordPress options | Use small owned receipts, scan checkpoints and report definitions, with autoload disabled and explicit cleanup. No captured answers or growing global JSON log. |
| Transients | Appropriate for disposable rate limits, not authoritative replay protection or consent. |
| Existing daily counters | Add explicit scope and audit all readers, avoiding a second statistics system. |
| New submission/stats tables | Withdrawn. Reopen only if measured contention, payload or recovery/query needs demonstrate a concrete benefit. |

## Approval boundary

The user approved the `scope` column and primary-key change on 2026-09-22.
This planning change executes neither. The earlier two-new-table proposal is
withdrawn; no new tables or Lead columns are approved. Further schema changes
would need separate justification and sign-off.

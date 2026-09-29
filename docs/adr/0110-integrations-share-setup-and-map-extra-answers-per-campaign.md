# Integrations share setup and map extra answers per campaign

Accepted product direction, 2026-09-29. This ADR records the planning conversation;
the integration changes are **not implemented** by this documentation commit.
The [detailed plan](../plans/integration-foundation.md) separates accepted product
scope from engineering recommendations and provider verification still required.

## Account and Destination settings stay shared

A Connection stores one account's credentials. A Destination selects its audience
or list and the existing-contact policy; campaigns reuse it. Shared edits show
saved/live usage. Basic supported contact fields follow provider-owned defaults,
so a newsletter campaign needs no manual mapping table.

The first remote adapters are Mailchimp and Brevo in Pro. Core keeps the shared
setup, mapping, test, queue, health and recovery implementation; local WSMS,
MailPoet and lead-magnet email remain Free. No separate paid mapping or diagnostics
feature is introduced. Outbound webhook is the next separately scoped candidate.

## Extra answers belong to the campaign that captures them

The merchant optionally opens **Field mapping** and pairs a campaign field
or question with an existing provider field. Store that mapping in the campaign
configuration, scoped to its Destination and accepted submission. It follows
draft, Undo and Publish behavior. The control pairs each campaign answer with a
provider-labelled field column and an explicit **Keep in WConvert only** choice.
Unavailable targets and duplicate selections are explained beside the affected
row; removed campaign answers can have their stale mappings removed. Empty
metadata and failed discovery have distinct refresh/retry paths.

**Preview and test mapping** is a separate optional disclosure. A test reviews
sample values, target and existing-contact behavior before offering a real send.
The reviewed sample is the send payload; mapping, audience/account, field refresh
or sample changes invalidate that review. Basic contact defaults remain outside
this optional mapping control. No preview claims remote delivery verification.

There is no Destination custom-field map with
campaign overrides, and no global question catalog or expression language.

This amends [ADR 0074](0074-destinations-declare-requirements-and-show-shared-usage.md)'s
deliberately narrow Destination-level MailPoet interest mapping. The implementation
will move that setting into the one campaign mapping model directly; the repository
is pre-release and does not need a compatibility hierarchy.

Stable source IDs survive renames. Only accepted values may leave WConvert;
skipped questions and absent answers never become provider-clearing instructions.
Extra-answer mapping does not authorize sending anonymous quiz answers or consent
as an arbitrary custom value. Mapping metadata stays server-side.

The detailed plan recommends freezing the effective map with the accepted
submission and guarding against subsequent account/target/policy changes. Those
engineering details must be verified against the existing transactional capture
and recovery flow before implementation; they are not a new delivery ledger.

## Existing-contact behavior is explicit and limited

Each capable Destination offers **Keep existing details** (default) or **Update
mapped fields**. The latter changes only eligible non-identity values explicitly
present in that submission. It never authorizes replacing email/phone identity,
merging people, reading/changing subscription/suppression state or removing a
membership. Retry/recovery can reapply older values; no latest-write or exactly-once
automation guarantee is made.

This narrows the universal never-overwrite claim in
[ADR 0022](0022-the-wsms-push-fills-blanks-and-never-mutates-state.md) for verified,
supported non-identity writes. Its identity/lifecycle protection remains intact.
It does not claim that WSMS or MailPoet already support the new option.
[ADR 0049](0049-the-mailpoet-push-adds-membership-without-touching-status.md)'s
MailPoet provenance limitation remains a requirement: do not expose Update mapped
fields there until a write path preserving those properties is proven.

## Recent outcomes use Action Scheduler, without becoming permanent truth

The user selected recent sending history over a lifetime per-Lead ledger.
Record explicit WConvert outcomes against Action Scheduler attempts. A scheduler
callback can complete after the provider failed, so Completed is never translated
directly to Sent. A provider timeout or missing outcome remains Unknown.

This extends [ADR 0008](0008-delivery-state-is-destination-health-not-per-lead.md):
recent per-submission/Destination attempts may be inspected, but advisory health
and the bounded failure ring remain, and no permanent delivery table is introduced.
Cleanup or missing history cannot establish that no send occurred. Provider accepted
does not mean subscribed, confirmed, inbox-delivered or read back from the provider.
Test sends remain outside real-send health, history and counters.

The plan proposes separating actionable failure reason from retry advice instead
of treating all repairable configuration problems as transient outages. The precise
result/queue interface is an implementation detail to verify in the first slices.

## Consequences

- Keep the existing registry and stateless adapter seam. The second provider must
  reuse the first provider's setup/mapping/history controls rather than clone them.
- Provider-specific payload, limits and write semantics remain in the adapter.
- Preserve [ADR 0007](0007-destinations-are-outbound-and-fallible.md)'s local-first
  capture and [ADR 0103](0103-progressive-capture-keeps-one-lead-per-journey.md)'s
  accepted-submission routing; optional SMS does not repeat email.
- Existing JSON/options/transients and scheduler logs are the planned stores.
  No table/column/index change is authorized by this ADR.
- New-contact provider confirmation and safe existing-contact writes must be
  verified per provider. WConvert does not acquire a Contact lifecycle.

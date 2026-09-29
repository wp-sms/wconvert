# Destinations declare requirements and show shared usage

A phone-only form could select MailPoet without learning that its captures would
be skipped. A shared route could also be edited without showing the Optins that
use it. Complete the metadata follow-up in
[0070](0070-drafts-are-reviewed-and-explicitly-published-from-the-editor.md) using
the existing Destination contract and saved draft/published snapshots.

## The provider owns the prerequisites

`DestinationType::requirements()` returns `DestinationRequirements`: alternative
canonical identifiers (`capture_any_of`), required saved settings, canonical
fields used by the adapter, and explicitly supported answer mappings. The same
object checks identifier presence and normalizes required values for adapter
pushes; REST exposes it for admin guidance. List identifiers must be nonempty
trimmed strings, so a numeric or whitespace-only list cannot pass the admin
check while failing the push.

The three shipped adapters declare these facts:

| Destination | Capture prerequisite | Required settings | Values used |
| --- | --- | --- | --- |
| WSMS | Email **or** phone | None; tags are optional | Email, phone, name |
| MailPoet | Email | At least one list | Email, name; interest only with the mapping below |
| Lead-magnet email | Email | File URL | Email |

This table describes shipped adapters, not planned ESP or webhook support.
`fields` describes what an adapter uses, not a promise to overwrite an existing
Contact. Provider availability, a missing Connection, incomplete settings and
form compatibility remain separate facts. A nonempty file URL is not a check
of its validity, reachability or inbox delivery.

The editor checks its current template against selected routes. An absent
identifier is explained differently from an optional one: optional email with a
phone field may produce valid local captures that the email-only route skips.
Capture itself always requires email or phone, so a form offering only optional
email cannot create a Lead without it; WSMS accepts either identifier. Unsupported
answers are explicitly described as kept in WConvert and not sent by that
route. These destination warnings do not block publishing: local-only capture
is valid, and merchants may save incomplete shared settings while setting up a
site. The adapter remains authoritative at push time. A publishable form itself
must satisfy the capture boundary; a working destination does not repair an
invalid form.

## One explicit interest mapping, with a narrow promise

The canonical key `interest` is independent of the merchant's question label.
Its stable selected option value is what can be forwarded; the captured display
label remains part of the Lead's local evidence. This is not an arbitrary field
mapping framework.

> **Extended by [ADR 0110](0110-integrations-share-setup-and-map-extra-answers-per-campaign.md),
> accepted but not yet implemented:** extra captured form/quiz answers will map
> through a shared implementation, with selections owned by each Campaign and
> scoped to its Destination/submission. Basic fields remain automatic. This
> replaces the deliberately narrow mapping scope above; it does not introduce
> shared custom defaults plus overrides or a transformation language. MailPoet's
> Destination-level `interest_field` will move into that Campaign map directly.

MailPoet offers **Save interest in MailPoet**, an optional `interest_field`
setting selecting an existing custom text field by its stable `cf_` identifier.
The public `getSubscriberFields()` API supplies field names and types. This is a
read of provider shape, with no Contact lifecycle information. The adapter
validates the selected field before passing the answer to `addSubscriber()`.
An unavailable configured field remains visible in settings and produces a
mapping warning; it is never silently cleared. An attempted new-subscriber push
with that answer and an unavailable mapping fails for retry rather than silently
dropping the answer.

**The mapping applies to new subscribers only.** A match or a create race still
adds only missing list memberships and leaves all existing subscriber fields
unchanged, completing the rule in
[0049](0049-the-mailpoet-push-adds-membership-without-touching-status.md). The
setting, editor compatibility advice and test dialog state this limitation.
Neither WSMS nor the lead-magnet email forwards interest. Without a mapping, the
answer remains available with the captured Lead and its export.

> **Existing-contact policy under ADR 0110:** capable adapters will offer Keep
> existing details or Update mapped fields. The MailPoet creation-only behavior
> described here remains current and must remain visible until an eligible update
> path is verified. Subscription, identity and provenance protections are not
> relaxed by the new setting. Lead-magnet email has no Contact-update setting.

The test dialog can accept an optional, explicitly typed stable interest value
when the saved route declares and configures that mapping. It starts empty;
the profile supplies only the visible email suggestion. The endpoint never
fabricates an answer, name or phone. Test sends retain
[0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md)'s
real-effect disclosure and no-Lead/no-queue/no-counter contract. Success does
not establish subscription, later field updates or inbox receipt.

## Shared settings show their saved users before editing

The admin destination read derives a compact usage list from existing Optin
`config` and active `published_config` bindings. Each name says **Saved draft
only**, **Live only**, or **Live and saved draft**. Deleted Optins and paused
published snapshots do not count as live use. It is one admin query, with no new
table, index, stored flag or public-page read.

Both in-editor setup and the Destinations page show this list before shared
settings. The note explains that unsaved editor changes are excluded and saving
affects live use immediately. Unknown usage is reported as unread, not as no
users. Selecting a route remains an Optin draft edit; saving the shared route is
outside that draft's Undo, as stated by
[0075](0075-draft-history-and-template-content-choices-stay-predictable.md).

## Verification boundary

Tests cover provider requirement parity, malformed list values, missing versus
optional capture fields, local-only capture, saved/live usage, unavailable
mapping preservation, stable answer forwarding on creation and no overwrite on
a match, and explicit test samples without Lead or counter writes. Browser
checks and wider suite evidence belong in the flow review after they run.
Mocked provider tests do not claim a live provider send or confirmed receipt.

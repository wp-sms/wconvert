# Progressive capture keeps one Lead per journey

Product direction agreed during the [#184 planning interview](../plans/184-progressive-capture.md)
on 2026-09-22 and confirmed after the
[use-case review](../plans/184-progressive-capture/decision-review.md). Runtime
implementation is pending. Ordinary multi-screen forms save and hand off once
at their final Submit. The separate optional email/SMS signup experience is the
bounded exception; navigation is never autosave.

An email signup is saved when explicitly submitted, even if the visitor leaves
the optional SMS screen. A later SMS submission in that same capture journey
adds phone and separate SMS consent evidence to the same Lead. The journey counts
one Conversion, at its first accepted capture. Next, Back, later additions, and
retries do not count again. Separate journeys still create separate Leads;
matching an email or phone never authorizes merging or updating one.

Already-submitted details are fixed. Back can review earlier submissions, but
only unsaved answers remain editable. Later submissions add new details and
evidence without replacing previously accepted identifiers or wording.

Each completed signup starts its Destination handoff immediately after local
persistence. A subsequent SMS signup must not repeat the earlier email welcome
or resource delivery. "Immediately" means enqueue without waiting for the
remaining screens, not claim the provider has already delivered or subscribed.

## Why this changes the earlier model

Saving only at the final screen loses an email signup the visitor already
submitted. Writing a second Lead for the optional phone step makes one journey
appear as two captured Leads and two Conversions. The accepted choice is one
combined capture record that may receive explicitly submitted additions from
that same journey. It remains outside Contact lifecycle management: no manual
profile editing, import, subscription-status changes, or merging across visits.

Individual consent evidence remains a snapshot of what was accepted, for which
channel, and when. Later SMS evidence cannot replace email evidence or inherit
the earlier email acceptance time. This requires revisiting the claim that a
Lead's creation time is the only consent timestamp needed.

## Template, editor and reporting scope

The feature is Free core functionality; existing Pro Display Types and
integrations keep their entitlements. Merchants can add, duplicate, delete,
and reorder screens in a linear journey, with a primary submission and optional
other-channel signup. Curated
Templates provide starting points; conditional branching is outside this feature.
Content-only screens are meaningful parts of a linear journey, while navigation
remains distinct from a submission. The concrete JSON syntax is still proposed.

Reports include the overall Conversion count, separate email/SMS capture totals,
and anonymous screen progress counts. Repeated screen visits are not unique
people, and aggregated screen differences must not be called exact abandonment.
The user approved one `scope` column and an expanded primary key in the existing
statistics table. Existing readers must select Campaign scope explicitly.
Accepted-submission evidence stays in existing Lead JSON; Action Scheduler
continues to own work/retries. No new tables or Lead columns are approved.

## Amendments

- [ADR 0019](0019-analytics-stores-daily-counters-not-events.md): keep daily
  counters in the existing table, add the approved scope column/key, and separate
  Campaign totals from channel/screen reporting. Accepted captures count on the server.

- [ADR 0002](0002-leads-are-immutable-by-schema.md): replace absolute Lead
  immutability with a narrowly authorized addition within one capture journey.
  The blanket no-update test must become tests of that boundary when implemented.
- [ADR 0031](0031-a-lead-has-exactly-one-origin.md): visitor submission remains
  the only origin, but one journey may contain multiple explicit submissions.
- [ADR 0021](0021-lead-identity-is-computed-not-stored.md): independent captures
  still produce separate Leads. Combining one journey is not person resolution.
- [ADR 0032](0032-consent-capture-is-first-class-in-the-template.md): preserve
  distinct consent evidence and acceptance times for email and SMS.
- [ADR 0059](0059-the-converting-act-belongs-to-the-design.md): the design still
  defines the converting act; its first accepted capture counts once, regardless
  of later submissions within the same journey.
- [ADR 0008](0008-delivery-state-is-destination-health-not-per-lead.md): the
  existing Lead/Destination pair is insufficient to distinguish accepted
  additions. Jobs and recovery must distinguish the submission they act on.

- [ADR 0010](0010-templates-are-configuration-not-documents.md),
  [ADR 0025](0025-cart-recovery-captures-nothing.md), and
  [ADR 0061](0061-the-vocabulary-widens-by-what-the-library-cannot-draw.md):
  submit designs are no longer limited to two screens. Linear screen editing
  belongs in the shared configuration vocabulary; click-only designs retain
  their existing converting-act semantics.
- [ADR 0082](0082-template-packs-install-as-validated-local-data.md): the pack
  validator must adopt the new flow vocabulary and screen limits in the same
  implementation. Unsupported pack structure must still be rejected clearly.

## Implementation boundary

The companion plan specifies the JSON contract, purpose-specific routing,
30-minute memory-only continuation, atomic request receipts, accepted snapshots,
reporting scopes and erasure behavior. These require implementation and real
WordPress verification; the documents do not claim the current runtime supports
them. No cross-visit Contact model, autosave, delayed Smart Sync or generalized
sending policy is added. Exactly-once external delivery is not promised.

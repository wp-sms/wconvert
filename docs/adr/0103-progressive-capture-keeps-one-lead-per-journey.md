# Progressive capture keeps one Lead per journey

Product direction agreed during the [#184 planning interview](../plans/184-progressive-capture.md)
on 2026-09-22 and confirmed after the
[use-case review](../plans/184-progressive-capture/decision-review.md). Implemented on the issue branch; see the
[verification record](../plans/184-progressive-capture/verification.md). Ordinary multi-screen forms save and hand off once
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
remains distinct from a submission. The production JSON contract is `tree.v: 2`.

The approved visual-modal editor (prototype A, 2026-09-23) keeps screen switching
in the existing toolbar and moves journey management into a dialog. Numbered
cards preview the actual screens and identify where a signup is saved. Dragging
and keyboard-accessible move buttons share the same order constraints: the
primary signup precedes the optional signup and the acknowledgement stays last.
Selecting a card exposes its name and completion behavior; editing its design
returns to the full-height canvas. Changes use the existing campaign draft and
Undo history. This changes neither the Template JSON shape nor storage.

The follow-up removes the separate bulk-removal action. Deleting an optional
submission screen removes that declaration, its configured Destination routes,
and screens holding its owned fields/consent. A confirmation names all affected
screens when more than one is involved. Independent content screens stay in
order, and buttons referring to the removed optional signup are cleaned up.
Undo restores the tree and routes together. The primary submission and final
acknowledgement cannot be deleted through this control.

Content-only screens may follow the last submission before acknowledgement;
each requires a visible Next action. This keeps a retained offer reachable after
optional signup removal without adding a capture or changing the submission
boundary. Unowned input/consent remains invalid. The viewport gate is replaced
with an adaptive editor as recorded in [ADR 0038](0038-the-admin-holds-different-floors-to-the-loader.md).

Conditional screens remain a future, separately scoped improvement. The proposed
starting point is “Show this screen when…” based on earlier answers, useful for
qualification and relevant offers. No branching engine, UI, JSON fields or
release commitment is introduced here. A future plan must cover skipped required
fields, consent/submission ownership, Back after changing an answer, and reports
for different paths before implementation.

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
  The source guard permits only the two capture/handoff writers; behavior checks exercise the addition boundary.
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
reporting scopes and erasure behavior. These are implemented and verified on isolated WordPress/MySQL, including
concurrency and interrupted queue handoff. No cross-visit Contact model, autosave, delayed Smart Sync or generalized
sending policy is added. Exactly-once external delivery is not promised.

## Measured byte-budget amendment

Flow identities, field references and distinct Campaign contract fingerprints
are now part of the measured visitor payload. The five-Campaign/reopen fixture
crossed the previous 2,048 B cap (2,129 B even before distinct fingerprint values
were added). The hard page cap is 2,560 B; the derived per-design cap is 1,280 B.
The measurement descends screen wrappers and varies Campaign fingerprints.
This is an explicit implementation tradeoff for the agreed feature, not a claim
that the previous fixture still passes unchanged.

Free retains its 14,012 B loader cap. Paid loaders were capped at 19,456 B (19 KiB).

> **Amended by [ADR 0104](0104-display-workspace-uses-bounded-groups-and-fresh-gestures.md):** With explicit user approval, paid loaders now cap at 20,480 B (20 KiB); other budgets remain unchanged. The measurements below describe progressive capture before Display workspace.

Historical measurement:
shared journey handling plus existing recovery/content-lock code exceeded the
18 KiB limit by roughly 0.6 KiB at Elite. No feature is moved into an unmeasured
lazy download. Final gzip sizes are recorded with verification. These budget
amendments do not authorize any additional database schema change.

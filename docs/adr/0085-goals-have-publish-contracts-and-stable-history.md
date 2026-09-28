# Goals have publish contracts and stable history

Accepted 2026-09-14 after the pre-release Goal, Playbook and Template UX review.

## Decision

Keep Goal → Playbook → Template: business intent, suggested setup, reusable design.
Add an Outcome contract declared by each Goal: required action, capture channel,
optional required handoff, metric label and what that metric does and does not prove.
The design remains the runtime source of the converting act. Compatibility is a
publication requirement, not an alternative runtime detector or a new taxonomy.

Email and lead-magnet Goals require email; SMS requires phone. The field must be
visible on the submitting screen and required. Enquiries require a form collecting
email or phone, with CaptureForm enforcing at least one identifier. Offer Goals
require a click design with a link; cart recovery uses its runtime-injected cart URL.
Lead magnets additionally require a selected dispatchable lead-magnet email
Destination with its required settings completed at REST publication.

**Extended by [ADR 0106](0106-question-journeys-extend-the-paid-loader.md):** Find Match requires a Results screen and allows an anonymous completion. Required contact before results is a request; optional contact after immediate results is a separate marketing signup with consent. The server validates either edited order before publication.

The shared contract drives starting-point facts, fit-first browsing, readiness and
reporting copy. The server checks the final edited tree. Incomplete pairings can
save as drafts. Show all designs remains available, and Templates acquire no Goal
tags. Existing unrelated structural, binding and A/B compatibility checks remain.
**Presentation amended by [ADR 0087](0087-choices-first-details-on-demand.md):**
the Goal is a compact footer control, with metric detail on demand. Full setup
facts are optional; All designs is a toolbar choice. Publication checks are unchanged.

## Evidence, not implied business results

Use Email submissions, Phone submissions, Enquiries captured, Cart return clicks,
Link clicks and Emails accepted for sending. Explain the measured boundary beside
the metric. Submissions are events, not unique subscribers. Clicks are not purchases
or bookings. Mail-service acceptance is not inbox delivery or a file download;
resends can count again. No new downstream attribution is inferred or stored.

Request a consultation becomes a contact-capture Playbook with request acknowledgement.
It no longer files an external booking click under an enquiry-capture Goal.

## History

The Goal is editable until first publication, then fixed even when unpublished.
Variants and test parents also retain their Goal, even before publication. The editor offers Duplicate for another goal:
copy current draft edits into a new unpublished Optin with separate counters,
leaving the original unchanged. Before first publication, changing Goal still saves
the entire draft and resets local Undo history only on success.

The existing published_config snapshot persists on unpublish and proves prior
publication. No table, column, migration or backfill is introduced. This is a
pre-release contract change, not a repair of previously inconsistent fixture data.

## Scope and verification

This amends ADRs 0020, 0043, 0059, 0067, 0069, 0072, 0075, 0076 and 0081 where
they permit history restatement, hide the Goal, or describe advisory-only fit.
Tests cover channel/requiredness/visibility, delivery setup, draft freedom, blocked
publication, history locking after unpublish, and the copied-draft editor flow.

**Completed by [ADR 0086](0086-campaign-setups-explain-handoff-and-format.md):** visible
format selection, Campaign/Campaign setup wording, task-based names/checklists,
explicit service versus Collect only, and separate research implementation status.
Downstream subscription/revenue tracking remains outside this change.

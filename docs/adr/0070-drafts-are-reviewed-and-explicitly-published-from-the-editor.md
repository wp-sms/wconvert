# Drafts are reviewed and explicitly published from the editor

The editor could save a new draft of a published Optin, but neither it nor the
published list row offered a way to promote those changes. Destination setup
also required leaving the draft, and publishing an inline Optin ended without
explaining placement. This completes that part of the
[flow-by-flow journey](../reviews/2026-09-10-flow-by-flow-ux.md), while retaining
the existing draft/published snapshots and optional outbound Destination model.

## Save and publish are explicit, separate acts

**Save draft** writes the working configuration and leaves the published
snapshot unchanged. **Review & publish** checks the current draft and provides
an explicit Publish action in the editor. When edits are unsaved, **Save &
publish** saves them first; a failed save must never publish the older saved
draft. A failed promotion keeps the review and its error available for retry.

The Optins list also offers **Publish changes** for a published or suspended
Optin with saved changes. A suspended Optin remains published; promotion does
not claim to resolve its missing dependency. A draft with no design can be
saved, but publishing it is refused at both REST and repository promotion
boundaries. Normalization and the existing write guards remain in force.

The admin's `has_unpublished_changes` is derived from existing `config` and
`published_config`. It adds no stored flag, column, migration or second cache.
The summary query returns a case-sensitive comparison instead of sending both
JSON documents to the list. It describes saved configuration differences;
unsaved editor changes remain a separate local state. It is not a visual diff
or proof that a saved change affects rendered output.

## Destination setup stays beside the draft

The Destinations tab offers Add, Refresh and per-route Settings. Setup uses the
same schema controls and settings conversion as the existing destination Add
dialog. Add and Refresh sit on this editor region's heading; this is the narrow
placement amendment recorded in [0039](0039-a-screen-is-regions-and-scope-decides-placement.md).

Rows identify the named destination, its provider and its resolved target.
Creating a destination updates the site's list and asks the merchant to select
its checkbox. It never binds the route silently. Binding and removing a missing
reference change this Optin's draft. Saving destination settings changes the
shared site destination immediately, including for published Optins using it;
the dialog and Save action explain that scope. It is not part of draft Undo. Selected ids are undoable draft edits under
[ADR 0075](0075-draft-history-and-template-content-choices-stay-predictable.md); shared destination settings and published configuration are not.

A failed settings save preserves typed values and offers another attempt.
Closing returns focus to Add or the route's Settings control. Refresh does not
leave the editor, and a failed read must not be interpreted as an empty site or
as proof that bound routes were deleted. No test send, re-push or Contact
operation is performed by setup.

## Review states what it can establish

Review connects design, placement/timing, local Lead storage and forwarding to
their editing controls. Missing design/conversion essentials are separated from
warnings. **Presentation amended by [0088](0088-handoff-state-and-required-fixes-lead-the-review.md):**
required fixes lead the recap, while measurement/setup background is optional.
The destination list shows selection state and any unmet Outcome handoff requirement.
Local-only capture remains valid where the Goal allows it; audience Goals require
the explicit choice established in [0086](0086-campaign-setups-explain-handoff-and-format.md).
Known missing routes, unavailable
providers and observed health failures are actionable without claiming that
publication proves delivery. The destination tab also identifies missing accounts.

**Completed by [0074](0074-destinations-declare-requirements-and-show-shared-usage.md):**
providers now declare identifier alternatives, required settings and fields they
use. Review distinguishes a missing required-by-route field from an optional
one, and shares the provider's setting presence rules. WSMS accepts email or
phone and its tags remain optional; MailPoet needs email and a list; lead-magnet
email needs email and a file URL. These are advisory compatibility checks, not
evidence of delivery. Shared-settings setup also names saved draft and live
Optins affected by its independently saved changes.

## Publishing hands off to placement

After promotion, inline Optins receive instructions for the existing **Inline
Optin** block and a copyable shortcode. Copy failure leaves the text selectable.
Published overlays and inline Optins can open the homepage's existing display
inspector when the WordPress settings expose its URL. The link says it checks
the published version in the current signed-in session; it neither previews
draft edits nor simulates an anonymous visitor. Inline forms still need a check
on the actual page where their block or shortcode was placed.

Published means a snapshot is available to the loader. Rules, schedule, visitor
state and placement still determine whether it appears. A local preview, a
published snapshot, a provider push and inbox receipt remain different facts.

## Verification and remaining scope

Exercise draft-save versus promotion, failed save/publish retry, saved-change
indication, empty-design rejection, destination creation without automatic
binding, shared-settings scope, missing-reference cleanup, and placement copy.
Check dialog focus and busy-state behavior in WordPress. Tests and browser
evidence are recorded in the review after they run; this decision claims no
verified provider delivery. Addressable editor URLs and connected capture/recovery
flows are now covered by
[0071](0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md),
including guarded dirty/busy navigation and exact test recipients. Provider
requirements and the bounded MailPoet interest mapping are covered by
[0074](0074-destinations-declare-requirements-and-show-shared-usage.md).

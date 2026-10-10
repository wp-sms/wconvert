# Handoff state and required fixes lead the review

Accepted 2026-09-14, extending the compact, contextual presentation in ADR 0087.

## Decision

Destinations explains the current decision, not the entire integration model.
The two audience collection modes keep short, distinct descriptions. The selected
mode explains who handles messages, or warns against promising automatic sending.
Switching to collect-only still removes selected routes in one undoable draft edit;
that consequence is shown before switching when routes are actually selected.
The redundant local-export paragraph below the choice is removed.

The destination list shows **No destinations selected** or a selection count.
A count is not a readiness claim. Once the list is loaded, the existing Outcome
handoff evaluator supplies any unmet requirement beside the choice. Incomplete
drafts remain allowed; nothing is selected automatically. Loading and failed reads
retain their own states and never imply that routes were deleted. Provider/target
metadata shares a wrapping row; compatibility and availability warnings stay visible.
Historical setup guidance becomes optional **Setup guidance**.

Review puts **Before you can publish** ahead of the recap, with direct actions to
fix each blocker. Design, all four placement/timing summaries, forwarding state and
advisory warnings remain visible. ~~Measurement explanation and setup origin move to
optional **Measurement & setup details**; the Goal stays in the status row.~~
*Amended by [ADR 0138](0138-one-preview-one-review-one-details.md): **Counts as success** — the Goal's number and its
measurement — sits under the thumbnail, never folded away; How it runs replaces
the placement/timing and forwarding sections.*
An unfinished required service choice says **No destination selected. Finish setup
in Destinations.** It must not describe manual export as if collect-only was chosen.
Spacing is reduced without reducing type sizes or hiding publishing controls.

No publication policy, provider capability, shared-settings save scope, capture
behavior, persistence schema or Save/Undo/retry behavior changes. Enquiries can
still remain local; list Goals require a matching service or explicit collect-only;
lead magnets still require their delivery setup. Configuration is not delivery proof.

*Amended by [ADR 0133](0133-a-fresh-setup-has-nothing-to-fix.md): leads stay in
WConvert until a service is connected, so "explicit collect-only" is now the
default rather than a choice the merchant must make, and a lead magnet kept
local publishes with a warning. The review's blockers and advisories come from
one list, `campaignIssues()`.*

## Verification boundary

Interaction tests cover blocker ordering, optional detail disclosure, incomplete
connected-state wording, selection state, no automatic binding, and the collect-only
consequence. Existing save-before-publish, failed-save and failed-publish retry,
shared-settings, unknown-route and Undo/Redo tests remain required.

Inspect the built UI on WordPress, including keyboard disclosure and focus return.
Do not send messages or publish real campaigns merely to verify this presentation.
First-time-user sessions and controlled provider-delivery checks remain separate;
this decision does not claim their results.

# Template JSON contract

These examples mirror the four shipping journey Templates in
`resources/templates/library/`. The production manifest and validator are
canonical. Product decisions are recorded in [ADR 0103](../../adr/0103-progressive-capture-keeps-one-lead-per-journey.md).

| File | Journey | Saving behavior |
|---|---|---|
| `email-only.json` | Email → acknowledgement | One submission |
| `offer-first.json` | Offer → email → acknowledgement | Continue saves nothing; email submission creates the Lead |
| `enquiry.json` | Request → details → acknowledgement | Final submission includes fields from both input screens |
| `email-then-sms.json` | Email → optional SMS → acknowledgement | Email creates the Lead; SMS adds to it; Skip keeps the email capture |

`campaign-settings.json` supplies example local-only Campaign handoff settings for those four designs. `manifest-flow.json` mirrors the flow section of the shipping manifest. It defines the closed
choices used below; it is not a second permanent vocabulary to maintain.

The sample consent sentences illustrate separate channels. Final library copy
must include the merchant's configured policy links and purpose-specific wording;
these examples do not establish provider subscription or delivery.

## Structure

`tree.v: 2` marks the supported format. Convert all unreleased bundled
Templates and pack fixtures directly; do not add a legacy reader.

`tree.steps` becomes a list of screen wrappers:

- `id`: stable identity for editor selection, references and reporting. Reorder
  retains it; duplication creates a fresh identity.
- `name`: merchant-facing editor name, not visitor-facing copy.
- `kind`: `content`, `input`, or `acknowledgement`.
- `content`: a root layout using the existing node vocabulary and token bags.

`tree.submissions` describes explicit submissions independently of screen count:

- `id`: stable identity, referenced by a Submit button and Campaign handoff bindings.
- `required`: whether the journey must accept this submission before finishing.
  The first submission is required; later channel additions can be optional.
- `fields`: stable IDs of the field nodes belonging to this submission. The
  enquiry example references a field on the previous screen as well as the
  final screen. Canonical field names still come from the manifest.
- `consents`: stable IDs of consent controls available to this submission.
  Campaign setup reveals and requires the matching marketing control. A request
  may use a notice without marketing consent. Purpose is derived from the Campaign Goal and submission order, not inferred from sample Template wording.

The declaration order of submissions must match their Submit screens. There is
no route language or conditional graph. Screen order supplies forward navigation.

An ordinary journey has one required submission, with all input screens before
it. The optional-signup journey has exactly two: a required primary email/SMS
signup and one optional signup for the other channel. No arbitrary third save,
autosave, or configurable per-screen sending policy is included.

## Actions

| Button action | Meaning |
|---|---|
| `next` | Validate visible unsaved inputs and advance. Never send capture data. |
| `back` | Review the previous screen. Restore unsaved values; show submitted ones read-only. |
| `submit` plus `submission` | Validate and save the declared submission. Advance only after server confirmation. |
| `skip` plus `submission` | Decline the named optional submission, discard its unsaved answers, and move after that submission's Submit screen. |
| `close` | Explicit dismissal. Never creates a Lead or reverses an accepted submission. |
| `link` | Existing converting external link, allowed only in a click-only design. |

Resource follow-up links retain their non-converting meaning. They must not be
represented as `action: link` on a converting button in a capture journey.

A committed Submit screen, revisited through Back, displays a read-only summary
and Continue rather than allowing another edit or sending another request. The
runtime derives this from the accepted submission; it is not a second saved node.

Skip names a submission rather than assuming that one screen is the whole
optional step. An optional submission may span a contiguous group of screens;
Skip bypasses that group and clears its unsaved fields/consent. Required enquiries
can also span several screens before one final submission. Groups cannot overlap
or interleave. The explicit submission reference keeps this a linear journey,
not a conditional route graph.

## Validation rules

1. Stable IDs are unique within each namespace; every field and consent reference
   resolves once. Submission IDs and screen IDs remain stable across reorder.
2. Every captured field belongs to exactly one submission. A canonical field
   name occurs only once per journey; a later phone submission cannot replace
   an earlier email or another phone. Duplicate screens must resolve repeated
   canonical fields before publication.
3. All fields/consents owned by a submission appear no later than its Submit
   screen. A required field cannot be bypassed by navigation or optional Skip.
4. A submission has one Submit screen and one declared primary Submit action.
   Optional groups include visible Skip actions referencing that submission.
   A Skip cannot target an earlier, required, or already accepted submission. Content
   screens contain no captured fields or consent controls.
5. At publication, the first submission includes a required valid identifier
   and satisfies the Campaign's primary Goal. The optional addition is for the
   other marketing channel and has its own channel-specific requirements.
   An SMS marketing addition requires its own phone and consent acceptance.
6. Campaign-resolved marketing consent is visible and contains usable wording
   before publication. Request-purpose contact collection does not imply marketing
   permission, even when the Lead contains a phone number.
7. A capture journey ends with a single acknowledgement. It contains no inputs or
   submissions. It is unreachable until the required submissions are accepted.
   Visitors may dismiss without reaching it; already accepted captures remain.
   Click-only designs retain one content screen, no submissions, and no
   acknowledgement; their existing converting-link behavior is unchanged.
8. Reject unknown actions, references, unsupported versions, hidden required
   controls, mixed converting link/capture behavior and unreachable progress.
   Drafts can be incomplete with actionable readiness messages; publication and
   pack installation require a complete valid flow.
9. Capture journeys allow six pre-acknowledgement screens and at most two
   submissions. Keep existing node/depth/byte bounds until representative
   designs and loader measurements justify changing them.
10. Publish an explicit flow capability with the new tree format. Packs must
    declare what their actual content uses; unsupported flows fail before any
    normalization, preview, registration, or installation.

## Campaign data stays separate

A Template supplies reusable structure. Purpose, site-specific Destination IDs
and credentials do not belong in Template JSON or downloadable design packs.
Campaign `submission_settings` uses submission IDs as keys; each entry declares
`purpose` and existing `destination_ids`. The closed purposes are `request`,
`email_marketing`, and `sms_marketing`. The first must satisfy the Campaign Goal;
an optional second is the other marketing channel. Setup supplies those purposes
and reveals the corresponding consent controls. A Template never acquires a Goal
tag because it contains an email field or sample newsletter copy.

`capture_mode: local` deliberately keeps accepted captures in WConvert; the
examples have no Destination IDs. Connected Campaigns select valid routes for
each offered purpose. The editor presents primary and optional-channel handoff
settings and explains when they run, without a general workflow builder.

A single-submit request may contain both email and phone as contact details.
That alone claims neither email nor SMS marketing consent. In the initial
optional-signup experience, the other channel is offered as its own explicit
submission; dual marketing signup in a single request is not a new mode here.

Applying a different Template must preview changed submissions, consent scope,
handoff bindings, and required fields. Do not preserve an old email route by
array position if the replacement first screen now submits SMS. Screen/submission
copy binding needs stable scope as well as Slot Role, especially for repeated
headlines, CTAs and consent wording.

## Manifest changes required during implementation

- Add a manifest-owned flow section defining screen kinds, submission purposes,
  action enums, limits, and the capability identifier. Readers and generated
  authoring docs consume this one vocabulary.
- Expand button parameters with `submission`; enumerate supported actions and
  retain clear distinction between navigation, capture and converting links.
- Keep existing layouts/content/style tokens; wrap roots in explicit screen
  records and update all tree walkers to visit `step.content`.
- Update PHP normalization/validation, shared TypeScript types, labels, editor
  controls, renderer, capture server and pack validation in the same feature.
- Update all shipped Free/Pro JSON, Playbook binding, generated packs and
  `tools/design-library/build/vocabulary.mjs`. Regenerate `out/VOCABULARY.md`.
- Replace fixed-two-screen checks in template verification and design review.

Do not copy these proposed fields into the production manifest in isolation:
its readers currently treat any non-link button as a submission and infer the
whole form from that button's screen. The coordinated implementation is part of
the plan, not an optional follow-up.

## Copy and Destination scope

For journeys with more than two screens, Playbook copy uses `copy.screens`.
Keys such as `submission:email`, `submission:phone`, `screen:offer`, and
`acknowledgement` preserve distinct screen wording. Navigation uses
`next_label`, `back_label`, `skip_label`, and `close_label`; only Submit uses
`cta_label`. Copy from one channel must not become the other channel's consent.

The primary submission uses existing `config.destinations`. Only the optional
submission uses `config.submission_settings[submissionId].destination_ids`.
Purpose is server-derived, never a merchant-supplied permission flag. Local
capture sends neither submission to an external Destination.


### Editor follow-up

Screen management uses the approved visual modal. The editor adapts to narrow
windows with settings/layers drawers; there is no 782px loading gate. Deleting an
optional submission cleans up its owned screens and delivery settings while
preserving independent content. Content-only screens may follow the final
submission if they have a visible Next action to continue toward acknowledgement.
The JSON remains v2; these screens still use the existing `content` kind and
`next` action. See ADR 0103 and the verification record for the deletion and Undo
rules. Conditional screens remain outside the implemented linear model.

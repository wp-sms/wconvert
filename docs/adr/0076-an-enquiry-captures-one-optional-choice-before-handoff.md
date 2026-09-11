# An enquiry captures one optional choice before handoff

A business collecting quote requests needs to know what the visitor wants as
well as how to reply. Calling that request an email subscription obscures the
purpose of the form. WConvert remains the capture and display layer: it records
the request and can pass details to a configured service. It does not become an
inbox, a contact database, a quotation tool or a job tracker.

This completes the bounded qualification slice of the
[flow review](../reviews/2026-09-10-flow-by-flow-ux.md). It adds one named choice
field and a starting point that demonstrates it, using existing snapshots and
the Lead's existing `fields` JSON. There is no table, column, index, stored
person, delivery ledger or additional analytics dimension.

## The Goal names a captured enquiry, not completed work

`Goal::CollectEnquiries` is the sixth closed enum member. It is free, available
standalone, and counts `conversion`, just as the other non-delivery Goals do.
It cannot count a reply, a sale or a completed service. The existing
`grows_a_list` advisory also covers this captured-details outcome: a design
that captures nothing gets a warning. The Goal does not introduce a design
filter or an act restriction under
[0059](0059-the-converting-act-belongs-to-the-design.md).

**Request a quote** uses the free, Goal-agnostic inline **Choice card**. Email
is required; name and service choice are optional. The explicit `page_load`
trigger makes it available where the merchant places the WConvert block or
shortcode. The starting-point notes explain placement, editing the services,
and the remaining destination setup. Prefill binds no shared destination.
The terminal screen says **Request received**, not that a quote was prepared
or that anyone has replied. Privacy wording concerns this request rather than
claiming a marketing subscription.

## One question, with stable answers and editable labels

The existing `field` node gains the single canonical name `interest`, rendered
as a native single-choice `select`. It is not an arbitrary field-name registry,
free-text message, multi-select or nested questionnaire. Its question label,
empty-option prompt and `required` flag use the existing field properties.
The default is optional; a merchant can require the answer.

```json
{
  "type": "field",
  "name": "interest",
  "label": "Which service do you need?",
  "placeholder": "Choose a service",
  "required": false,
  "options": [
    { "value": "installation", "label": "Installation" },
    { "value": "repair", "label": "Repair" }
  ]
}
```

The manifest's `field_options` declares the bounds: at most 12 choices,
nonempty labels of at most 120 Unicode characters, and unique values matching
`^[a-z][a-z0-9_-]{0,47}$`. The options container is a list. The normalizer drops
malformed entries, including invalid UTF-8 labels; editor and REST create/update
saves refuse malformed entered lists before normalization can discard the
merchant's work. An intentionally empty or absent list remains saveable as an incomplete
draft. Publication requires at least one valid choice and an email or phone
field on the submitting screen; a name or interest alone is not a Lead identity.

The editor shows labels first and exposes the stable value under **Sent as**.
Renaming a label keeps the value. Editing the value is explicit and affects
future submissions; no stored Lead is rewritten. Choices can be added, removed
and reordered within the same draft history as other content.

`options` is content, including both each value and its label. The derived
Slot Roles are `interest_label`, `interest_placeholder` and `interest_options`.
A Playbook binds the last as a named wrapper:

```php
'interest_options' => ['options' => [
    ['value' => 'installation', 'label' => __('Installation', 'wconvert')],
    ['value' => 'repair', 'label' => __('Repair', 'wconvert')],
]],
```

That wrapper distinguishes one structured list from repeated Role values under
[0051](0051-a-slot-role-repeats-and-binds-in-order.md). `SlotRoles::copyFrom()`
preserves it for binding and design changes. Labels localize; stable values do
not. A compatible design receives both. A design without that Role cannot
carry the answer choices; the Keep/Sample preview and Undo boundary in
[0075](0075-draft-history-and-template-content-choices-stay-predictable.md)
make that content decision reviewable. Library changes never rewrite a saved
Optin's choices.

## The published form authorizes the local capture

The browser posts the selected stable value. `CaptureForm` validates it against
the published submitting screen, not the editor's draft or a browser-supplied
label. A missing optional answer is omitted; a required empty answer or a value
outside the published choices is refused beside the select. A field absent
from that form is not accepted as an extension. Email or phone remains required
for every accepted Lead, even if the field flags individually permit blanks.

An accepted answer stores `interest` plus `interest_label`, taken from the
published choice definition at capture, in the existing immutable Lead JSON.
Later label changes do not change this evidence. Capture history shows the label
and sent value; CSV exports both. Neither changes identifier grouping, consent
evidence, submission counts or Contact state.

The select participates in the native first-invalid focus path and the existing
inline server refusal path. It is disabled while a request is pending and
restored on failure without losing its value. The 15-second timeout, unknown
result wording and explicit retry behavior remain those of
[0073](0073-capture-acknowledgement-is-not-provider-confirmation.md).
There is no third error screen and no automatic resend.

## Forward only what the receiving adapter declares

[0074](0074-destinations-declare-requirements-and-show-shared-usage.md) supplies
the adapter requirements and mapping contract. MailPoet's optional **Save
interest in MailPoet** setting selects an existing custom text field. It sends
the stable `interest` value, not `interest_label`, on new-subscriber creation
only. Existing subscribers and create-race matches retain all existing fields.
An unavailable configured mapping with an answer fails for retry; it is not
silently discarded. WSMS and lead-magnet email do not forward interest. Local
capture and its export remain available regardless of destination support.

A test send may contain an optional stable interest value explicitly typed by
the merchant when the saved route has a mapping. Nothing invents one from a
profile or Playbook. This is a real destination test, not a visitor submission:
it writes no Lead, queued job, health update or conversion counter. It cannot
prove subscription, future updates to existing subscribers or inbox receipt.

## Verification and source boundaries

Tests cover the Goal contract, bundled translation, choice normalization,
published-form validation, canonical identity, label/value capture, CSV,
Slot Role round trips, same/different design snapshots and publication guards.
Adapter tests cover explicit mapping and unchanged existing subscribers.
Final integrated and WordPress evidence belongs in the flow review; mocked
provider tests do not establish a live provider send.

Sources: [Goal](../../src/Goal/Goal.php),
[manifest](../../resources/templates/manifest.json),
[choice normalizer](../../src/Template/ChoiceOptions.php),
[capture validation](../../src/Lead/CaptureForm.php),
[publication structure](../../src/Template/TemplateForm.php),
[choice inspector](../../resources/admin/src/builder/InterestOptions.tsx),
[Playbook](../../resources/playbooks/request-a-quote.php),
[design](../../resources/templates/library/inline-choice.json).

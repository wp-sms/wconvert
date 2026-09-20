# Capture acknowledgement is not provider confirmation

**Extended by [ADR 0102](0102-content-lock-is-an-optional-inline-capture-journey.md):** an acknowledged local capture can reveal an owned WordPress content region and remember access. An unconfirmed capture opens a readable fallback without claiming success or provider confirmation.

The visitor's form completes when WConvert acknowledges its local [[Lead]]
capture. A queued [[Destination]] push happens separately. The success screen
must not turn that acknowledgement into a claim that an email arrived, a file
was delivered, or a [[Contact]] became subscribed or confirmed.

This decision completes [ADR 0044](0044-there-is-no-visitor-facing-error-state.md)
and the field feedback in [ADR 0032](0032-consent-capture-is-first-class-in-the-template.md).
It retains the existing email, phone and name fields, native form constraints,
server canonicalisation, two-step submit design and outbound Destination model.
It adds no field kind, schema, storage, confirmation flow or provider-status read.

**Extended by [ADR 0076](0076-an-enquiry-captures-one-optional-choice-before-handoff.md):**
the later qualification slice adds one named `interest` select with bounded
stable values and editable labels. It shares this feedback and acknowledgement
contract, stores its answer in existing Lead JSON, and does not add a Contact
lifecycle or a provider-confirmation claim.

## Acknowledge the request that was captured

Shipped success copy says what is known: **Request received**, **Thank you**, or
**We have received your request for the guide**. The offer may still be specific,
and a button may ask to send a guide or join a list. Those are requests; the next
screen must not claim their downstream fulfilment. **You are subscribed**,
**Your code is on its way**, and a guaranteed inbox-arrival time are not capture
acknowledgements. Provider-owned confirmation and subscription settings remain
outside WConvert under [ADR 0016](0016-wconvert-never-confirms-an-optin.md).

A code actually displayed in the success step may be described as being here.
Its presence does not prove the merchant has created a valid coupon. An offer
fulfilled by a Destination needs that route and its resource configured;
Playbook setup notes state those prerequisites without claiming they are done.

These copy corrections change shipped library examples and the words used when
creating new drafts. Existing Optins retain their saved copy and snapshots;
there is no bulk rewrite of merchant text or published designs. The success
copy inspector explains what the screen acknowledges so a merchant can review
their own wording. Runtime field and capture handling improvements apply to
existing forms without changing that saved copy.

## A label survives the example inside the field

The editor calls the existing properties **Field label** and **Example inside
the field**, and explains that an example disappears while typing. A rendered
field with a missing or whitespace-only label gets its kind's fallback name:
Email address, Phone number or Name. Required fields keep the native `required`
attribute and gain a visible asterisk; the asterisk is hidden from assistive
technology because the native constraint already conveys the requirement.

The interest field's fallback is **Interested in** (ADR 0076), with a named
empty-option prompt rather than a text-input example. It has a visible label
and a native single-choice select; option labels are rendered as text.

Input types, input modes and autofill tokens follow the existing field kind.
Email and phone turn off autocapitalisation and spellcheck. Phone guidance asks
for a country code and gives an example; the browser does not guess a country
or replace the server's canonicalisation contract
([ADR 0021](0021-lead-identity-is-computed-not-stored.md)).

Field-only rows retain visible labels. A compact row containing a direct button
may visually hide the labels of its direct fields when those fields have a
non-empty placeholder. The labels remain accessible, and fields without an
example remain visibly labelled. At container widths of 24rem and below those
compact labels become visible again. This is renderer behaviour, not a new
template property or a merchant-controlled accessibility switch.

## Refusals stay with the form and preserve its values

Native browser constraints still prevent submission. Their browser-localised
validation message appears beside the first invalid field, which receives
focus. Server refusals attach to the named field or consent checkbox when one
is available; other failures appear at form level. The message is an alert,
uses `aria-invalid` and `aria-describedby` for the affected field, and preserves
any pre-existing description. Editing that field clears its reported error.
Required-field server messages identify the detail that needs attention.

This is capture error handling, not a third state the merchant must design.
The public endpoint still enforces required fields, consent and canonical
identifiers; browser checks improve correction in place and cannot authorise a
capture. A refused submission keeps the visitor's entered values.

While a request is pending, the form announces busy state, the submitting
controls are disabled, text fields are read-only and consent checkboxes and
choice selects are temporarily disabled (ADR 0076). Values are gathered before those changes. A sending
indicator accompanies the button and respects reduced motion. Resolution
restores the controls that this request changed; a failure leaves the form
available for correction or an explicit retry. There is no automatic retry.

## An unknown result must remain unknown

The browser aborts its capture request after 15 seconds. Only a successful HTTP
response containing a JSON object with a non-empty string Lead `id` completes
the form. A malformed or missing response body must not fabricate success or
record a client-side conversion.

A timeout, rejected request or unrecognised response says **We couldn't confirm
your submission. Please try again.** That wording does not assert that the
server wrote nothing: aborting the browser request cannot roll back a capture
that already committed. The visitor can retry, and a repeated accepted request
can create another Lead because captures are not deduplicated. This adds no
idempotency protocol and makes no claim about eventual Destination delivery.

Sources: [capture](../../resources/loader/src/capture.ts),
[field renderer](../../resources/renderer/src/render.ts),
[shared renderer CSS](../../resources/renderer/src/css.ts),
[capture refusals](../../src/Rest/CaptureController.php),
[slot inspector](../../resources/admin/src/builder/SlotFields.tsx),
[design guidelines](../../tools/design-library/GUIDELINES.md).

# Considered essentials — 19 October 2026

## Scope and judgement

Two existing designs were polished: **A quieter frequency** (maker newsletter)
and **Name and email** (resource requests and consultation). One distinct new
composition, **Availability desk**, was added for an optional timing preference
and enquiry. Two new setups address an earlier-appointment enquiry and an equipment
return checklist. The return setup deliberately reuses the guide composition;
it is not counted as another design.

The affected batch is six setups, three designs and twelve screens. The scope
planner also inspected registered Playbooks outside the curated studio. There
are no additional dependents and no affected published collections. Unrelated
stale reviews remain a backlog, not approvals granted by this work. No renderer
or production runtime changed.

Changes after the first visual pass: reduced field/button rounding on the new
form, made receipt Close a secondary action, improved narrow guide padding, and
removed the maker's gradient/decorative treatment in favour of a solid plum
surface and clearer grouping. A final stress pass also moved the guide family’s
optional consent before the primary action. Its four dependent setups were then
recaptured at all preview widths and submitted again in native desktop/phone
WordPress. Final capture ledgers follow those edits. The audit's
forced-consent stress mode now provides sample wording when a normally hidden
consent leaf has empty prepared copy; this changes the review surface only.

`proof.json` records the exact current campaign revisions, screen IDs, screenshot
hashes and a written composition judgement for each setup. The checker requires
all twelve screens at four studio widths and two native WordPress widths (72
screen/viewport records). It cannot judge beauty or prove that a reviewer looked;
the inspection described below supplies that judgement.

## Visual inspection

- Viewed both screens of all six setups at 320, 390, 768 and 1440px in the batch
  audit. Files `<setup>-<width>.png` contain the input and acknowledgement together.
- Viewed all six at 320px with RTL direction and longer headings, body and CTA
  copy, including forced visible consent. These are layout stress tests using
  English sample text, not linguistic validation of an Arabic translation.
- Viewed real mounted WordPress input and acknowledgement output at 1280×900
  and 320×740. Files `<setup>-native-<width>-input.png` and `-success.png`.
- Availability's real form was inspected at 623 and 625px browser width: one
  column immediately before the transition, two aligned fields immediately after.
- Checked a 320×568 rental popup: the inner surface scrolls to the fields/action,
  invalid email remains on the input screen, and Escape dismisses the popup.
- Verified both new setups appear under the correct goal in the actual WordPress
  creation flow and inspected their setup-detail previews.

The result has consistent field/action grouping, restrained typography, adequate
field outlines, readable fine print, no floating decorative icons, and truthful
acknowledgements. Long rental CTA text wraps inside its button without clipping.
The navy form has a distinct header/form arrangement; the warm serif resource
family is intentionally shared. All form inputs are at least 16px and form
inputs/actions at least 48px in the measured cases.

`measurements.json` contains 192 cases: six setups × two screens × four widths ×
two directions × normal/long copy. There were **zero horizontal overflow,
composition, solid-colour text contrast or field-outline contrast failures**.
The generic 44px control warning flags 160 popup cases because the shared
fine-pointer Close control is 32px. That renderer control already expands to
44px for coarse pointers; it was not changed or waived as a new template issue.
This run did not emulate a physical touchscreen. Short-height scrolling was
checked separately in mounted WordPress.

## Visitor journeys and WordPress

The reusable `tools/visual-tests/mu/template-batch.php` fixture was mounted in a
fresh localhost WordPress Playground with the existing harness. The fixture uses
real Prefill, publication and local Lead capture. It deliberately overrides
placement/trigger/targeting to isolate the design, and selects local capture.
No external email service was connected; the harness suppresses outbound mail.
This does not test the suggested 20-second trigger or real resource delivery.

- All six setups rejected empty required email on desktop, then reached their
  acknowledgement after a real local submission at desktop and phone widths.
- Optional names were left empty successfully. The appointment preference was
  tested empty, with Weekdays, and with Either works. A local database summary
  confirmed captured Leads and both stable preference values (`weekday`,
  `flexible`). Only counts/booleans were exported, no contact records.
- `native-journeys.json` records twelve successful native submissions. The
  capture summary includes manual transition/preference checks and final
  resubmissions after the consent-order refinement.
- `simulated-retries.json` records all six studio failure/retry journeys. On
  simulated failure the form stayed visible with its entered values; retry
  reached the correct acknowledgement. `*-retry.png` shows the retained state.
  These are explicit simulations, not a provider outage test.
- Tested the native inline receipt's Close action and popup Escape dismissal.
- Tested malformed email on the short rental popup; browser validation blocked
  submission and scrolled the email field into view.

Merchant prerequisites remain explicit: a monitored follow-up process for
appointment enquiries; a useful checklist and configured resource email for
returns. Neither setup promises a queue position, appointment, collection or
completed return. The resource request does not subscribe the visitor to a
newsletter. This review does not establish conversion lift, provider delivery,
physical-device behaviour or coverage of the unrelated older-library backlog.

## Local checks

- `composer verify:templates`: 108 designs survive registration.
- `composer verify:source`: clean Free/Pro source contract.
- `composer test`: 3,382 tests / 19,274 assertions passed.
- Initial `npm test`: 4,478 passed, one builder test hit its five-second timeout
  while other work was running. Its isolated rerun passed all 85 tests. A second highly parallel run
  also encountered timing failures in unrelated builder tests. The final run
  limits concurrency to two workers; its outcome is recorded in `checks.txt`.
- Template-studio tests cover dependency scope, result enumeration, missing
  evidence, changed screenshot bytes and stale campaign revisions.
- Proof and scope tools do not write approvals. Reviews are imported only through
  the existing revision-bound importer; existing collection gates remain intact.

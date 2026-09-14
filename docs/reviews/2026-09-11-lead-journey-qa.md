# Lead journey QA checkpoint — 2026-09-11

Scope: Phase 5 verification of the existing capture → local Lead → queued Destination path. No schema, field, loader, or original Optin/Destination/provider setting was changed. One contained visitor submission used only disposable QA objects and the synthetic `.test` recipient below.

## Evidence completed

- **Form validation:** `CaptureForm::fromTemplate()` derives the submitting step from the published template and `validate()` rejects missing required fields, non-canonical email/phone, missing identifiers, and any consent value other than JSON `true` ([src/Lead/CaptureForm.php](../../src/Lead/CaptureForm.php:65)). The REST controller re-reads the published Optin and returns 422 refusals or 201 with the new Lead id ([src/Rest/CaptureController.php](../../src/Rest/CaptureController.php:79)). Empty/invalid submission, typed-value preservation, and refusal copy were covered by source and focused unit/UI tests; they were **not separately browser-tested** during the one-valid-submit run.
- **Browser capture seam:** the loader posts JSON to PHP's `data-capture` endpoint; it suppresses duplicate in-flight submits, renders server refusal text, and only advances to the terminal step after an HTTP success ([resources/loader/src/capture.ts](../../resources/loader/src/capture.ts:55), [resources/loader/src/present.ts](../../resources/loader/src/present.ts:109)).
- **Saved Lead:** `LeadCapture::record()` writes the row first, then fires `wconvert_lead_captured`; downstream exceptions are caught after the Lead exists ([src/Lead/LeadCapture.php](../../src/Lead/LeadCapture.php:41)).
- **Queue:** `PushDispatcher::dispatch()` reads published Destination bindings and enqueues only the Lead id, Destination id, and attempt; `PushWorker` re-reads both rows, then applies retry/health/failure handling ([src/Destination/PushDispatcher.php](../../src/Destination/PushDispatcher.php:64), [src/Destination/PushWorker.php](../../src/Destination/PushWorker.php:73)).
- **MailPoet adapter:** email-less Leads are skipped; an unconfigured list is retryable; provider errors are retryable; matching subscribers gain only missing list memberships and are never lifecycle-mutated ([src/Destination/MailPoet/MailPoetDestinationType.php](../../src/Destination/MailPoet/MailPoetDestinationType.php:209)).

## Tests

Focused PHP tests: **106 tests, 250 assertions, all passed**.

- Lead form/capture/identity/immutability tests: 73 tests, 125 assertions.
- Destination MailPoet/queue/health/standalone/test-send tests: 31 tests, 115 assertions.
- Free capture-path contract: 2 tests, 10 assertions.
- Focused Vitest suites: **92 tests, all passed** (`loader-capture`, renderer consent parity, destination test API/UI, leads API).

These are unit/UI stubs and do not prove that WordPress or MailPoet accepted a real subscriber.

## Read-only real WordPress checkpoint before the run

Site: `http://wconvert.local`.

- WConvert Leads screen showed **0 submissions** and “No submissions yet.”
- Action Scheduler search for `wconvert_push_lead` showed **No items found**.
- Destinations screen showed the two existing destinations, both “Not used yet”: `MailPoet, Newsletter` targeting the `Newsletter` list, and `MailPoet — Product updates` targeting `Product updates`.
- The MailPoet Lists admin route redirected to MailPoet’s setup landing page; list names were still visible through WConvert’s read-only destination settings.
- Optins remained at six total: one published with saved unpublished changes and five drafts.
- The WConvert Local Mailpit is reachable at `http://127.0.0.1:10050/`; it held one recent MailPoet delivery-check message to the local `dev-email@wpengine.local` address. The separate `:8025` Mailpit held unrelated historical mail and is not the WConvert transport.

## Contained real end-to-end run

The controlled run used CLI backend APIs: MailPoet `addList`, WConvert `DestinationStore`, `OptinRepository` with the `centred-card` capture template and `page_load` rule, and `wp_insert_post` for the isolated page. It created a dedicated MailPoet list (`id=6`), WConvert MailPoet Destination (`01M27BKSFD3C9GN35TB4QF0T6V`), published disposable Optin (`01M27BKSFG1ZNQC59S7AGPNXDH`), and isolated page (`id=20`, `/wconvert-journey-qa-20260911/`). The visitor submit itself was performed through the normal browser UI (CUA). Baseline immediately before setup was **0 Leads, 0 matching queue actions, 6 Optins**.

The normal visitor page showed the required email field and `Send my code`. One submission with `wconvert-journey-20260911@example.test` changed the terminal UI to **“You are on the list”** / **“Your code is on its way to your inbox.”** **Actionable UX finding:** “Your code is on its way to your inbox” implies delivery even though this WConvert destination only adds a MailPoet subscriber and MailPoet confirmation was still pending. The configured `signup_confirmation=true` left the real subscriber `unconfirmed` with `confirmed_at=null`; this copy needed a separate UX change. **Closed:** ADR 0073 and subsequent
library curation replaced bundled confirmation/delivery claims with capture
acknowledgements. Existing merchant snapshots were deliberately not bulk rewritten.

Evidence after the visitor request:

- WConvert admin Leads showed **1 submission**, the exact synthetic email, the disposable Optin, and captured time `2026-09-11 04:29:41`.
- The real Action Scheduler row was action **625**, created from `wconvert_push_lead`, initially pending and then **Complete via WP Cron** at `2026-09-11 04:30:02`. Its arguments were only `lead=01M27BMZ52JHCZC6BQSHJS5PXG`, `destination=01M27BKSFD3C9GN35TB4QF0T6V`, `attempt=1`; no email or other Lead fields were present.
- MailPoet API returned subscriber **4**, exact email, status `unconfirmed`, and list membership `segment_id=6`, status `subscribed`. The WConvert destination health recorded `last_success_at=2026-09-11 04:30:02`, no error, and zero consecutive failures.
- CUA inspection of local Mailpit `:10050` showed a real message to the synthetic recipient with subject **“Confirm your subscription to wconvert”** and a confirmation link. The message was deleted afterward through Mailpit UI; the unrelated delivery-check message remained.

## Cleanup and residuals

The exact disposable page, destination, destination-health entry, completed Action Scheduler action, Lead row, MailPoet subscriber, MailPoet list, and Mailpit confirmation message were removed. The original six Optins, original two Destinations, original `Newsletter`/`Product updates` MailPoet lists, settings, and unrelated Mailpit message remain. Post-cleanup verification returned **0 Leads**, **0 `wconvert_push_lead` actions**, two original Destinations, six visible Optins, and no test subscriber/list.

WConvert intentionally soft-deletes Optins and never deletes their analytics counters. The disposable Optin remains as one soft-deleted row (`deleted_at=2026-09-11 04:33:33`) with two immutable stats rows for `2026-09-11`: `impression=1`, `conversion=1`. Existing milestones were unchanged (`first_publish=2026-09-10`, `first_edit` already present for `read-to-the-end` design). These are the only residual QA artifacts and were preserved per the domain rules.

The repository’s `bin/verify-destinations.php` remains unsuitable for this live install because it writes temporary MailPoet lists/destination options and creates/deletes Leads; it was not run.

## Interest journey/editor QA — disposable run

This follow-up used only the disposable objects below; the original six Optins, original Destinations, and shared settings were not edited.

- **Setup:** Optin `01M27GC94CNGQ49VZ8GAKS3STW`, created through the actual WConvert UI (`Create an Optin` → `Collect enquiries` → `Request a quote`), then renamed to `QA — Enquiry journey 2026-09-11`. Destination `01M27FZV1BN5SYMMMP2WSPEZ2V` was the only checked destination and targets the disposable MailPoet list `7`, with interest mapped to custom text field `cf_1`.
- **Editor checks:** draft Undo/Redo reverted and restored the name, “When it appears” rule, and destination binding. Choice options remained `Installation`/`Repair` with values `installation`/`repair`. Design preview covered kept content and sample content on desktop/mobile Form and Success screens. A Heading size custom CSS value applied on Enter; a second typed value was committed by clicking `Save draft` while the field was still active. The override was cleared/reverted to the design value before publish. The review dialog confirmed Name, Email address, Interest (choice), the disposable destination, and the final rule. Only this Optin was published.
- **Visitor UI:** isolated page `23`, `http://wconvert.local/wconvert-enquiry-qa-20260911/`, rendered the form on desktop and at 390×844 mobile. One valid desktop submission used name `Enquiry QA`, recipient `wconvert-enquiry-20260911@example.test`, and interest value `repair` (label `Repair`); the form advanced to “Request received” / “Thank you for getting in touch. We have received your quote request.”
- **Timing note:** the initial “once they have read a while” rule did not render the form during the short page check. That rule was changed only on the disposable Optin to “Shows immediately” (the old time trigger remains displayed as a non-running extra trigger), then saved and published before the single submit. This is a contained setup adjustment, not a production rule finding.
- **Backend evidence:** WConvert Lead detail `01M27GV770REQM63MR5J3EMSXW` shows `Interest: Repair` and `Sent value: repair`; CSV contains the same value/label. The natural Action Scheduler run completed in one attempt (action `663`). MailPoet accepted subscriber `5` into disposable list `7`, and saved the stable interest value `repair` in custom text field `cf_1`, and local Mailpit received the expected confirmation message. Empty/invalid browser submission was not repeated in this run; focused unit/loader tests cover that path. Exact backend verification and completed cleanup are recorded below.

## Final read-only UI and popup checks

- The WConvert Leads screen showed one submission with the synthetic email and disposable Optin. Expanded captured details showed the exact `Repair` label and `repair` sent value.
- The QA MailPoet destination screen showed `Delivering`, its last successful push, and `Optins using this destination → QA — Enquiry journey 2026-09-11 → Live and saved draft`. No destination settings were changed or saved during this inspection.
- Popup fixture `popup-regression.html?width=80%25&version=4`: desktop viewport `1512×806` measured `{left:151.203125, top:282.0703125, width:1209.59375, height:241.859375}`; mobile `390×844` measured `{left:39, top:221.390625, width:312, height:401.21875}`. Both are centered and preserve the expected side gutter. Close button, Escape, and backdrop dismissal each removed the popup.
- Tall fixture `?tall=1&version=4`: desktop measured `{left:548, top:60.453125, width:416, height:685.09375}`; mobile measured `{left:16, top:63.296875, width:358, height:717.3984375}`. Long content scrolled inside the panel in both viewports. The temporary viewport override was reset and disposable visitor/fixture tabs were closed; original editor tabs remained untouched.


## Interest journey — exact backend evidence and completed cleanup

This is the separate enquiry run above, following the earlier lead-journey
checkpoint without changing its evidence. Times below are UTC.

The single browser submission created Lead `01M27GV770REQM63MR5J3EMSXW` at
`2026-09-11 06:00:29`, for disposable Optin
`01M27GC94CNGQ49VZ8GAKS3STW`. It stored name `Enquiry QA`, email
`wconvert-enquiry-20260911@example.test`, `interest=repair`, and
`interest_label=Repair`. The stable value and captured label matched the
published form’s **Which service do you need?** choice. Production `LeadCsv`
output preserved `name`, `email`, `interest=repair` and `interest_label=Repair` in
separate cells; phone and consent-text cells were empty because this submission
supplied neither.

Action Scheduler action `663` completed naturally in one attempt, with only the
Lead id, destination `01M27FZV1BN5SYMMMP2WSPEZ2V` and attempt number in its
arguments. No manual job run or additional submission was needed. MailPoet
created synthetic subscriber `5`, preserved the submitted whole name, added
membership to disposable list `7`, and wrote the stable value `repair` to custom
text field `cf_1`. Destination health recorded success at
`2026-09-11 06:01:20`, with no error or skipped captures.

Local Mailpit received exactly one message for the synthetic recipient:
`d4MXLpwNwy72MSfWVYRVND`, subject **Confirm your subscription to wconvert**,
received at `06:01:20` UTC. No confirmation link was followed. This verifies the
handoff and local mail transport, not subscription confirmation or external
inbox receipt. Existing-subscriber field preservation remains covered by the
adapter tests; a second live capture was deliberately unnecessary.

The actual destination admin response resolved the list name and reported the
QA Optin as both `draft=true` and `live=true`, with no mapping issues. The
browser showed the same **Live and saved draft** usage. After the submitted
visitor page closed normally, its deferred conversion beacon arrived: the QA
Optin had `impression=5` and `conversion=1`. MailPoet handoffs do not create a
lead-magnet-delivery counter.

After the final read-only UI checks, guarded cleanup removed only the verified
Lead, synthetic subscriber `5` and its membership/custom value, action `663`
and its logs, page `23`, QA destination and health entry, list `7`, custom field
record `1` (`cf_1`), and the exact Mailpit message. The original Mailpit message
id remained. The QA Optin was soft-deleted at `2026-09-11 06:06:21` and retains
its two daily counters as the domain requires.

Post-cleanup verification:

- All original Optin full-row hashes, original destination option/row hashes,
  original provider row hashes and existing destination-health rows match the
  recorded baseline.
- Six visible Optins remain: one published and five drafts; the two original
  destinations remain.
- Zero Leads and zero `wconvert_push_lead` actions remain; the QA action logs
  and page are gone.
- MailPoet is back to one original subscriber, five original segment records,
  zero custom-field records and zero subscriber custom values.
- Mailpit contains its one original message. The QA email is gone.
- The intentional residual is the deleted QA Optin’s `2026-09-11` stats:
  five impressions and one conversion. No original Optin, destination,
  subscriber, list or provider setting was edited.

The local verification artifacts are
`/tmp/wconvert-phase5-interest-capture-evidence.json`,
`/tmp/wconvert-phase5-interest-shared-usage-evidence.json`,
`/tmp/wconvert-phase5-interest-journey-cleanup-result.json`,
`/tmp/wconvert-phase5-interest-destination-cleanup-result.json`, and
`/tmp/wconvert-phase5-interest-mailpit-cleanup-result.json`. The verification
script’s temporary pre-completion queue assertion is not a product failure;
its later read established the natural completed action above.

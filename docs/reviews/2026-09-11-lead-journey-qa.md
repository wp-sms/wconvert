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

The normal visitor page showed the required email field and `Send my code`. One submission with `wconvert-journey-20260911@example.test` changed the terminal UI to **“You are on the list”** / **“Your code is on its way to your inbox.”** **Actionable UX finding:** “Your code is on its way to your inbox” implies delivery even though this WConvert destination only adds a MailPoet subscriber and MailPoet confirmation was still pending. The configured `signup_confirmation=true` left the real subscriber `unconfirmed` with `confirmed_at=null`; this copy should be reviewed in a separate UX change.

Evidence after the visitor request:

- WConvert admin Leads showed **1 submission**, the exact synthetic email, the disposable Optin, and captured time `2026-09-11 04:29:41`.
- The real Action Scheduler row was action **625**, created from `wconvert_push_lead`, initially pending and then **Complete via WP Cron** at `2026-09-11 04:30:02`. Its arguments were only `lead=01M27BMZ52JHCZC6BQSHJS5PXG`, `destination=01M27BKSFD3C9GN35TB4QF0T6V`, `attempt=1`; no email or other Lead fields were present.
- MailPoet API returned subscriber **4**, exact email, status `unconfirmed`, and list membership `segment_id=6`, status `subscribed`. The WConvert destination health recorded `last_success_at=2026-09-11 04:30:02`, no error, and zero consecutive failures.
- CUA inspection of local Mailpit `:10050` showed a real message to the synthetic recipient with subject **“Confirm your subscription to wconvert”** and a confirmation link. The message was deleted afterward through Mailpit UI; the unrelated delivery-check message remained.

## Cleanup and residuals

The exact disposable page, destination, destination-health entry, completed Action Scheduler action, Lead row, MailPoet subscriber, MailPoet list, and Mailpit confirmation message were removed. The original six Optins, original two Destinations, original `Newsletter`/`Product updates` MailPoet lists, settings, and unrelated Mailpit message remain. Post-cleanup verification returned **0 Leads**, **0 `wconvert_push_lead` actions**, two original Destinations, six visible Optins, and no test subscriber/list.

WConvert intentionally soft-deletes Optins and never deletes their analytics counters. The disposable Optin remains as one soft-deleted row (`deleted_at=2026-09-11 04:33:33`) with two immutable stats rows for `2026-09-11`: `impression=1`, `conversion=1`. Existing milestones were unchanged (`first_publish=2026-09-10`, `first_edit` already present for `read-to-the-end` design). These are the only residual QA artifacts and were preserved per the domain rules.

The repository’s `bin/verify-destinations.php` remains unsuitable for this live install because it writes temporary MailPoet lists/destination options and creates/deletes Leads; it was not run.

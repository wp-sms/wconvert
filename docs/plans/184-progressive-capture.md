# Progressive capture journeys — issue #184

Status: product direction agreed; implementation plan ready for review. Updated
2026-09-22. Runtime implementation has not started. The user approved the limited
statistics-table change; no new tables or Lead columns are authorized.

The accepted scope follows the [use-case and competitor reassessment](184-progressive-capture/decision-review.md):
one final submission by default, with a deliberate optional email/SMS signup
follow-up. No autosaving ordinary screens or general send-policy engine.

Issue: https://github.com/wp-sms/wconvert/issues/184

Review artifacts:

- [Proposed Template contract and four JSON examples](184-progressive-capture/README.md).
- [Storage, requests, queue handoff and analytics proposal](184-progressive-capture/storage.md).
- [Accepted domain decisions](../adr/0103-progressive-capture-keeps-one-lead-per-journey.md).

## Objective

Let merchants guide visitors through an offer, a few questions, and contact
capture without requiring everything on one screen. Support both a complete
enquiry submitted at the end and an email signup followed by an optional SMS
signup. The latter must retain the completed email signup if the visitor leaves.

WConvert is pre-release. Change the model, APIs, and bundled designs directly
where needed. Do not build legacy readers, backfills, or migration shims for
the current two-screen format. External unsupported packs must still be refused
clearly: that is input validation, not a promise to support old formats.

## Decisions

### Confirmed by the user

- Evaluate and specify before implementing the runtime.
- Plan for real merchant scenarios, including competitor expectations.
- Implementation size and compatibility with unreleased data are not reasons
  to weaken the proposed experience.
- Ordinary forms submit all their answers once at the end, even across several
  screens. Next and Back never save visitor answers.
- An explicitly submitted email signup is saved immediately. Closing the
  subsequent optional SMS screen must not discard it.
- Later SMS submission adds to the same Lead. Count one Conversion for the
  journey, at its first accepted capture, and preserve separate email/SMS
  consent evidence. See [ADR 0103](../adr/0103-progressive-capture-keeps-one-lead-per-journey.md).
- Each completed signup starts its Destination handoff immediately after local
  persistence. A later SMS signup must not repeat the email welcome or download.
- Already-submitted details are fixed. Back can review them, but editing is
  limited to answers that have not yet been submitted.
- Cover the Template JSON contract and every reader/writer, not just the editor.
- Merchants can add, duplicate, delete, and reorder screens in a linear journey,
  arrange the primary submission and optional other-channel signup, and start
  from curated Templates. Conditional
  branching is outside this feature.
- Multi-screen capture is a Free core feature. Existing Pro Display Types and
  integrations keep their existing entitlements.
- Reports include one overall Conversion count, separate email/SMS capture
  totals, and anonymous screen progress counts. Screen activity is not a count
  of unique people or exact abandonment.
- Retain existing Lead JSON and Action Scheduler; create no new tables. The
  user approved adding `scope` to the existing statistics table and including
  it in the primary key, as specified in the storage document.

### Implementation defaults

These resolve routine implementation choices within the agreed scope:

- Support capture journeys in all existing Display Types using their existing
  Free/Pro boundaries. Ship compact floating-bar examples and validate its
  mobile layout rather than treating a multi-screen bar like a large popup.
- Use at most six screens before acknowledgement and at most two submissions.
  The first is required; the second, if present, is the other optional marketing
  channel. Enquiries/offer-first forms have one final submission.
- Keep continuation in memory on the current page, with a 30-minute absolute
  grant lifetime. No cross-page/device resume or matching earlier Leads by email.
- The primary submission satisfies the Campaign Goal. Email-first with optional
  SMS belongs under the email Goal; SMS-first uses the SMS Goal. A phone on a
  callback request is contact data, not an SMS marketing capture.
- Campaign submission settings own purpose and Destination bindings; Templates
  own reusable screens and field/consent references. Offer only primary and
  optional-channel handoff controls, not arbitrary per-screen dispatch policies.
- For a promised download/code, fulfill the primary request independently of
  optional SMS. An additional SMS reward must be explicit. A one-time resource
  request remains final-only; no arbitrary post-request profile enrichment.
- Keep submitted values read-only. A correction after sending is not silently
  applied to WConvert or downstream services. Unsaved fields remain editable.
- Keep existing privacy-retention timing anchored to the first accepted capture.
  A later phone or consent addition does not restart the retention clock.
- Primary success unlocks promised content immediately. Offer any optional signup
  without hiding that access. Stop-after-conversion governs future appearances;
  it must not tear down an active optional screen on the same page. Same-page
  dismissal/reopen retains in-memory progress, while cross-page reminders cannot
  resume a capture or authorize changes to its Lead.

The concrete JSON syntax is in the companion contract and fixtures. Any new
schema need discovered during implementation requires separate sign-off; the
approved statistics change is not permission for a new submission table.

## Scenarios the design must explain

| Scenario | Recommended visitor behavior | Persistence and handoff |
|---|---|---|
| Email-only newsletter | One input screen and acknowledgement | Save only on explicit submission |
| Offer first | Offer with Continue/No thanks, then form | Continue is navigation, not capture or Conversion |
| Enquiry | Interest/request details, then contact details | Next retains answers in memory; final submit saves the complete enquiry |
| Email then optional SMS | Submit email; invite SMS with its own wording and Skip | Email is already saved; skipping does not imply SMS consent |
| Phone-only callback | Request and phone details, then submit | A callback request must not be interpreted as SMS marketing permission |
| Phone-only marketing | Phone plus explicit SMS choice, then submit | Dispatch according to the submitted purpose/consent |
| Preference before signup | One declared choice, then contact details | No anonymous saved profile before an identifier is submitted |
| Download/content lock | Submit the required request, receive access | An optional later channel cannot take already-earned access away |
| Reopen after dismissal | Return to the same mounted journey on the same page | Preserve only memory state; committed captures remain saved |
| Reload before any submission | Start again | No Lead or visitor-answer storage |
| Reload after email submission | New page visit | Saved email remains; do not locate and edit it by matching email |
| Repeated independent visit | A fresh explicit capture | Do not merge people or deduplicate by identifier |
| Capture failure on first submission | Keep answers and show a useful error | No premature acknowledgement or Conversion |
| SMS failure after email success | Explain email was received, allow SMS retry/skip | Do not undo email capture or dispatch SMS without its accepted submission |
| Connection lost after submission | Explain that confirmation is unavailable | Retry must not duplicate the accepted capture or its handoff |
| Campaign republished mid-journey | Ask visitor to review changed capture terms | Never record replacement consent wording as if already shown |
| Two tabs or rapid double-click | Handle concurrent requests predictably | Separate journeys remain separate; repeat requests within one journey are idempotent |
| Lead erased during continuation | Stop continuation gracefully | Do not recreate erased data or dispatch it from queued snapshots |

## Template JSON and authoring contract

The production manifest is `resources/templates/manifest.json`; shipped Free
designs are `resources/templates/library/*.json`. Pro designs also live under
their owning modules. Updating only one example JSON would leave this feature
incomplete.

The proposed contract must explicitly distinguish:

- Stable screen identity, human-readable editor name, and display order.
- Content/input screens versus acknowledgement screens.
- Navigation (`next`, `back`, optional `skip`, `close`) versus an explicit
  submission, external conversion link, and non-converting follow-up link.
- Which declared inputs and consent controls belong to each submission.
- A final-only enquiry versus an initial signup with optional later capture.
- Separate consent purpose/channel, exact displayed wording, and acceptance.
- A server-confirmed capture acknowledgement versus the end of screen navigation.

Use stable IDs for relationships rather than numeric array positions. Keep
visual content in the existing node vocabulary. Do not insert arbitrary script,
URLs containing captured values, or merchant-defined executable conditions.
Reject unknown actions; never interpret an unknown navigation action as Submit.

Four reviewable JSON examples now accompany this plan: email-only, offer-first,
enquiry, and email-plus-SMS. They demonstrate proposed syntax and remain outside
the shipping library until its validator and runtime support the new contract.
During implementation:

1. Update the manifest and shared PHP/TypeScript tree contract together.
2. Update every bundled Free/Pro design directly to the selected contract.
3. Update Playbook copy binding and privacy defaults for screen/consent scope.
4. Update generated authoring vocabulary from the manifest, rather than keeping
   a second handwritten vocabulary.
5. Update Template pack requirements, strict validation, fixtures, and generated
   catalog content to the new contract.
6. Update authoring skills and design-review tools that currently assume two
   screens. Check all screens at mobile/desktop widths and in RTL.

## Implementation map

| Area | Existing entry points | Required work |
|---|---|---|
| Template vocabulary | `resources/templates/manifest.json`, `src/Template/TemplateVocabulary.php`, `TemplateTree.php`, `TemplateManifest.php`, `resources/renderer/src/types.ts` | Explicit flow data, strict action validation, shared declared choices |
| Validity and publication | `TemplateForm.php`, `ConvertingAct.php`, `TemplateLibrary.php`, `src/Goal/OutcomeContract.php`, `src/Rest/OptinController.php` | Validate reachable linear flow, capture boundaries, identifiers and consent; decouple one converting act from number of buttons/screens |
| Library and packs | `TemplateFacets.php`, `SlotRoles.php`, `TemplateLabels.php`, `src/Template/Catalog/PackValidator.php` | Derive captures over the right scope, preserve copy by identity/scope, reject incompatible packs before normalization |
| Editor | `resources/admin/src/builder/structure/*`, `EditorCanvas.tsx`, `StructureView.tsx`, `OptinBuilder.tsx`, `ReadinessDialog.tsx` | Screen controls, complete draft Undo, safe reorder/delete, realistic preview and publish errors |
| Renderer and visitor flow | `resources/renderer/src/render.ts`, `mount.ts`, `resources/loader/src/capture.ts` | Preserve answers, handle navigation and capture separately, focus/errors/progress, pending and confirmed states |
| Server capture | `src/Rest/CaptureController.php`, `src/Lead/CaptureForm.php`, `LeadCapture.php`, `LeadRepository.php`, `Submission.php`, `ConsentRecord.php` | Authoritative submission scope, canonical validation, consent snapshots, authenticated continuation and retry behavior |
| Destinations | `src/Destination/PushDispatcher.php`, `PushJob.php`, `PushSubject.php`, adapters | Stage-specific dispatch and retry semantics, channel permission, stable payload semantics, no duplicated one-time actions |
| Analytics and reporting | `src/Stats/*`, Lead views/export, Goal contracts | Count agreed converting act exactly once, explain channel additions, preserve useful report labels |
| Privacy | `src/Privacy/*`, `src/Retention/*` | Include new evidence in export/erasure/data map; continuation cannot bypass deletion or extend retention silently |
| Pro interactions | `src/Optin/ContentLock.php`, `PublishedProjection.php`, Pro display/reopen/content-lock modules | Define unlock, dismissal, stop-after-conversion and continuation across every supported surface |
| Authoring and verification | `bin/verify-templates.php`, `tools/design-library/build/*`, `.claude/skills/design-a-template/SKILL.md`, `.claude/skills/design-a-playbook/SKILL.md` | Remove two-screen assumptions, generate vocabulary, review all steps and complete starting points |

## Server and storage implementation

Do not use an email, phone, or exposed Lead ID as permission to update a Lead.
Continuation extending one Lead needs a narrowly scoped, expiring proof
bound to that journey, Campaign, and capture contract. It must not turn into a
general anonymous Lead-edit API. Keep the proof and unsaved answers out of URLs,
analytics, localStorage, sessionStorage, and cookies under the memory-only
continuation policy.

Define idempotency before claiming one Conversion: first submission retries,
later submission retries, simultaneous requests, and a response lost after a
successful write all need explicit outcomes. Request retry is different from
deduplicating separate captures by email or phone.

Current Destination jobs store IDs and re-read the Lead at execution time. If a
Lead can gain information, an earlier job must not accidentally act on later
consent or resend an earlier action. Specify the accepted submission snapshot,
job identity, routing, and erasure behavior together. Do not put personal data
in Action Scheduler arguments as a shortcut.

Use the [storage design](184-progressive-capture/storage.md): bounded accepted
snapshots in Lead JSON, temporary owned request receipts in WordPress options,
Action Scheduler jobs with submission references, and scoped existing counters.
The `scope` column/key change is approved; any further schema change must have
its own concrete justification and explicit sign-off.

## Accessibility and interaction recommendations

- Announce the current screen and progress in meaningful terms; avoid implying
  an optional SMS step is required to finish the email signup.
- Next validates only the current unsubmitted inputs. The server validates the
  complete declared submission scope against its own published contract.
- Back preserves values. A server refusal navigates to and focuses the affected
  control; announce general failures without losing answers.
- Inactive screens are absent from keyboard and accessibility navigation.
- Enter invokes the current screen's intended primary action; it must never
  accidentally submit or skip a required earlier screen.
- Disable conflicting navigation during a pending capture, retain a clear close
  option, and do not steal focus if a hidden journey finishes.
- Browser Back remains page navigation. On-page Back is a visible control.
- Verify keyboard, screen reader announcements, reduced motion, mobile keyboard,
  zoom, long translations, RTL, and each container's focus/dismissal behavior.

## Delivery slices

1. Planning (this change): record the agreed product contract, amend the glossary
   and affected ADRs in both directions, and provide the manifest fragment,
   Campaign settings, four JSON fixtures, and storage proposal.
2. Implement the shared Template contract and convert the unreleased bundled
   library, pack fixtures, authoring tools, and readers together.
3. Deliver a complete final-only multi-screen enquiry through editor, publication,
   visitor runtime, capture, Destinations, and reporting.
4. Deliver email signup followed by optional SMS with the agreed Lead,
   consent, retry, continuation, dispatch, and privacy semantics.
5. Finish merchant screen editing, curated starting points, all supported display
   surfaces, preview/library behavior, and interaction quality.
6. Run the acceptance matrix and real WordPress verification before release.

These are implementation slices, not permission to ship a partially compatible
runtime/manifest combination. Keep the feature unpublished until a complete
journey works end to end.

## Acceptance and verification

- Every scenario above has an explicit expected Lead, consent, dispatch, and
  Conversion result specified by this plan.
- PHP tests prove complete server validation, consent evidence, unauthorized
  continuation refusal, replay/concurrency handling, publication changes, and
  erasure during continuation.
- JS tests prove value preservation, scoped validation, pending/error states,
  no requests on navigation, and acknowledgement only after confirmation.
- Template parity and pack tests reject unsupported or malformed flow data:
  duplicate IDs, unreachable screens, invalid action targets, missing identifiers,
  ambiguous repeated fields, and incorrect consent scope.
- Browser tests prove forward/back/skip/dismiss/reopen, mobile/RTL, keyboard and
  focus, network failure/retry, content-lock timing, and editor Undo/reordering.
- Destination tests distinguish initial handoff from later additions and prove
  that queued retries cannot repeat a welcome/resource action due to SMS capture.
- Verify the plugin on real WordPress/Playground, including Free and Pro assets,
  publication, capture, jobs, exports, privacy erasure and the loader size budget.

Planning checks parse all six JSON artifacts, validate fixture IDs/references
against the proposed vocabulary, check local documentation links, and check the
diff for whitespace errors. Runtime tests and browser verification belong to the
implementation slices; this document does not claim the behavior is shipped.

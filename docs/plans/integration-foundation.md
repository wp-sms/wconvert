# Integration foundation and first remote providers

Planning baseline: 2026-09-29, `origin/main` at `2d26053`.
Product direction accepted in the integration planning conversation. The
foundation and both first adapters are implemented on the integration branch;
the delivery gates below still distinguish code verification from live-provider
validation and are not a claim that the release is shipped.
See [ADR 0109](../adr/0109-integrations-share-setup-and-map-extra-answers-per-campaign.md).

## Implementation status (2026-09-29)

The branch has shared account create/edit/check/remove, selected-account target
discovery, Mailchimp and Brevo adapters in Pro, campaign-level answer mapping,
accepted-submission snapshots, a draft sample preview and explicit test send,
route-change protection, and recent Action Scheduler outcomes. The existing
Destination page presents account checks, health, recent attempts and recovery.
MailPoet now uses the same campaign mapping for new subscribers. No database
table or column was added.

The accepted submission purpose controls the remote marketing action. An email
marketing signup creates a pending Mailchimp member or a Brevo Contact in the
selected list. An enquiry creates a transactional Mailchimp Contact or a Brevo
Contact without list membership. Existing Contact updates never change status
or suppression. Explicit sample sends use the merchant's own address and can
join the selected marketing list.

Local PHPUnit, Vitest, lint, type checking and WordPress Playground boot checks
are the code gate. The provider write paths have mocked HTTP tests, but no
Mailchimp or Brevo test-account credentials are available in this workspace, so
confirmation emails, existing-contact writes and provider automations still need
live end-to-end validation before release. Metadata uses request-local
memoization and five-minute transients, with an explicit refresh control;
load-more controls remain an open release gate; automatic background health polling
is deferred. Recent history is a
bounded Destination view, not a permanent per-Lead delivery ledger.

### Coverage audit against the acceptance gates

The implementation is a working foundation, but **the release plan is not fully
covered yet**. Keep the PR in draft until the open gates below are implemented
and verified. In particular, a mocked provider response or a successful account
ping is not proof of a real signup.

| Gate | Current evidence | Remaining work |
| --- | --- | --- |
| Shared accounts, target setup and automatic contact fields | Account CRUD, selected-account schema, route validation, both Pro adapters and campaign summary are present. Account checks now read a small audience/list page as well as authenticating. | Test two real accounts and distinct targets; verify replacement and actual provider permissions. |
| Campaign mappings and accepted snapshots | Campaign config, publish validation, server preview, accepted Lead snapshots, MailPoet mapping and route-identity guard are present. Variant creation copies stable Template IDs, so mappings stay keyed to the copied submissions; copying a question creates a new ID and does not copy its mapping. | Validate mapping structure on draft save as well as publish, provider target lengths/types and the exact draft sample source against the selected campaign. Add focused duplication/Undo checks. |
| Metadata discovery | Selected Connection/target discovery and five-minute caching are present. | Replace fixed provider page caps with 50-item pages and load-more/search. Show incompatible target fields with a reason, rather than omitting them. Preserve missing selections visibly. |
| Recent attempts and recovery | Action Scheduler outcome markers and destination-scoped recent attempts distinguish accepted, retry, attention, skipped and unknown. Recovery checks saved route identity. | Add allowlisted reason codes, retry action ID and validated provider delay/jitter; link retained Leads where permitted; expose overdue queue diagnostics; verify actual scheduler versions and interrupted handoff. |
| UI and privacy | Shared forms, native field selectors, account removal confirmation, compact automatic-field summary and explicit sample effects are present. | Real-browser review of mapping and account states at 320/360px and RTL, keyboard/focus, long labels, and screenshots. Check Data Map and privacy copy against a configured real provider. |
| Remote provider behavior | Mocked create/existing/update/enquiry tests pass. | Live Mailchimp/Brevo create, duplicate, suppression, confirmation, required-field, race and automation checks with test accounts. Record versions and evidence. |

The optional webhook remains a separate follow-up, as agreed. It is not a
missing acceptance gate for this release.

## 1. What we are building

Make a simple signup take very little setup: connect an account, choose an
audience, and send the supported basic contact details automatically. A campaign
that collects more information can optionally map its own answers to provider
fields. Every provider uses the same setup controls, mapping validation, test
flow, queue, recent sending history and recovery tools.

Extend the existing Destination system. Do not replace it with a second registry,
workflow builder, synchronization engine or provider capability hierarchy.

### Agreed product decisions

| Concern | Decision |
| --- | --- |
| First providers | Mailchimp, then Brevo; provider selection delegated to us |
| Next candidate | Outbound webhook, separately scoped after the first two providers |
| Packaging | Remote providers in Pro; shared foundation and existing local providers in Free |
| Shared setup | Connection credentials, Destination audience/list and existing-contact policy |
| Basic fields | Provider-owned automatic handling; no mandatory mapping table |
| Extra fields | Optional campaign-level mappings, scoped to the Destination and accepted submission |
| Mapping inheritance | None: no shared custom map plus campaign overrides |
| Captured data | Contact details and explicitly captured form/quiz answers; include enquiry text |
| Existing Contacts | Merchant chooses Keep existing details or Update mapped fields per Destination, where supported |
| Sending history | Recent Action Scheduler history with explicit WConvert outcomes |
| Long-term ledger | Not included; absent/expired history is Unknown |

### User jobs and first-release examples

| Job | Merchant experience | Proof of success |
| --- | --- | --- |
| Newsletter signup | Reuse Mailchimp account, choose Newsletter audience, see automatic email/name summary | A simple campaign requires no custom mapping |
| Enquiry | Send name/email, then map Service needed and Message | Preview and provider record contain the selected captured details |
| Quiz segmentation | Map the campaign's preference answer to a custom text field | Only accepted answers are sent, including the correct conditional path |
| Several campaigns, same audience | Reuse one Destination; only extra question mappings differ | No repeated credentials and no questions leaking between campaigns |
| Email followed by optional SMS | Configure each signup's destinations in the existing journey UI | The SMS submission does not replay email or resource delivery |
| Provider outage | Capture continues; merchant sees a reason and retry/recovery action | Leads remain local and recent attempts explain what happened |

These are design scenarios, not measured customer-demand percentages. Simple
list growth is the recommended default experience; extra-answer controls remain
available for enquiries and quizzes.

## 2. Existing implementation to preserve

| Responsibility | Current home | Change needed |
| --- | --- | --- |
| Stateless adapters and registration | `src/Destination/DestinationType.php`, `DestinationRegistry.php` | Extend the existing interface only for concrete discovery/mapping needs |
| Shared account/route storage | `ConnectionStore.php`, `DestinationStore.php` | Complete account CRUD and validation; preserve masked reads |
| Provider settings and requirements | `DestinationRequirements.php`, `resources/admin/src/destinations/settings.tsx` | Account/audience-aware metadata and shared editor controls |
| Accepted values and question evidence | `src/Lead/QuestionCapture.php`, `JourneyCapture.php`, `Lead.php` | Include mapping references in accepted submission evidence |
| Outbound field filtering | `CanonicalFields.php`, `PushSubject.php` | Add a typed, allowlisted source projection for extra answers |
| Dispatch and interrupted handoff | `SubmissionDispatcher.php`, `PushDispatcher.php` | One submission-aware mapping path for actual and test sending |
| Retries, health and failures | `PushWorker.php`, `PushResult.php`, `HealthStore.php`, `DeliveryFailures.php` | Separate actionable reason from retry decision; record attempt outcomes |
| Recovery | `BulkRePush.php` | Preserve bounded selection and submission routing; explain replay effects |
| Account/destination screens | `DestinationController.php`, `Destinations.tsx`, `DestinationSettingsForm.tsx` | Finish account setup and consolidate duplicated settings behavior |
| Campaign sending controls | `resources/admin/src/builder/DestinationsEditor.tsx` | Optional extra-answer mapping with draft/publish behavior |
| Data-flow disclosure | `src/Privacy/DataMap.php` | Reflect configured mappings without exposing credentials or answers |

Important gaps verified in source:

- Connection storage exists, but account creation/credential replacement has no
  complete REST/UI path. The credential schema is not yet exposed for that flow.
- Type settings use the first Connection of that provider. Changing an account
  in the editor does not refresh editable audience/field choices for that account.
- `settingsSchema(credentials)` lacks selected-audience context, needed by
  providers whose custom fields belong to an audience.
- `CanonicalFields` currently retains only email, phone, name and interest.
  Enquiry message and `question_answers` do not reach provider pushes.
- MailPoet has one Destination-level interest mapping, restricted to creation.
- An exception during metadata discovery can fail the whole index response.
  An uncaught adapter exception can bypass the worker's normal diagnostics.
- A retryable result also currently means a Destination outage. A revoked key
  and a timeout therefore follow the same retry path.

## 3. Merchant-facing flow

### Shared account and Destination setup

1. Choose a provider; local providers skip remote account setup.
2. Reuse an account or enter credentials. Check the candidate credentials before
   committing them; a failed replacement leaves the working credentials intact.
3. Choose an audience/list from that account and give the Destination a useful
   suggested name, such as Mailchimp — Newsletter.
4. Show supported automatic fields and the existing-contact policy. Keep existing
   details is the default for the new remote adapters.
5. Save. A shared-settings edit names the affected saved/live campaigns using
   the existing usage read; this edit is outside campaign draft Undo.

Manage accounts in Connections & destinations: rename, replace credentials,
check account, inspect usage and remove an unused account. Require reassignment
or removal of referencing Destinations before account deletion. Renaming and key
rotation keep the Connection ID stable. Do not silently switch a Connection to
a different remote account; use a new Connection when remote identity differs.

### Campaign setup

- Select an existing Destination or open the same shared setup flow inline.
- Show a compact summary: "Sending email and name to Newsletter."
- Reveal **Send extra answers** only when the campaign has eligible extra data
  and the adapter supports custom fields.
- Each row contains the readable source label and a provider-field selector.
  Empty means Don't send. Never select a custom field merely because names look
  similar; standard provider-owned contact defaults are the only automatic map.
- Show mapping on the signup/submission that will send it. Do not make merchants
  navigate technical IDs or choose a global-versus-campaign scope.
- Mapping edits are campaign draft edits, support Undo, and take effect on
  Publish. A shared Destination edit remains a separate saved action.
- Copying a whole campaign/variant copies valid mappings and remaps regenerated
  question/submission IDs. Copying one question does not copy its mapping to the
  same remote field; that would create two competing sources.
- A rename preserves the map. Removing a mapped question requires removing its
  mapping in the same undoable edit; no dangling hidden writes.

### Tests

| Control | What it proves | External effect |
| --- | --- | --- |
| Check account | Authentication and metadata access work at this time | Read-only; no Contact created |
| Preview data | Which submitted values would be included/omitted and where | None |
| Send test | Provider accepts this explicit sample through the actual adapter/mapping path | Can create/update a Contact and trigger provider automation |

The campaign test can use the current draft map, clearly labelled as a draft
test. Validate the draft and sample on the server; do not temporarily save it or
fall back to the published map. A Destination-page test covers automatic fields
only unless a campaign/submission is explicitly selected for extra answers.
Suggest the WordPress profile email visibly; do not invent phone, name, answers
or consent. Show recipient, target, data summary and existing-contact effect
before the Send test action. Tests create no Lead, queue attempt, conversion,
real-send health event or failure-ring entry. They must not clear an outage.

## 4. Small shared implementation

Keep one DestinationType interface and the existing registry. The following are
responsibilities, not a requirement to create one class per row:

| Shared responsibility | Adapter responsibility |
| --- | --- |
| Account lifecycle, masking and usage | Credential fields, authentication check and stable account identity if available |
| Metadata loading/cache states | Audiences and custom fields for the selected scope |
| Source selection and mapping validation | Supported target types, length limits and reserved fields |
| Sample preview and mapped values | Vendor payload names and create/update semantics |
| Scheduling, bounded retries and outcome logging | Interpret provider response into a safe reason and retry advice |
| Health/history/recovery UI | Provider-specific instructions where generic repair wording is insufficient |

Provide one shared settings form used by the Destinations page, add dialog and
campaign setup dialog. Extract existing duplicated naming, account selection,
settings conversion and validation while adding metadata support; do not rewrite
the surrounding admin shell.

Core owns configuration, mapping, queue and UI plumbing. Pro owns remote adapters
and their HTTP implementation. Shared remote transport belongs with Pro so Free's
capture-path source contract continues to forbid outbound HTTP. A small HTTP
helper may handle bounded timeouts, JSON decoding and redaction; it must not
decide that every 400 is permanent or every 403 is retryable.

### Account and metadata operations

- Expose the credential schema without current secret values. Reads return
  configured/unconfigured flags, never a masked placeholder that can be saved
  back as the real credential. Replacement is explicit; omitted means unchanged.
- Require the normal authenticated WordPress management permission and nonce
  behavior for reads/tests/writes. Validate IDs, type ownership and field allowlists
  server-side. Reject a Mailchimp Destination referencing a Brevo Connection.
- List audiences by Connection; list fields by Connection plus selected target.
  Static provider description must not fetch all remote schemas on page load.
- Use existing WordPress transients for bounded metadata caching. Proposed TTL:
  five minutes. Key by provider, Connection ID, credential revision and audience;
  never put an API key in the cache key. Cache no Contact data. Refresh bypasses
  stale results; credential replacement invalidates that account's metadata.
- Paginate provider reads. Initial page size 50; use provider pagination/search
  through a load-more control. Avoid downloading every field/list for every account.
- Scope loading/errors to the selected provider. An unavailable provider must not
  prevent configuring a local Destination or inspecting health. Retain unavailable
  saved target IDs, show their readable saved label when available, and offer repair.
- Cancel/ignore obsolete responses when switching accounts/audiences quickly.
- Record last account-check time/result beside the Connection, separately from
  actual sending health. Changed credentials make the old check stale. No polling
  monitor is required in the first release.

## 5. Field ownership and mapping rules

### One source of truth

Keep `destinations` and per-submission destination IDs as the binding source.
Add one optional mapping collection in the campaign's existing config JSON,
indexed by submission ID, Destination ID and stable source reference. Do not store
another editable copy on Destination or inside the Template.

Illustrative shape (final names should follow existing conventions):

```json
{
  "destination_mappings": {
    "primary": {
      "DESTINATION_ID": [
        { "source": "field:message", "target": "MESSAGE" },
        { "source": "question:QUESTION_ID", "target": "SERVICE" }
      ]
    }
  }
}
```

Canonical field and question namespaces prevent collisions. A map is valid only
for a bound Destination and a source that the selected submission can accept.
Conditional questions may be absent on some paths: that is a valid omission.
Questions after an earlier accepted signup cannot be promised on that signup.
Anonymous quiz results do not enter this path at all.

Basic email, phone and name handling stays in the adapter and is visible in the
summary. Do not guess a first/last split from one full name. Explain unsupported
basic values rather than silently claiming they will be sent. Destination fields
that change identity, subscription status, suppression, list state or consent are
reserved and cannot be custom mapping targets.

Respect the accepted submission's purpose/channel when building any provider
signup request. An enquiry email is not automatically permission for marketing,
and storing a phone field is not SMS subscription. Provider setup/requirements
must expose those limitations without inferring new consent from mapped answers.

### Bounded first-release value contract

- Sources: supported basic values; enquiry message; canonical interest; captured
  text, single-choice and multi-choice question answers. No arbitrary browser keys,
  raw request bodies, consent records, derived scores or anonymous answers.
- Begin with provider custom **text** fields for extra answers. This supports the
  existing question vocabulary without a number/date/enum conversion designer.
  Unsupported provider types remain visible with an explanation, not selectable.
- Text and message: accepted captured string. Canonical interest keeps its stable
  value behavior. Question choice answers: use captured readable labels for text
  targets; join multiple labels with `; ` in captured order. This is display text,
  not a machine-readable set or a promise of native multi-select segmentation.
- Preview the exact representation, including multi-choice output. Renaming a
  choice changes future captured display text, not past snapshots. Preserve stable
  question IDs internally. Native enum/value mapping is a later, demand-driven
  extension; do not silently coerce values into provider enum codes.
- Omit absent/blank answers. Never send null/empty instructions that clear existing
  provider fields. Reject duplicate target assignments including collisions with
  automatic contact fields. Enforce provider lengths; report a mismatch rather
  than silently truncate a chosen answer.
- Limit mappings by the existing campaign/source count and one target per source
  per Destination. No formulas, transformations, static-field editor or conditions
  in the first release. Existing provider audience/tag selection remains supported.

The representation above is an implementation recommendation, to be exercised
with the real enquiry/quiz fixtures before finalizing UI copy. It does not add a
second merchant-facing mapping mode.

### Draft, publish and send validation

Validate structural references/types on save and publish using the same mapping
module used for preview and send. Derive UI requirements from provider metadata;
do not maintain separate hard-coded provider rules in React.

Malformed mapping writes return actionable validation errors. Local-only capture
remains valid. A provider outage or incomplete Destination must not turn a valid
local capture into a visitor error; show readiness warnings. At sending time, a
known invalid selected mapping stops that Destination's push rather than dropping
the answer and claiming success. Preserve existing goal/channel publish rules.

No credentials, provider schemas or destination mappings go into public-page
projection/loader payloads. The capture server reads the published campaign config.

### MailPoet and local providers

Move the current interest mapping into this campaign-owned map when implementing
the feature. Because the project is pre-release, change the contract directly;
do not keep a Destination fallback or a compatibility resolver. Update fixtures,
existing setup documentation and the relevant tests in the same slice. Any local
development data that uses the old setting must be explicitly reconfigured.

MailPoet can initially accept the shared text mapping on **new** subscribers.
Its existing-contact update option remains unavailable until a focused write path
is proven not to restamp provenance or alter lifecycle state. WSMS retains its
documented conservative behavior unless its supported non-identity write path is
verified. Do not sell unsupported choices as working. Lead-magnet email does not
gain custom mapping or a Contact-update policy because neither applies.

## 6. Existing-contact policy

Store one policy on the shared Destination; show affected campaigns on edit.

- **Keep existing details:** new Contacts receive the selected values. Existing
  values are not overwritten. Existing local adapters retain their documented
  preserve/fill-empty behavior until explicitly adapted; disclose that difference.
- **Update mapped fields:** supported adapters may replace eligible non-identity
  values included in this submission, including an automatically mapped name.
  Missing values stay untouched. Show the actual fields in the test/preview summary.

Email/phone identify the provider record; this setting never authorizes changing
an existing Contact's identifiers, merging records, resetting opt-outs, confirming
subscriptions or removing memberships. Adding a second phone identifier to an
existing email Contact requires an independently verified provider rule; it is
not ordinary custom-field mapping.

Use write operations that preserve lifecycle state without reading it back.
Do not choose an upsert merely because it avoids duplicates: some upserts also
overwrite values or change membership/status. Test create, already-exists,
create-race and partial-success retries separately in both policies.

In update mode, a later-arriving retry/recovery can reapply older captured values.
State that effect before manual recovery. Do not promise cross-system latest-write
ordering or exactly-once automations. If a customer requires strict ordering,
that is separate scope rather than a hidden synchronization feature.

## 7. Accepted submissions, queued work and configuration changes

Recommended implementation: freeze the campaign mapping with each accepted
submission in existing Lead JSON, beside its current values and destination IDs.
This is capture evidence, not a mutable delivery ledger. A later campaign edit
must not reinterpret the question identity/value on an old queued submission.

Record a small route identity fingerprint per accepted Destination, computed
from provider type, Connection ID, target selection and existing-contact policy.
Use current credentials at execution, so rotating a key repairs queued work.
Labels and credentials are excluded from the route fingerprint. If the remote
account/target/policy has changed, do not automatically send the queued capture
under a different instruction; report Needs review. This is a guard, not a
configuration-version store or a snapshot of provider metadata.

Automatic retries keep the accepted values, mapping and route identity. Removing
a Destination or erasing/pruning a Lead prevents the corresponding send. Check
availability at execution; license expiry does not remove installed functionality.

Keep existing bounded bulk-recovery selection: currently published bindings,
retained Leads, accepted submission destination IDs and the documented overlap
around last success. It is not exact failed-only replay. Initially recover only
captures whose saved route identity still matches; report mismatches separately
with a repair explanation. Re-targeting historical captures or applying a newly
edited map to old captures requires a separately specified explicit action; do
not sneak it into Retry. This deliberately limits recovery after structural edits.

All new snapshot metadata is written with the accepted submission, not by a later
worker editing submitted values. It contains no credentials. Queue arguments
remain scalar opaque identifiers and attempt bookkeeping, never captured values.

## 8. Health, retries and recent history

### Separate facts

| Fact | Example | Source |
| --- | --- | --- |
| Provider availability | MailPoet missing / Pro adapter not installed | Existing registry |
| Setup readiness | Audience not selected / field deleted | Config and metadata validation |
| Account check | Credentials checked successfully at 10:30 | Separate Connection check result |
| Sending health | Last accepted push; current account/config failure | Existing Destination health option |
| Recent attempt | Provider accepted / retry scheduled / unknown outcome | WConvert outcome recorded against an Action Scheduler action |

Keep current bounded failure diagnostics and advisory health. Add a small reason
vocabulary: authentication, permission, configuration/mapping, rate limit,
temporary provider/transport problem, record rejection, configuration changed,
unknown. Retry advice is separate from which Destination needs attention.

Use the existing maximum of five attempts as the starting policy. Automatically
retry temporary failures with backoff and jitter; honor a validated, bounded
provider retry delay when supplied. Authentication/configuration/permission
failures need merchant repair and should not burn all attempts immediately.
Unknown writes/timeouts remain ambiguous and replay only through an adapter whose
write sequence has a verified retry contract. Never perform a hidden second retry
loop in an HTTP helper. Catch unexpected adapter exceptions into a sanitized
unknown outcome; do not silently lose the attempt from diagnostics.

Retain paced bulk recovery. A general distributed limiter/circuit breaker is not
part of this release; account-wide rate limits can be added if real burst testing
shows ordinary backoff insufficient. Low daily volume is not proof against bursts.

### Recent Action Scheduler history

Action Scheduler completion means the callback returned, not that a provider
accepted the Lead. The current worker records a failed result and returns normally,
including after scheduling a retry. We must record the actual WConvert outcome.

- Use Action Scheduler's logger/store facilities, isolated in the existing queue
  integration. Correlate an outcome with the running action ID. Do not copy the
  scheduler's tables into a parallel option-based log.
- Record a versioned, machine-readable outcome marker with allowlisted reason,
  attempt number, retry action ID when known and timestamps. No payload, address,
  name, answer, credential or unrestricted provider reference/response body.
  Translate reason codes at read time; do not parse human error prose for status.
- Query a bounded page of WConvert actions, then load the relevant outcomes. Default
  25, maximum 100 rows. The initial UI can be destination-scoped with links to the
  retained capture. Do not scan every historical action to render the lead list.
- Use exact action IDs for individual attempts. Repeated manual recovery is a
  separate attempt, never collapsed into proof that the original send succeeded.
  Add a chain token only if the verified scheduler query path needs it; never a
  random token that defeats initial submission enqueue deduplication.
- Render Queued, Running, Provider accepted, Retry scheduled, Needs attention,
  Skipped and Unknown. Provider accepted means acceptance of the request, not
  inbox delivery, a subscription confirmation or read-back of all saved values.
- Write Retry scheduled only after enqueue succeeds, referencing the next action.
  A failed retry enqueue leaves Needs attention. Interrupted/missing outcome logs
  are Unknown even if scheduler state says Completed; a fatal with no provider
  result also does not prove rejection.
- Missing/expired history is Unknown, never Not sent. Pre-feature attempts have
  no provider marker and remain Unknown. Show dates, not a guaranteed 30-day SLA.
- Respect the host's cleanup policy. Do not extend global scheduler retention or
  delete another plugin's actions. WConvert's recent view is a configurable-runtime
  diagnostic window, not durable per-Lead truth.
- Hide capture links/details when the Lead is erased/pruned; do not reconstruct
  personal data from logs. Existing retention/erasure and failure-ring cleanup
  remain authoritative. New logs deliberately contain no captured values.

A stalled queue must say jobs are overdue/awaiting processing, not that the provider
failed. Expose an actionable WordPress scheduling diagnostic without inventing
permanent monitoring or automatically changing the site's cron configuration.

## 9. Provider rollout and packaging

### Mailchimp first

Use its supported Marketing API, account authentication check, paginated audience
discovery and audience-scoped merge-field discovery. Start with email-audience
capture; do not advertise SMS subscription support just because a phone merge
field can store a number. Preserve the full captured name without splitting it.

Before shipping, prove both existing-contact policies through actual write paths
without status reads/mutations. Verify the new-contact confirmation behavior:
Mailchimp requires a creation status and API creation cannot be assumed to inherit
every hosted-form setting. Proposed default is provider-managed confirmation for
new email members; settle and document the exact provider behavior in slice 1.
WConvert still never owns or reports confirmation, and must never change an
existing member's status as part of a retry or field update.

### Brevo second

Use account authentication, paginated lists and account-level attributes. Start
with email Contact capture and text extra-answer fields. Brevo's documentation
warns incompatible attribute types may be ignored: local compatibility validation
is necessary even when an HTTP request can succeed. `updateEnabled` is not a
universal implementation of both policies; verify creation/race/existing writes
separately. Never enable force-merge or clear blacklist fields.

### Packaging

Free keeps the foundation and local WSMS/MailPoet/resource-email adapters. Put
remote implementation in a Pro module, suggested `pro/modules/destinations/`.
Follow the existing internal `elite` allocation for outbound Destinations in
`tiers.json`; the launch-facing name remains Pro. This adds no new customer plan.
Do not charge separately for mapping or troubleshooting of an available adapter.
Pro question availability continues to follow the journey module, not a second
mapping entitlement. Build-time module presence controls registration.

### Webhook later

Use a separate follow-up after both native providers prove the shared flow.
Define an outbound JSON contract, safe destination URL handling, authentication,
explicit sample sends and a stable event identifier first. A webhook POST is not
automatically idempotent; the receiver must tolerate duplicates. No generic HTTP
method/body template builder or inbound Contact synchronization is included here.

## 10. Storage and performance budget

| Data | Proposed home | Reason |
| --- | --- | --- |
| Credentials and latest account check | Existing non-autoloaded Connection option | Same account lifetime; serialize writes without overwriting unrelated account edits |
| Target and existing-contact policy | Existing Destination settings option | Shared route settings |
| Editable extra-answer mappings | Existing Optin draft/published config JSON | Campaign-owned and subject to Publish/Undo |
| Accepted mapping and route identity | Existing Lead submission JSON | Frozen at capture; deleted with the Lead |
| Provider metadata | Expiring transients | Derived, refreshable, no Contact data |
| Recent attempt outcomes | Existing Action Scheduler logs | Bounded by scheduler lifecycle; no new ledger |
| Advisory sending health/failure ring | Existing options | Retain current bounded model |

No new table, column, index or per-Lead WordPress option is proposed. Do not assume
permission to add one during implementation; CLAUDE.md requires explicit sign-off.
Never put provider metadata requests on the visitor capture path. Add no visitor
JavaScript for field mapping. Avoid N provider requests per Destination on admin
page load and an N-actions lookup per Lead in the default Leads screen.

## 11. Delivery slices and acceptance gates

### Slice 1 — Mailchimp account-to-capture path

Complete account create/edit/test/remove, scoped audience discovery and a first
Mailchimp adapter through existing queue/health/recovery. Implement automatic
basic fields and both verified existing-contact policies; isolate metadata errors
and give authentication errors an actionable repair state. Preserve safe target
identity for queued work. This slice must deliver a real signup end to end, not
only an abstract foundation.

**Done when:** two accounts show their own audiences; invalid replacement leaves
working credentials intact; capture survives provider outage; create/existing/
race cases and confirmation semantics are verified on a provider test account.

### Slice 2 — Campaign extra answers end to end

Extend accepted source projection and add one campaign mapping editor, shared
validation, payload preview and explicit draft test sends. Freeze mapping evidence
at capture. Update duplication/deletion/Undo/publish and Data Map. Replace the old
MailPoet Destination interest setting with the shared campaign map; retain its
creation-only limitation until a safe update implementation exists.

**Done when:** an enquiry and conditional quiz send selected answers to Mailchimp;
MailPoet new-subscriber mapping also uses the shared path; renames preserve maps;
missing/skipped answers never clear data; no extra mapping controls appear for a
basic signup; browser projection contains no integration configuration.

### Slice 3 — Recent history and recovery diagnostics

Write explicit WConvert attempt outcomes through the scheduler seam and add the
bounded recent-sends view. Complete reason/retry separation and validate execution
with cron, CLI and failure paths. Keep broad recovery honest; route mismatches are
reported rather than silently retargeted.

**Done when:** a Completed scheduler action with a provider failure renders the
provider failure; a successful retry is distinguishable from its failed predecessor;
failed retry scheduling is not shown as queued; expired/crashed history is Unknown;
test sends cannot alter real-send health or statistics.

### Slice 4 — Brevo through the same foundation

Add the second provider, its account/field discovery and policy-aware write path.
Extract only HTTP/auth mechanics genuinely repeated by the two adapters. Add an
adapter-onboarding note listing registration, schema, prerequisites, safe write
policy, response classification, limits, fixtures and live verification evidence.

**Done when:** Brevo requires no separate mapping, account setup, queue or history
screen; its incompatible attributes cannot silently count as a fully mapped send;
provider behavior is verified against a real test account.

### Slice 5 — Release validation

Run the matrix in [integration-foundation-verification.md](integration-foundation-verification.md),
including real WordPress and built Free/Pro artifacts. Review truthful copy,
accessible controls, privacy disclosure and documentation together. Record actual
provider/WordPress versions and which checks were live versus mocked. Do not call
the integrations production-ready from unit-test results alone.

## 12. Remaining implementation investigations

These are bounded engineering checks, not requests to reopen agreed product scope:

1. Verify provider-specific creation/confirmation and preserve/update operations.
   Where provider behavior forces a new user-visible choice, bring that concrete
   choice back before shipping; never invent a Contact-state read/overwrite.
2. Prove Action Scheduler action-ID correlation, logging and bounded querying
   against the minimum supported and negotiated runtime versions. Existing nested
   arguments require verification; do not assume arbitrary JSON filtering is indexed.
3. Exercise the proposed text representation with actual quiz choices and provider
   length limits. Broader typed enum/date mappings remain outside this release.
4. Verify the route fingerprint and capture mapping snapshot inside the existing
   transactional submission/handoff path, including retries after interrupted writes.
5. Verify MailPoet/WSMS safe update support before exposing that option there.

Implementation evidence and remaining gates are tracked above and in the
[verification matrix](integration-foundation-verification.md). Neither document
claims live-provider acceptance before provider test accounts are exercised.

## Navigation

- [Accepted decisions](../adr/0109-integrations-share-setup-and-map-extra-answers-per-campaign.md)
- [Verification matrix](integration-foundation-verification.md)
- Existing contracts: [outbound capture](../adr/0007-destinations-are-outbound-and-fallible.md),
  [health and recovery](../adr/0008-delivery-state-is-destination-health-not-per-lead.md),
  [requirements and shared usage](../adr/0074-destinations-declare-requirements-and-show-shared-usage.md),
  [progressive submissions](../adr/0103-progressive-capture-keeps-one-lead-per-journey.md).

## 13. Research and rationale

Official documentation reviewed 2026-09-29; product docs are evidence of documented
features, not hands-on competitor testing.

| Source | Relevant evidence | Applied lesson |
| --- | --- | --- |
| [OptiMonk account setup](https://support.optimonk.com/en/articles/connecting-your-email-or-crm-provider) | Reused account, list/settings and field-mapping steps | Keep the setup sequence familiar and scoped to the selected account |
| [OptinMonster field mapping](https://optinmonster.com/docs/use-field-mapping-to-add-extra-fields-to-your-optin-form/) | Custom field pairing; standard fields have provider-specific handling | Automatic basics and optional explicit answers |
| [Fluent Forms API logs](https://fluentforms.com/docs/fluent-form-api-logs/) | Inspectable integration activity and replay | Put diagnosis and recovery beside the affected send |
| [WPForms Mailchimp](https://wpforms.com/docs/install-use-mailchimp-addon-wpforms/) | Mailchimp is a paid integration | Pro remote providers are a reasonable packaging choice, not a universal market rule |
| [Mailchimp merge fields](https://mailchimp.com/developer/marketing/docs/merge-fields/) | Merge fields belong to an audience | Include audience identity in discovery/cache scope |
| [Mailchimp fundamentals](https://mailchimp.com/developer/marketing/docs/fundamentals/) | Concurrency limits can return 429 | Handle bursts and bounded retries rather than assuming low daily traffic is safe |
| [Mailchimp audience creation](https://mailchimp.com/developer/marketing/guides/create-your-first-audience/) | Creation uses explicit member status; pending represents unconfirmed signup | Verify new-contact behavior separately from existing-member preservation |
| [Brevo contact creation](https://developers.brevo.com/reference/create-contact) | Typed attributes, explicit update behavior and force-merge option | Validate types and forbid implicit merging/lifecycle changes |
| [Action Scheduler overview](https://actionscheduler.org/) and [API](https://actionscheduler.org/api/) | Job execution/logging and cleanup, not application delivery semantics | Record explicit outcomes; treat missing history honestly |

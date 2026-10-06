# Integration foundation: verification matrix

Companion to [the implementation plan](integration-foundation.md). This matrix
also identifies release gates that cannot be proven by local mocks.

## Evidence collected on the implementation branch

- PHPUnit: 2,341 tests and 13,937 assertions passed, including accepted mapping,
  boundary, provider write, metadata-access account checks, existing-contact
  policy and enquiry-purpose tests.
- Vitest: 3,389 tests passed in 181 files, including two integration UI
  interaction tests. Type checking, ESLint, PHPStan and source contract passed. The
  production asset build and Free/Pro basic, pro and elite staged package
  contracts passed; the destinations module ships only in the elite artifact.
- WordPress Playground boot verified both adapter registrations and account,
  selected-schema and recent-history REST route registration. It did not make
  live provider calls.
- The UI guideline pass replaced ad hoc mapping controls with shared inputs,
  native labeled selectors and a full-row disclosure, added the automatic-field
  summary and pre-send target/policy review, and put account removal behind the
  plugin's shared destructive confirmation. The disposable WordPress visual
  suite passed 20 Settings/dialog cases across desktop/mobile, LTR/RTL and
  full/empty/loading/failed states. Its fixture does not exercise remote
  accounts or the campaign mapping panel; those specific visual states remain
  open below.
- The legacy `bin/verify-destinations.php` fixture still assumes the old
  LeadCapture dispatch event rather than the current progressive
  JourneyCapture path; its 18 failures are not evidence of working or broken
  remote delivery and require a fixture update.
- The Mailchimp/Brevo live-account checks below remain pending because no
  provider test accounts are available in this workspace. Do not treat the
  mocked provider responses as release acceptance for confirmation emails,
  existing-contact behavior or provider automations.
- Mailtrap (2026-10-06) is in the same state: mocked contract tests against the
  published Contacts spec, with every live gate under "Real WordPress and
  provider checks" still open. Known limitations, documented rather than fixed:
  - Keep mode, interrupted first write: if the timeout lands after the bare
    `PATCH` created the Contact, the retry sees `updated` and skips the fields,
    so the new Contact can lack its name. Lost data, not changed data; ADR 0110
    makes no exactly-once claim.
  - In keep mode a "Contact created" automation fires before the fields arrive;
    "Added to list" fires after them.
  - A deleted name field or list most likely answers `422`, so each Lead fails
    `terminal` until the live check shows the error body. Settings already flag
    the missing saved field.
  - `requirements()` is static, so the summary shows Name as automatic even when
    "Name goes to" is cleared.
  - `Retry-After` is not honoured, the existing shared gap.
- On 2026-09-29 the two adapters were checked against the providers' published
  API references, including auth, contact writes, list/field metadata and
  response shapes. The review fixed Brevo `425 Too Early` classification and
  made full-page discovery use reported totals; official provider marks were
  added to account and destination UI. See the adapter onboarding note for
  source links. Targeted PHP/JS tests, typecheck, lint, admin builds and local
  WordPress UI review passed. This is documentation and mocked-contract
  evidence, not the live-account acceptance described below.

## Open acceptance gaps found in the coverage audit

These are requirements of the plan, not post-release polish. The draft PR must
remain open until they are either implemented and verified or an explicit plan
change narrows the release.

- Provider list/field discovery still reads multiple pages into a fixed cap;
  there is no 50-item load-more/search UI. Incompatible field types are omitted
  rather than explained in the selector.
- Draft mapping structure is checked on publish, but not on draft save. The
  draft sample endpoint checks selected targets and sample lengths, but it is
  not tied to the selected campaign/submission to verify source eligibility.
  Provider-specific maximum lengths are not enforced before sending.
- Action Scheduler markers have outcome and attempt, but no allowlisted reason
  code or next retry action ID. Backoff has no jitter or validated Retry-After
  support. The recent list has no retained-Lead link or overdue queue advice.
- The 320/360px, RTL, keyboard and long-label browser review of the new mapping
  and account controls still needs a configured provider fixture. The general
  Settings visual cases above do not establish those states.
- Live provider accounts and a MySQL-backed WordPress setup are still needed
  for the provider behavior, scheduler-version and interrupted-handoff checks.

## Contract and behavior checks

| Scenario | Required result | Test seam |
| --- | --- | --- |
| Account A and account B have different lists | Switching accounts fetches the correct lists; stale responses cannot overwrite current choices | Metadata REST + settings UI |
| Two audiences have different custom fields | Field choices/cache follow the selected audience | Metadata reader |
| Invalid credential replacement | Existing credentials remain usable; candidate failure is shown safely | Account write/test |
| Same Connection ID receives credentials for a different account | Reject replacement and require a new account where identity is verifiable | Account identity check |
| Connection deletion while in use | Explain saved/live references and refuse dangling account deletion | Account CRUD + usage |
| Provider/Connection type mismatch | Server rejects it regardless of browser controls | Destination writes |
| Read masked credentials and save unrelated fields | Mask never replaces the real secret | REST serialization/write |
| One provider metadata request fails | Local destinations and other provider setup remain usable | Index + discovery |
| Provider has many lists/fields | Pagination works without truncating the saved selection | Discovery pagination |
| Newsletter with only email/name | No custom mapping required; summary is truthful | Campaign UI + adapter |
| Same Destination, two different campaigns | Each sends only its own accepted mapped answers | Published config → worker |
| Draft mapping edited, not published | Live captures use published mappings | Capture selection |
| Draft test send | Uses explicit current draft after validation; makes no campaign/Lead write | Test endpoint |
| Question/choice renamed | Question mapping remains; old accepted values/labels remain frozen | Editor + snapshot |
| Whole campaign/variant duplicated | Valid mappings follow regenerated source/submission IDs | Duplication operation |
| One mapped question duplicated | New question does not silently compete for the same target | Editor operation |
| Mapped question removed then Undo | Removal and restoration include dependent mapping | Editor operation |
| Conditional question not visited | No value sent for that question | QuestionCapture → mapper |
| Optional answer blank | Omitted; never clears an existing provider field | Mapper + adapter |
| Same provider target selected twice | Actionable structural validation error | Mapping validator |
| Mapping targets email/status/blacklist/consent | Rejected by server allowlist | Mapping validator |
| Captured enquiry and multi-choice text | Preview exactly matches text sent; provider length checked | Projection + mapper |
| Target field deleted or type changed | Selection retained visibly; affected push needs repair, no silent omission | Discovery + worker |
| Required provider value absent | Clear incompatibility; capture stays local; no false success | Requirements + worker |
| Full captured name contains several words | Whole name preserved; no guessed surname split | Adapter |
| Pro quiz completes anonymously | No Lead, queue push or answer export is created | Capture path |
| Email then optional SMS | Separate accepted routing; no email/resource replay | SubmissionDispatcher |
| Mapping edited after capture before retry | Retry uses accepted map/value snapshot | Worker |
| Audience/account/update policy changed after capture | Route identity mismatch prevents automatic retargeting | Worker guard |
| Key rotated within same account | Existing queued jobs can use new credentials | Worker + Connection |
| Lead erased/pruned before send | No remote call; no reconstructed personal log data | Worker + privacy |
| Destination removed/provider absent | Safe skip/repair outcome; no fatal or infinite retry | Worker |
| Keep existing details | Existing values and lifecycle remain; new Contact gets selected fields | Provider contract/live |
| Update mapped fields | Only present eligible non-identity values changed | Provider contract/live |
| Create race / timeout after remote write | Replay does not duplicate Contact or alter lifecycle | Adapter sequence |
| Provider rejects one record | Record problem visible; not misrepresented as provider outage | Result/health |
| Revoked key/missing permission | Needs repair; no blind five-attempt loop | Result/scheduler |
| Rate limit/temporary failure | Bounded scheduled retry, provider delay respected where available | Worker/scheduler |
| Unexpected adapter exception | Sanitized unknown/repair result; diagnostic not lost | Worker |
| Retry enqueue fails | Never displays Retry scheduled without an actual next job | Queue/outcome writer |
| Scheduler Completed but adapter rejected | Recent history reports the adapter result | Outcome reader |
| Timeout after provider acceptance, no outcome log | Unknown, never proven failure/success | Outcome reader |
| Scheduler claims Failed without provider result | Execution problem is distinct from provider rejection | Outcome reader |
| Cleanup removes completed attempts | Missing history displays Unknown | Outcome reader |
| Attempt predates outcome logging | Unknown; no inferred provider result | Outcome reader |
| Manual recovery repeats a successful send | Separate attempt; no exactly-once claim; effect explained | Recovery/history |
| Recent history requested for many Leads | Bounded queries; no N-action lookup per list row | History REST |
| WP-Cron/loopback unavailable | Queued/overdue processing explanation, not provider failure | Queue diagnostics |
| Provider response echoes secret/answer/control bytes | Logs, REST, health and failure ring redact it | DiagnosticSanitizer |
| Repeated test sends succeed/fail | No real-send health, count, Lead or history mutations | Test dispatcher |

## Real WordPress and provider checks

Use the repository's documented isolated WordPress/Playground setup and provider
test accounts. Exercise actual REST permissions, bootstrap, admin assets and queue
execution; mocked PHP responses do not verify those paths. Use a transactional
MySQL-backed setup for concurrency/handoff checks that depend on MySQL semantics.

- Record WordPress, PHP, WConvert build and negotiated Action Scheduler version.
  Exercise WP-Cron, supported CLI runner and the oldest supported scheduler version.
- Mailchimp: two accounts if available, two audiences with distinct fields, new
  Contact, existing Contact, unsubscribed fixture, invalid key, required merge
  field, deleted field and provider-managed confirmation behavior. Observe state
  in the provider test console; production code must not read lifecycle state.
- Brevo: distinct lists, text and incompatible attribute types, new/existing
  Contact, blacklisted fixture, identifier conflict and both write policies.
- Mailtrap: the account-free paths answer (else fall back to
  `/accounts/{id}/…` in the adapter's `request()`); `GET /accounts` returns one
  account for an account token; which token permission the Contacts API needs;
  `PATCH {email}` on an existing Contact is a no-op; a `PATCH` without `fields`
  leaves them untouched; adding a list to an unsubscribed Contact does not
  resubscribe it; a suppressed address stays unsubscribed; the `422` bodies for
  a deleted field or list and for the contact limit; "Added to list"
  automations fire for API additions.
- Prove update/preserve behavior and absence of re-subscription using provider-side
  evidence. If a provider does not expose test sandboxing, use clearly labelled
  test lists/accounts and explicit samples controlled by the tester.
- Provider-enforced throttling may be unsafe/impractical to trigger live; use
  faithful recorded/synthetic rate-limit responses for scheduling behavior and
  label that evidence as simulated. Do not manufacture load against production.
- Test mapping/error controls with keyboard navigation, field labels, focus after
  errors, loading announcements and narrow admin widths.
- Capture during an outage: local Lead persists, visitor gets capture
  acknowledgement, queue retries separately, and diagnostics show a useful reason.
- Interruption: before/after accepted save, queue enqueue, provider write and
  outcome log. Verify recoverable handoff, unknown remote outcomes and no invented
  exactly-once guarantee.

## Free / Pro and source contracts

Run the repository's existing PHP/JS behavior suites, static analysis, source and
artifact checks affected by each slice. On the final implementation, include:

```sh
composer test
composer phpstan
composer verify:source
composer verify:artifact
npm test
npm run typecheck
npm run lint
```

Use the build/release verification commands documented in README for the actual
Free/Pro ZIPs; run `bin/verify-destinations.php` on the WordPress fixture as documented.
Do not install all dependencies or run the entire application suite merely for a
documentation-only change.

- Free keeps local adapters and usable mapping/test/health controls, without
  remote implementation code or WConvert-originated HTTP in its capture path.
- Pro module registers Mailchimp, Brevo and Mailtrap in the existing registry; catalog and
  tier availability agree with the shipped files. License expiry alone does not
  disable an installed integration.
- Public projection contains neither credentials nor destination mappings;
  integrations add no visitor loader code/budget.
- Existing WSMS fill-empty and MailPoet new-subscriber-only behavior stays tested
  until an explicitly supported adapter policy replaces it. Retain tests that
  prevent Contact status/suppression and list-state changes.
- Update Data Map, privacy suggestions and provider setup docs to describe actual
  configured data flow, tests, recent history retention and recovery limitations.

## Completion evidence

For each slice record its commit, checks run, results, and any mock/live distinction.
Attach screenshots of basic signup setup, optional extra-answer mapping, account
repair and recent-history states when the UI exists. Record known provider
limitations explicitly. Checklists and green mocks alone are not live verification.

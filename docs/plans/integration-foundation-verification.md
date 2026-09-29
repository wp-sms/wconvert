# Integration foundation: verification matrix

Companion to [the implementation plan](integration-foundation.md). This is the
required evidence for future implementation; the checks below have not been run
as part of this documentation-only change.

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
- Pro module registers Mailchimp and Brevo in the existing registry; catalog and
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

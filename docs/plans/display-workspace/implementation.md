# Display workspace — implementation and verification

Read [the UX plan](README.md) and [the contract](rule-contract.md) first.
Implementation is not started. The prototype is a design reference, not a
production branch to merge. No issues, PRs, or published Campaigns are created
by this planning work.

## Systems that must change together

| Area | Existing anchors | Planned work |
| --- | --- | --- |
| Editor composition | `resources/admin/src/builder/rules/DisplayRules.tsx`, `Where.tsx`, `Who.tsx`, `When.tsx`, `HowOften.tsx` | Replace accordion composition with Option A; preserve placement composition and cross-tab focus links. |
| Draft and API types | `resources/admin/src/builder/api.ts`, draft model, readiness and Campaign details | One typed grouped plan, stable identities, atomic patches, dirty state, Undo, error paths. |
| Authoritative rule vocabulary | `resources/rules/manifest.json`, `src/Rules/RuleManifest.php`, `RuleVocabulary.php`, `RuleCatalogue.php`, `RuleLabels.php` | Group validation, semantic classification, inactivity declaration, server visitor leaves, translatable labels. |
| Saving/publishing | `src/Rest/OptinController.php`, `src/Optin/PublishedProjection.php`, `PublishedOptin.php` | Validate and compile the new contract; no lossy flat partition; preserve published/draft boundary. |
| Request targeting | `src/Frontend/Payload.php`, `RequestContextFactory.php`, `src/Targeting/*` | Page vetoes, grouped server predicates and partial evaluation, Goal prerequisites. |
| Runtime | `resources/loader/src/decide.ts`, `types.ts`, `shell.ts`, `payload.ts`, `modules/*` | ALL/ANY matching, leaf outcomes, event context, visibility and clock scheduling, module lifecycle. |
| Pro events | `pro/modules/premium-triggers/loader/*` | Fresh exit/scroll-up semantics; explicit click policy; shared module/event infrastructure. |
| Availability | `src/Rules/Degradation.php`, `src/Optin/Suspension.php`, related availability UI | Preserve authored plans on capability loss; explain suspension instead of silent widening. |
| Frequency and presentation | `src/Optin/Frequency.php`, `SiteFrequency.php`, loader `frequency.ts`, `state.ts`, `storage.ts`, presenter/recovery and Pro A/B modules | Session counts, explicit activation, family caps, collision and counting behavior. |
| Starting points | `src/Rules/RuleBundles.php`, `StartingPoints.tsx`, bundled Playbooks and validators | New-shaped examples, capability-aware offerings, exact review and atomic Undo. |
| Explanations | `rules/summaries.ts`, `targetingSummary.ts`, loader `inspect/*`, `src/Frontend/Inspector*` | Shared group outcomes and labels, sample-visit tester, live-page route and draft warning. |
| Special formats | Inline placement, ContentLock compatibility/readiness, Reopen, A/B projection/readiness | Preserve placement and capture contracts; refuse incompatible opening modes. |
| Data transparency | Data Map and privacy guidance providers | Describe actual session key, lifetime, writes, and blocked-storage fallback. |

During the first slice, inventory every flat-rule consumer using references to
`rules`, `triggers`, `conditions`, `partition`, `rulesOf`, and `hasTrigger`.
The table identifies anchors, not a complete rename list. In particular,
OptinController and PublishedProjection contain immediate-trigger checks for
content locking and related presentation features; these must understand modes.

## Delivery order

Deliver in dependent, reviewable slices. Each slice includes its UI/data/runtime
readers and relevant tests; do not merge a persisted field whose reader comes
in a later release. Internal refactors can land first while the existing editor
still works, but exposing grouped authoring waits for end-to-end support.

### 1. Ratify the contract and establish the matcher boundary

Resolve the four proposed product defaults listed in README: feature tiers,
bounded grouping, missing-module policy, and repeat/explicit-click behavior.
Record the ADR and inline amendments when adopted. Define shared fixtures for
simple ALL, simple ANY, alternative audiences, and guarded exit intent.

Extract the pure evaluation boundary needed by both runtime and simulation
without changing production behavior first. Add table-driven tests for the new
fixed-depth group truth tables and publish validation. Keep build ownership:
Free contains the generic matcher, Pro owns its evaluator modules.

Done when: the full schema and examples are unambiguous; invalid/empty groups
cannot widen eligibility; all old flat-rule consumers are enumerated.

### 2. Ship grouped Audience and ALL/ANY opening end to end

Implement API normalization/validation, compiled projection, request-time
partial evaluation, payload shape and runtime composition. Replace the flat
rule partition and update built-in bundles/Playbooks/fixtures in this slice.
Introduce the proposed availability policy and Goal prerequisites together
with groups; never apply old drop behavior to the new tree.

Connect minimally styled production controls to prove persistence and runtime
before layout refinement. Audit publishing, duplication, A/B variants, preview,
inspector, suspension and format compatibility. Do not add a long-lived feature
flag or maintain dual JSON writers to avoid this audit.

Done when: a merchant can save, reload, publish and observe
`20 seconds AND 50% scroll` and `audience A OR audience B` on WordPress.
Changing to ANY changes the observed result; checkout and Goal gates still win.

### 3. Complete event timing, inactivity, and explicit activation

Replace gesture latches with evaluation-event context, add minimum dwell,
visibility handling and inactivity. Keep elapsed-time navigation semantics.
Wire scheduler wake-ups so Campaigns can become active on a page already open.
Implement the unified explicit-click/Reopen admission policy, preserving
capture state and active-overlay collision behavior.

Done when: exit before minimum dwell never opens later without a new gesture;
inactive/hidden tabs do not accrue inactivity; clicks never wait for a background
automatic rule; no timer/listener leaks or duplicate presentation/counts occur.

### 4. Complete session pacing and its authoring

Add the bounded versioned session store and maxPerSession validation. Apply
Campaign/family and site gates correctly; maintain persistent completion and
dismissal semantics. Add once-per-tab-session options, explain conflicts with
Stop after closing, and encode the new-Campaign defaults only where intended.
Update Data Map/privacy text and browser-storage fallback explanations.

Done when: navigating/reloading in one tab respects the cap, A/B arms cannot
double it, storage denial has the documented fallback, and explicit activation
retains completion restrictions while bypassing automatic pacing.

### 5. Implement Option A as the only production workspace

Compose section navigation, active section editor and responsive summary using
existing admin components/tokens. Add progressive Audience controls, meaningful
opening modes, format-aware availability, contextual validation, and starting
point review. Preserve all existing controls and cross-tab deep links.

Use a single canonical draft and derived summaries. Do not remount inputs on
each keystroke or write the full Campaign back from a section's filtered view.
Keep sample tester code outside the initial editor/runtime bundles.

Done when: the four everyday tasks below work by keyboard and pointer, draft
edits survive section changes, starting-point Undo is atomic, and the layout
fits the required widths and long translations.

### 6. Add sample testing and finish real-page explanations

Build the sample drawer against the shared matcher, with a fixture/fact provider
instead of live storage/listeners. Render group-level reasons and only relevant
sample inputs. Keep it honest about page/account facts and unsaved draft state.
Adapt the authenticated live inspector to grouped server/browser outcomes and
missing capabilities, and retain existing permission/cache protections.

Done when: the same fixture produces the same decision in the matcher, runtime
test harness and sample tester; live inspection matches actual presentation;
sample testing sends no public capture/counting requests.

### 7. Verify, review, and replace the prototype reference

Run targeted tests while implementing each slice, then full required checks,
source/tier/build validation, responsive visual review and actual WordPress
verification for the integrated feature. Fix behavioral gaps before cosmetic
cleanup. Record evidence and known browser/storage limits.

Work on a feature branch with PRs; never push directly to main. If slices are
stacked, each must describe its dependency and cannot ship an inconsistent
contract. Complete `CI / Required checks` before merge. Remove temporary UI
variants and production-unused prototype code; retain this decision record
and acceptance evidence. The conversation prototype remains a historical design
reference, not a second maintained application.

## Merchant acceptance tasks

Use these tasks in a short usability walkthrough; proposed targets are design
checks, not claimed research results or analytics KPIs.

1. **Blogger:** start Engaged reader, use blog posts only, require 20s and 50%
   scroll, show once per tab session, stop after completion. Explain correctly
   why 25s and 10% scroll does not open it. Complete without opening advanced
   audience grouping.
2. **Store owner:** choose Cart reminder on product/cart pages, exclude checkout,
   require a nonempty cart and at least 15s, then exit. Explain why an early
   exit does not open at 15s by itself. Use actual store currency and pages.
3. **Marketer:** target `(mobile AND UTM source google) OR cart >= 75`, change a
   value, switch sections, reload the saved draft, and confirm the two branches
   retain their meaning. Explain that page exclusions apply to both.
4. **Service business:** configure a click-open enquiry form, provide its button
   selector, check on the real page, and distinguish automatic repeat limits
   from explicit opening and stop-after-completion.
5. **Returning editor:** open an existing Campaign, locate a stronger site-wide
   cap, follow a validation link to the correct field, apply a starting point,
   Undo it, and confirm the published version has not changed before publishing.

Aim for first-task success without support and a correct plain-language
explanation of ALL/ANY. If users cannot explain a group after configuring it,
fix wording/layout before adding more operators or rule types.

## Acceptance matrix

| Case | Required result |
| --- | --- |
| ALL time + scroll, only time met | Waiting; scroll is the unmet requirement. |
| ANY time + scroll, only time met | Eligible to open if universal gates pass. |
| Scroll reached first, time reached later | ALL opens when time is reached; threshold history is document-local. |
| Alternative audience A fails and B passes | Audience passes; no false warning from A. |
| One group ALL device + source | Both must match; source is current-page data. |
| Empty group, missing value or invalid selector | Repairable draft/readiness error; publication refused. |
| Unknown type, recursive group or bad operator | Request rejected; rule not silently removed. |
| Included page also excluded | Exclusion wins. |
| Selected pages mode with no pages | Incomplete; does not become Entire site. |
| Recover Cart plus broad audience OR group | Still requires a nonempty cart. |
| ALL login + browser rule | Server false excludes only that group; remaining OR alternatives remain correct. |
| ANY login + browser rule | A true server leaf resolves the group true; false does not remove the browser alternative. |
| Premium module or WooCommerce disappears | Authored Campaign suspended with reason; no changed audience/timing. |
| Consent withheld on one OR alternative | Independently true permitted alternative can pass; no withheld read. |
| Consent arrives after earlier exit | No replay; require a new exit gesture. |
| Exit before minimum time, later clock tick | Still waiting for a new exit. |
| Exit while ineligible, audience later changes | No replay. |
| Inactivity plus new input | Idle counter resets; threshold no longer holds. |
| Hide tab, wait, return | Hidden interval does not count toward inactivity; no exit replay. |
| Delay-JS | Elapsed time uses navigation start; no invented missed click/exit. |
| Future schedule on already-open page | Wake at start; do not become permanently inert. |
| Schedule ends | No new opening; active capture is not silently discarded. |
| Same session, navigate/reload after appearance | Configured automatic session cap applies. |
| A/B arm changes in a session | Shared family cap prevents a second automatic allowance. |
| Session storage unavailable | Current-document fallback; persistent completion behavior remains separate. |
| Site limit is stricter | Site veto wins; UI identifies the source. |
| Explicit click after dismissal | Can open under explicit policy if still eligible; no deferred surprise opening. |
| Explicit click after completion with stop enabled | Does not open. |
| Another overlay already open | Explicit request does not replace it or queue a later interruption. |
| Inline eligible without placement | Does not claim it appeared; inspector explains placement. |
| Content lock with incompatible opening | Publication blocked; existing readable-failure contract preserved. |
| Reopen during progressive capture | Keep existing same-page capture state; never reuse grant across Campaigns. |
| Starting point applied then undone | Every replaced field restored; unrelated settings untouched. |
| Simulator run on unsaved draft | Draft decision only; no save, publish, visitor state or analytics. |
| Live inspector while draft differs | Actual published behavior with clear version distinction. |

## Verification commands and environments

Use the repository's existing runners and targeted files while developing.
Relevant existing suites include loader-decide, loader-modules, loader-shell,
loader-engine, loader-explain, inspector parity, builder frequency/presets,
REST write/publish, rule-manifest parity, Targeting and published projections.
Add meaningful scenario tests at these boundaries rather than snapshotting
implementation details or creating a test per cosmetic component.

Integrated checks:

```sh
npm run typecheck
npm run lint
npm test
composer test
composer phpstan
composer verify:source
composer verify:templates
npm run build
npm run check:loader
```

Run the repository's required artifact contract and affected Playwright visual
suites through their documented build/CI setup. Record Free and every Pro tier
separately, including the bytes added by grouped matching/inactivity. Respect
the existing loader budget checks, with the user-approved paid cap amendment
to 20,480 B in ADR 0104; do not invent a second performance budget or ship
admin simulation machinery in the public loader.

On real WordPress or the documented Playground setup, verify activation,
assets, a Free lead-generation Campaign, Pro exit/click, WooCommerce cart state,
logged-in vs anonymous pages, caching/delay-JS, consent changes, and special
formats. Unit tests alone are not proof that the plugin boots or a popup opens.

### Implementation verification — 2026-09-23

- PHP: 2,079 tests / 10,209 assertions pass; PHPStan passes.
- JavaScript: all 127 files / 2,643 tests pass with two workers; focused workspace,
  summary and sample-test checks also pass after final UI refinements.
- TypeScript, ESLint, source contract and all 57 template registrations pass.
- Full Free/Pro admin, block, loader and inspector builds pass. Release staging
  and artifact checks pass for Free, Basic, Pro and Elite.
- Gzip loader sizes with CI’s Node 22: Free 13,152 B / Basic 19,278 B /
  Pro 20,276 B / Elite 20,465 B. All fit their enforced caps (14,012 / 20,480 B).
- Real WordPress: create, edit an ALL time-and-scroll opening, save, reload,
  publish, wait-and-scroll appearance, then reload with session allowance
  exhausted. Published inspector reflects both waiting and capped states.
- Workspace inspected at 320, 390, 768, 1024 and 1440 px with no horizontal
  document overflow; mobile inputs wrap and the summary can collapse.
- Reopen browser suite: 8/8 pass. Updated inline workspace browser scenario:
  passes automatic placement, content-lock preview on desktop/compact widths,
  RTL, keyboard focus and both publish flows.

The broader combined content-lock/inline browser run passed 21/27 scenarios.
All six failed scenarios pass on isolated reruns: one navigation scenario was
updated for the new workspace; three Gutenberg startup/Welcome-dialog cases
and two Playground navigation/network failures passed unchanged in a fresh
environment. Actual
WooCommerce cart, third-party consent providers and cache/optimizer products
were not installed for this local smoke test; their adapter and rule behavior
is covered by the automated suites, not claimed as a live integration matrix.

## Definition of done

- Option A is the actual Display tab, with all existing settings represented.
- Every included capability has working editor, persisted contract, runtime,
  summary, validation, inspector, and applicable starting-point support.
- Grouped rules never weaken exclusions, Goal prerequisites, schedule, or
  automatic site-wide limits.
- The tested decision is the running decision; simulation is clearly labeled.
- Free/Pro boundaries, privacy/storage facts, inline/recovery contracts and
  progressive capture remain intact.
- Required checks and actual WordPress verification are recorded; proposed ADR
  amendments are applied together with the adopted implementation contract.

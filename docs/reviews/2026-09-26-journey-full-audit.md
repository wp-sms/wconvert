# Journey B → plugin: consolidated audit

**Reopened September 27:** the owner identified continuing Add screen and right-panel
mismatches. The prior “closes the identified gaps” conclusion was too broad:
feature availability did not establish the same editing experience. Follow the
[interaction acceptance review](2026-09-27-journey-interaction-acceptance.md) for
current status. Retain the evidence below without treating it as completion.

September 26, 2026. This supersedes the four open implementation items in
`2026-09-26-journey-visual-parity.md`. It does not turn earlier test results into
proof of the current revision. The owner requested one consolidated audit and
implementation pass, including small interactions, instead of repeated spot checks.

## Acceptance basis

Primary user: merchants who rarely build conditional flows. Independent matching
follow-ups must all run and feed one enquiry. Exclusive branches use visible
first-match priority. Quiz results may be available without contact details.
Back retains still-relevant answers. The map should make these decisions clear
without requiring dragging. Existing graph drafts, simple campaigns and progressive
email/SMS saves must remain editable. PR #190 stays draft; no merge or GitHub CI.
VoiceOver remains unverified at the owner's request.

Compared the running B prototype (Multiple interests, plus the source definitions
for signup, coffee, empty, garden, progressive and large journeys) with the
actual WordPress plugin. Prototype sources: `Graph.jsx`, `App.jsx`,
`ScreenTools.jsx`, `JourneyExperience.jsx`, `CampaignWorkflow.jsx`,
`EditingTools.jsx`, `MapExperience.jsx`, `PreviewAndTest.jsx`.

## Inventory and disposition

“Retained” means implemented behavior was inspected in source and its relevant
regression suites, not that every possible combination was manually exercised.
The browser evidence section identifies exactly what was exercised live.

| Area / merchant task | Finding and disposition | Evidence / coverage |
| --- | --- | --- |
| Campaign-level Journey / Design / Display rules / Destinations | Retained persistent workspace and navigation; selection bridges to Design | Editor navigation and draft-history suites; browser tabs |
| Understand when the popup appears | Retained compact display summary and direct rules link | Display workspace + sample matcher suites |
| Understand where an enquiry goes | Retained destination summary, save-card link and real destination configuration | Destination suites; no fabricated provider settings |
| Keep broad map controls separate | Previously fixed floating view tools, separate zoom and pan, contextual selection controls | Earlier desktop/320/390 browser audit; rechecked desktop |
| Find the beginning or selected screen | Retained Start, Fit journey, Focus selection and search with focus handling | Map camera and grouping suites |
| See every relevant follow-up | Retained grouping and independent show conditions; expand/edit/regroup | Enquiry and branch-group fixtures; live enquiry |
| Read a large map at low zoom | **Fixed:** semantic overview retains name, first-screen/type, condition, branch count, save/result/ending cues without changing node dimensions | Source geometry design; browser overview check |
| Move a card without re-layout on every move | Retained measured layout and routing while dragging; one smart-edge route subscription per edge, shared by line and insert control | Existing drag regression + browser move |
| Select screen and understand related paths | Retained structural highlighting with clear control; distinct from tested visitor path | Map-selection tests |
| Act directly on a selected card | **Fixed:** screen-space toolbar for edit, preview and add; direct preview icon and add-next action | Browser desktop + grouping tests |
| Insert between screens on the map | **Fixed:** plus control on routed edge, including edges entering/leaving collapsed groups; preserves original connection identity and condition, including an unavailable question location after a save instead of silently moving it | Insertion tests; browser cancellation/insertion |
| Add a screen with a clear purpose | **Fixed:** Continue / relevant follow-up / exclusive branch choices with consequence copy | GraphScreenInsert; browser dialog |
| Name and choose the new screen type before adding | **Fixed:** question, message/offer and ending types, optional name, contextual location | Insertion + ending tests |
| Use an existing screen without dragging | **Fixed:** explicit existing-screen destination picker, excludes loops, preserves existing connection identity; reuses bypass impact review | Connection helpers + browser review |
| Create an exclusive branch | **Fixed:** add dialog chooses question/answer, appends priority and leaves fallback unchanged; new non-ending screen rejoins fallback | New branch tests including overlapping multi-select match |
| Add every matching follow-up | **Fixed/retained:** explicit independent intent; show rule and shared hidden continuation choice | Insertion tests compare garden/balcony/both routes |
| Finish a path | **Fixed:** ending screen has no phantom continuation or save; bypasses require impact review | Ending helper test + shared graph impact review; redundant old endings can be removed while the last ending stays protected |
| Collect another channel | Retained dedicated optional-capture workflow; linked from new-screen dialog when eligible | Capture insertion/removal + progressive tests |
| Contact screen conveniences | **Fixed:** optional owned name field, plain-text details-use note, and visitor answer review using the real visited path; shared live/test renderer | Capture settings/ownership and mounted runtime regressions; live Back and save/reload checks |
| Avoid inventing a second enquiry submission | Deliberate production adaptation: reuse existing contact screen for combined enquiries; optional channel uses explicit ownership/consent workflow | Submission ownership and boundary validation |
| Understand how a screen is reached | Previously fixed expandable Arrives from with default/answer/hidden distinction and source links | Arrival summary suite |
| Edit screen visibility without overwhelming content | **Fixed:** compact disclosure summary; conditional rules visible and repair links reveal/focus exact controls | Repair tests, browser inspector |
| Edit questions, answer labels and requiredness | Retained stable answer values and linked-rule labels | Editor / readiness suites |
| Remove an answer used by conditions | Retained usage review, replacement and one undoable mutation; minimum choices remain enforced | Answer replacement suites |
| Explain outgoing branch priority | Retained named answer paths, first-match notice, explicit Everyone else, reorder and condition editor | Route/settings suites |
| Explain hidden continuation | Retained explicit destination separate from fallback, missing-exit repair and insertion semantics | Graph insertion + repair suites |
| Prevent cycles while drawing or choosing targets | Retained cycle-safe target helpers | Authoring tests |
| Review a redirect that bypasses screens or saves | Retained impact dialog and unchanged Cancel, now reused by new existing/ending actions | Graph impact/editor tests |
| Duplicate a simple screen | **Fixed:** new IDs, working Back, preserves show condition and combined save; no accidental duplicate submission | New graph-screen-actions tests |
| Move a simple screen | **Fixed:** reconnects previous and target paths in one Undo edit; preserves IDs and rejects invalid dependencies/boundaries | New move tests |
| Explain unavailable duplication/moves | **Fixed:** explicit explanation for capture/results/endings/branching/conditional/shared cases | GraphScreenActions UI |
| Delete screens and captures | Retained distinct impact-aware removal workflows, owned field/consent handling, cancel and Undo | Graph removal + capture removal suites |
| Results before or after contact | Retained goal-specific access and validation; no compulsory capture for quiz | Quiz/capture/access tests |
| Configure matching and fallback results | Retained first matching result, selected result settings, product/fallback repair | Result and publication repair suites |
| Preview just one screen | **Fixed:** real renderer, Desktop/Mobile width, appearance-only explanation, Edit / Test actions | Live preview + modal checks |
| Walk a visitor through the real screen | Retained real renderer with local simulation, not a second invented visitor implementation | JourneyTest suites and browser enquiry |
| Explain why a path was chosen | Retained evaluated decisions, skipped/bypassed/current/future distinctions | JourneyTestProgress + browser walkthrough |
| Show the tested path on the map | **Fixed:** exact visited screens and evaluated connections; clear action; future screens not predicted; a hidden/default shared physical line uses the evaluated alias | Test/map integration |
| Change an earlier answer | Retained relevant answers only and accepted submission snapshots | Back/pruning/capture suites |
| Handle rejected save and destination failure separately | Retained simulation, retry and accepted ledger; no duplicate save on delivery retry | JourneyTest and delivery suites; live rejected-save retry |
| Empty/error product states | Retained simulation and honest note that product catalog is not fetched | Product test modes |
| Save draft / review / publish | Retained real draft validation, repair links and publication guard | Builder/publication suites; QA draft review |
| Setup guide / walkthrough badge | Deliberate adaptation: production uses live readiness/repair and Try answers; prototype's session-only completion counter is not a production publication prerequisite | Prototype EVALUATION amendments + existing readiness UI |
| Start from a template | Retained actual goal-specific starting-point workflow; prototype demo selector is not a production feature | Goal/starting-point suites |
| Responsive / focus / keyboard / RTL | Retained responsive map/details and portal controls; added modal focus restoration and fixed token sizing | Narrow browser checks + keyboard/RTL regression suites |
| User-facing experimental A/B switch / demo Publish | Excluded intentionally; real saved/published state remains authoritative | Prototype-only functionality |

## Verification record

### Browser scenarios in this pass

- Actual WordPress enquiry: Garden + Balcony asks both, skips Indoor, retains
  typed email through simulated save failure, and creates one accepted simulated
  snapshot with only encountered answers. No real Lead is sent by Test journey.
- Insert on the grouped entry, duplicate the added screen, move it to another
  connection, and undo all three edits back to a disabled Save draft button.
- Existing-screen redirect shows bypassed screens and required Contact save;
  Cancel leaves the draft intact. New exclusive Garden branch retains fallback
  and rejoins it; Undo restores the original.
- Post-save line insertion preserves its original connection while explaining
  why questions are unavailable. Switching to an ending keeps that connection;
  impact review names the old ending, redundant-ending removal works, and two
  Undos restore the saved draft. Low-zoom group/card summaries were checked in
  the final build. The quiz's shared hidden/default line remains highlighted
  for a skipped Garden screen while future result lines stay dimmed.
- Desktop/mobile screen preview uses the actual screen appearance; Test opens
  the routed visitor preview. Card movement preserves attached connector ends
  in observed before/after frames (not a frame-by-frame flicker proof).
- New-screen dialog at 390 and 320 pixels: no document horizontal overflow,
  scrollable content, visible action footer, matching-answer requirement,
  Escape and return focus. The name field now uses the shared styled Input.
- Quiz: Balcony skips Garden; exact visited-path view excludes future result
  and ending. Moving result access before contact allows result → optional
  signup → No thanks → ending without a simulated save. Undo restores draft.
- Contact conveniences: enable optional name, answer review and details note;
  Test shows readable choice labels and no skipped answers. Back from contact
  through Garden, change to Balcony, then contact: only Balcony answers remain.
  Save draft → reload preserves all three controls. The unpublished QA draft
  was backed up and restored exactly through the repository; no publication.

### Local verification

- Full JavaScript suite: **167 files / 3,063 tests passed**, serial worker run.
  A preceding concurrent run had timeout failures; its two affected suites
  subsequently passed in the focused 188-test run and again in the full run.
- The later contextual-insertion correction passed **47 JourneyEditor tests**,
  including a new regression asserting the chosen post-save connection remains
  selected while changing from question to ending. This one new test postdates
  the 3,063-test full-suite count.
- PHP: **2,135 tests / 11,435 assertions**. After the documented byte-cap
  amendment, the loader-contract suite separately passed **23 / 38**.
- TypeScript, ESLint, PHPStan (459 files), source contract and whitespace checks
  passed. All 60 template designs passed registration.
- Full production build, followed by final Free/Pro admin rebuilds after the
  contextual correction, passed. Vite still reports the existing large admin
  chunk advisory; it is not a visitor-loader budget failure.
- Gzip-9 loader sizes: Free **13,953 B**, Basic **24,473 B**, Pro **25,430 B**,
  Elite **25,687 B**. Loader scans, amended caps, phone asset and combined phone
  totals pass. Phone asset **14,599 B**, below unchanged **16,384 B** limit.
- Free, Basic, Pro and Elite installable ZIPs were rebuilt from the final assets;
  each artifact contract passed. Nothing was merged or published.
VoiceOver is **unverified**, explicitly deferred by the owner. GitHub CI was
explicitly waived; no remote green status is claimed. Merchant user testing has
not been performed; the existing session guide remains the recommendation for
judging ease of use before replacing the old experience broadly.

### Release scope and honest limits

The inventory closes the identified prototype implementation gaps; it is not
proof that no undiscovered bugs exist. Retained rows rely on the named regression
coverage plus earlier browser evidence, rather than pretending every permutation
was clicked again. Ten questions on one connected route, protected shared capture
ownership, and manual preparation for complex result/capture rearrangements remain
deliberate product constraints, documented in ADR 0108 and the readiness UI.

The answer-review addition required a measured paid-loader budget amendment:
256 bytes per paid tier, with Free unchanged. ADR 0108 records measurements and
rationale; checks remain blocking. No budget failure is reported as an old-cap pass.


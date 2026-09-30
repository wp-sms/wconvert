# Flow editor UX improvement plan

Date: 29 September 2026. Status: product changes from phases 1–4 implemented
after `git pull --ff-only`; the review branch is `codex/flow-ux-polish`. Automated
checks, sampled WordPress journeys, a live 20-screen map, RTL, and actual 200%
browser zoom pass. Merchant sessions, spoken screen-reader testing, and comparative
performance measurements remain pending. See the
[follow-up review](../reviews/flow-editor-ux-2026-09-30/verification.md)
for the exact scope and evidence; the acceptance plan below is not a claim that
every proposed check has been completed.

## Recommendation and outcome

Keep the existing Edit/Flow workspace, horizontal map, screen inspector, routing
model, and shared draft history. Improve readability, the explanation of decisions,
and the connection between editing, testing, and repairing a journey.

A merchant should be able to answer four questions without opening every card:

1. Where does a visitor start and finish?
2. Which questions will this visitor see, and why?
3. Where are details saved, and which signup is optional?
4. What needs fixing, and how can I check the change?

The supplied infrastructure screenshots are visual references, not specifications.
Other products provide useful patterns, not evidence that their entire UI suits
WConvert. Prefer task-based improvements over copying a theme or canvas layout.

## Evidence and current baseline

The live Demo 04 was inspected in Flow at a 1512px-wide browser viewport, both
with the entry selected and after Fit journey. The current source, ADR 0108,
design guidelines §§21–22, and September 27–28 implementation reviews were read.
This is a developer assessment, not a merchant usability study.

| Area | Already present | Work proposed |
| --- | --- | --- |
| Editing | Edit/Flow switch, shared inspector, contextual insertion, explicit connection mode, undo | Preserve; reduce repeated controls and text |
| Layout | Horizontal sequence, optional detours, priority lanes, shared rejoins, obstacle routing, RTL support | Preserve semantics; verify framing after density changes |
| Scale | Grouped follow-ups, search, zoom, Fit, selection focus, compact cards below a zoom threshold | Improve overview readability and predictable selection |
| Emphasis | Related-path highlighting | Replace whole-card opacity of `.35`; important downstream content currently becomes difficult to read |
| Cards | Type icons, summaries, path lists, save information, preview actions | Reduce duplicated prose while retaining behavior-critical information |
| Repairs | Readiness issues with precise repair targets; dependency review and return navigation | Expose the same issues on the map and through one issue list |
| Testing | Sample answers, visitor walkthrough, visited-path highlighting, change-specific suggestions, failure simulation | Make entry points and evidence states clearer; preserve existing behavior |
| Safety | Required-capture checks, answer-use review, removal impact, optional-signup handling | Retain and exercise across scenarios |

The following are evidence gaps, not proven defects: first-use comprehension,
live screen-reader behavior, a complete live RTL pass, and dense-map performance
across the full supported range. Resolve them explicitly during validation.

## Scope and constraints

- Presentation and authoring UX only. Do not change stored route meaning, capture
  ownership, conversion counting, consent semantics, or runtime limits.
- Layout movement is not visitor order. Keep Edit connections explicit; preserve
  the select-based alternatives to drawing and reconnecting.
- Preserve version 2 behavior and version 3 graph behavior. Opening or viewing a
  campaign never migrates it. At most ten questions on a connected v3 route
  remains the current limit; a larger total question bank across exclusive
  branches does not establish a new supported scale promise.
- One matching branch wins in saved priority order. Independent follow-ups can
  all run, one at a time. A false show condition follows the hidden continuation.
- Keep one shared save/result after a merge. Required capture cannot be bypassed.
  Optional later submissions add to the same Lead; anonymous results create no Lead.
- Use existing design tokens, icons, and components. A new library, theme, routing
  engine, generic workflow platform, or persistent test-history store is not needed.
- Keep this work within the admin. Do not increase visitor-loader cost for canvas
  improvements. Update affected design guidance alongside implementation; change
  ADRs only if an accepted contract actually changes.

## Scenarios that drive the design

| ID | Scenario and merchant task | Required presentation and behavior | Acceptance example |
| --- | --- | --- | --- |
| S1 | Simple email signup → acknowledgement | Short readable sequence; clear save point and ending; no branch-specific instructions | Merchant finds the signup, edits its heading, previews it, and returns without opening routing settings |
| S2 | Message/offer → external link, with no capture | Show the actual click action; do not invent a save point or force every campaign into a branching workflow | Merchant can explain that this campaign sends a visitor to a link and does not create a Lead |
| S3 | Email signup → optional SMS → ending | Primary save and optional addition are visibly different; Skip is a real outcome | Submit email, skip SMS: one simulated Lead and one converting act; submitting SMS adds details rather than another Lead |
| S4 | Home versus business enquiry | Separate alternative lanes, named conditions, explicit Everyone else, one shared enquiry after rejoin | Follow each branch independently; shared enquiry appears once on the map and once in each walkthrough |
| S5 | Select several interests and answer every relevant follow-up | Group says “Ask every match”; membership and order can be inspected; continuation is named | Select two of four interests: ask exactly their two follow-ups in saved order, then submit one combined enquiry |
| S6 | One optional detour | Main continuation remains identifiable; matching and nonmatching behavior are visible | A coffee answer can include a grinder question or skip it; both routes reach the shared result |
| S7 | Several branch conditions match | Priority appears where it matters; fallback stays last and unnumbered | In a test with two matching rules, explanation identifies the first winning rule; later matches do not run |
| S8 | Conditional screen or missing source answer | Distinguish hidden screen, alternate branch, and unanswered/unvisited source | A negative condition does not match merely because its source was never answered; hidden continuation can be inspected |
| S9 | Anonymous quiz result with optional signup afterward | Result selection and capture are separate concepts; selected result is not proof of contact capture | Finish anonymously with no Lead; submit optional signup afterward without counting another conversion |
| S10 | Required contact capture before a result | Save boundary is visible; invalid bypass is actionable | Reroute around required capture: existing validation blocks publication and repair opens the offending path |
| S11 | Product recommendation with unavailable products | Preserve the selected result and its fallback; product availability is separate from route validity | Missing catalog data does not select a different quiz category; test explains the limitation and fallback |
| S12 | Add/remove/reorder a follow-up or retire an answer | Explain visitor impact, preserve shared content, expose Undo and Test this change | Remove an exclusive follow-up while keeping shared collection; Undo restores content, IDs, rules, and connections |
| S13 | Incomplete or broken draft | Visible issue count, affected card/group marker, exact repair link | Missing fallback, invalid answer reference, disconnected screen, or missing hidden exit opens the appropriate control |
| S14 | Larger or nested journey | Search, grouping, readable local focus, honest overview; external entries stay explicit | Locate a named screen, inspect a nested branch, and return without losing the viewport or falsely grouping unrelated paths |
| S15 | Narrow screen, 200% browser zoom, keyboard, RTL, long labels | Settings remain usable; map may pan; reading direction and focus remain correct | Add a follow-up and repair a rule without dragging; no horizontal overflow in inspector/dialog forms |
| S16 | Legacy campaign and unavailable paid/integration capability | Preserve existing behavior; explain unavailable actions at their point of use | Viewing a legacy campaign changes no routing; missing capability never silently drops questions or conditions |

Exercise S5 with none selected when permitted, one, several, and all answers.
Exercise S4/S6/S7 with matching and fallback paths. For S8/S9, go Back and change
an earlier answer: abandoned answers must disappear from the active path, while
accepted submissions retain their existing immutable snapshot semantics.

## Detailed interaction decisions

### 1. Separate normal viewing, selection, and test evidence

Normal view keeps all cards and essential connections readable. Selection adds a
clear border/focus treatment and emphasizes the relevant paths. It does not fade
all other card text. Lowering emphasis may affect decorative surfaces, but never
the ability to read names, save boundaries, issues, or endings.

Keep an optional related-path highlight if useful, but distinguish it from a test
trace. Use visible wording for “Related to this screen,” “Sample path,” and
“Visited in this test.” An ordinary selection must not resemble evidence that a
visitor actually took a route.

Measure contrast in the real WordPress cascade, including muted, selected,
overview, hover, focus, and issue states. Target WCAG AA: normal text 4.5:1,
large text 3:1, and essential graphical/control indicators 3:1 where applicable.
Do not claim compliance based on the uncomposited color token alone.

### 2. Give cards a stable, small information hierarchy

Use this default anatomy:

- Header: type icon and text; Start or Paths rejoin where applicable.
- Main: merchant's screen name, then one useful content summary when it adds
  information beyond the name.
- Behavior: a short label such as “Choose one path,” “Ask every match,”
  “Details saved here,” “Optional signup,” or “Journey complete.”
- Attention: explicit issue indicator when action is needed.

Remove repeated full outgoing-rule lists from the default card when the same
decision is already represented by labeled connections. Keep full conditions,
priority, destinations, and hidden continuation in Next screen. Do not hide the
fact that a rule exists, save ownership, optionality, or a blocking issue.

Shorten a connection label only when its meaning survives. “My home” can be
sufficient for a branch from the immediately adjacent home/business question;
a condition referring to a different question needs its source context. Keep
negation, any/all/none meaning, and priority where relevant. Complex conditions
wrap or use a clearly labeled disclosure; never silently truncate decisive text.
The full rule remains available to keyboard and touch users, not only on hover.

Selection must not expand card dimensions or trigger a graph relayout. Existing
compact overview behavior should simplify all cards consistently, including the
selected card; selection stays indicated without retaining a tiny dense card.
Keep overview versus detail behavior predictable near the zoom threshold and
avoid rapid switching while scrolling. Clicking an overview card focuses a
readable local view; Fit remains an explicit overview action, not the default
response to every edit.

### 3. Keep grouping honest and useful

A collapsed follow-up group shows its name, question count, “Ask every match,”
shared continuation, and any contained issues. In a sample/test trace it may
show “2 of 4 shown,” labeled according to the source of that evidence.

Provide a clearly named disclosure to inspect member names, source answers, and
their order without exposing every connection. Keep “Edit individual connections”
as the explicit action to expand the graph. Selecting an individual follow-up
through the inspector/navigator must not unexpectedly explode the group.

Use compact member rows rather than nested full cards. Do not cap a group at a
fixed height that makes its only controls unreachable. Reserve measured space
when an explicit disclosure changes dimensions; keep the group anchored and
connections attached. Retain conservative grouping: outside entries, nested
forks, or custom routing must not be disguised as an ordinary follow-up sequence.

### 4. Consolidate controls while preserving clear scope

Keep the campaign header responsible for undo/redo, Preview & test, save, and
publish. Keep one journey row for Edit/Flow, search, Add screen, and Focus journey.
Retain Display rules and Destinations as compact context links; show expanded
explanation when requested or when a real issue changes the next action.

Replace the separate always-visible instruction and selected-action rows with
one reserved context row where practical. In ordinary browsing it shows the
selected screen and Preview/Add after actions. In Edit connections it prioritizes
the mode label, Done connecting, and the relevant instruction. A group uses an
honest group action rather than a misleading Add after that implies one branch.

Keep selection actions outside the pannable canvas as required by the current
guidelines. Do not move them onto floating cards where they obscure paths.
The top Add screen opens the general insertion chooser; a contextual action
names the selected path/location. Keep those scopes distinct in labels and in
the insertion preview.

Use one compact canvas navigation cluster: minus, zoom percentage, plus, Fit
journey, and Show selected. View options contains Start, Tidy up, grouping,
preview display, related-path emphasis, and click-based pan controls. Keep Edit
connections easy to discover outside this secondary menu.

Reserve actual toolbar bounds in Fit and selection framing. At narrow widths,
controls wrap or use the existing overflow pattern; they never cover the
selected node or focused settings. Display zoom percentage without adding a new
editable zoom input unless task testing demonstrates a need.

### 5. Make repairs available where the problem appears

Reuse `journeyReadinessIssues`, boundary checks, and the existing `JourneyRepair`
targets. Do not create a second validator inside the map. Share/deduplicate issue
data between Flow and publish review. Keep any new severity taxonomy aligned
with authoritative publish behavior rather than inventing a new blocker list.

When issues exist, show one “N issues” entry and markers on the affected screens
or connections. Collapsed groups summarize contained issues and open the exact
member on activation. Multiple issues on one card use one marker with a list,
not overlapping icons. Do not show warning styling on every valid card.

Opening an issue selects and reveals the correct screen, opens the relevant
Content or Next screen section, expands the exact rule, and moves keyboard
focus to the repair control. Preserve Back to issues and existing dependency
review return behavior. Correcting a rule updates the list without unexpectedly
moving focus; undo restores the issue if the defect returns.

Incomplete typing is allowed in a draft. Avoid modal interruptions or red error
announcements on every keystroke. Evaluate structural errors after the action;
surface field completeness after blur/commit and on explicit review. Saving an
incomplete draft and blocking publication retain their existing contracts.
Successful local checks do not imply successful provider delivery or prove every
possible answer combination is valid.

### 6. Clarify preview, sample answers, and a visitor walkthrough

Retain one Preview & test entry. Organize the existing capabilities with clear
labels and purposes rather than adding another testing surface:

| Capability | What it establishes | What it must not imply |
| --- | --- | --- |
| Screen preview | How a chosen screen looks | That the screen is reachable or its branch wins |
| Sample answers | Predicted path for explicitly displayed hypothetical answers/actions | That form validation, submission, or real delivery succeeded |
| Test journey | Screens, decisions, and simulated submissions actually experienced from the real entry | That future unanswered screens were visited, or any real Lead/message was created |

Existing sample defaults must be visible as sample choices. If predictions use
seeded answers for later questions, disclose those assumptions; do not present
unseen defaults as completed visitor actions. A simpler alternative is to require
the merchant to choose the relevant answers explicitly. Decide between these
using the S4–S9 walkthrough, while retaining a clear reset action.

For Test journey, retain the existing progress distinction between current,
visited, pending, hidden, and bypassed screens. A path summary explains why a
decision ran, where a save was accepted, what was skipped, and which result won.
Only evaluate decisions supported by the answers reached so far. Clicking a
summary item locates the relevant screen without silently starting an edit.

Preserve Test this change after structural edits and its real-entry start.
Suggest matching/fallback cases, multiple-interest cases, optional skip/submit,
and competing priority only when relevant to the actual changed rule. Suggested
cases remain a checklist of things to try, not claimed path coverage.

Returning to edit restores selected screen, inspector section, viewport, and
trigger focus where possible. An edit invalidates or clears any prior trace that
no longer describes the current draft. Do not leave a stale green path suggesting
the edited draft passed. Keep reset/clear-test-path obvious. Failure simulation
stays under test details; real destination configuration and delivery remain
separate workflows.

### 7. Retain accessible and responsive authoring

- Every connection edit can be done through named controls, without dragging.
  Keep keyboard navigation, visible focus, and click/tap alternatives to panning.
- On narrow screens retain Map/Settings switching, rather than squeezing both
  into unusable columns. Returning to the map preserves selection and position.
- The map can pan in two dimensions; inspector text, route settings, and dialogs
  must reflow at 320 CSS pixels without document-level horizontal overflow.
- Condition labels, warnings, and group members remain available without hover.
  Meet the applicable 24px target/spacing minimum and use larger targets for
  primary touch actions where space allows.
- Long merchant text wraps. Do not make card information so terse that screen
  names or conditions become ambiguous. Shared text roles remain the baseline.
- RTL mirrors reading direction, ports, and layout while preserving logical
  priority and condition meaning. Mixed-direction names use existing isolation.
- Color is supplementary. First use text/icons and stronger selection treatment;
  add type accents only if users still confuse types. Existing semantic colors
  remain reserved for their established statuses.

### 8. Handle larger and difficult graphs without new promises

Use existing automatic layout, grouping, search, Focus journey, and local
selection focus. Do not add a minimap, manual line editor, or new layout engine
until scenario testing shows an unresolved navigation problem.

Measure long labels, expanded groups, nested splits, several incoming routes,
and manually moved nodes. Distinct editable connections keep distinct approach
lanes/attachment points. Label and action rectangles must not cover cards or
each other. If no safe line-label position exists, keep a usable path selection
and inspector alternative rather than drawing an unreadable overlay.

Test ordinary 2–7-screen cases and valid 12- and 20-screen multi-branch fixtures
where current validators permit them. These are stress samples, not a new total
screen limit. Retain the existing ten-question connected-route constraint.
Record initial map-ready time and interaction measurements on the same machine
before and after changes; investigate a repeatable regression rather than
declaring performance from a single timing. No automatic relayout on selection,
no lost connections after dragging, and no added eager map loading in Edit view.

## Delivery sequence

Each phase leaves a usable editor and can be reviewed independently. Do not wait
for optional color work to deliver readability improvements.

| Phase | Concrete work | Likely owning files | Completion gate |
| --- | --- | --- | --- |
| 0. Baseline | Capture S1, S4, S5, S6, S9, S13 at laptop size; record default/selected/Fit states and current testing entry points | Existing fixtures, browser evidence, review notes | Confirm observed gaps; distinguish missing features from discovery problems |
| 1. Readable map | Remove destructive dimming, simplify card hierarchy, preserve important labels and stable selection geometry, refine compact group presentation | `JourneyMap.tsx`, `FollowupGroupCard.tsx`, `JourneyMapEdge.tsx`, `editor.css` | All branch/save meanings remain visible; S1–S10 readable; no changed saved graph or visitor paths |
| 2. Workspace and navigation | Consolidate rows and map controls, show zoom percentage, preserve context and responsive behavior | `JourneyEditor.tsx`, `JourneyMap.tsx`, map camera/layout helpers, `editor.css` | Laptop and narrow layouts clear controls and labels; Fit/Show selected use measured bounds; keyboard actions work |
| 3. Repair in context | Shared issue projection, grouped issue markers, issue list, exact repair and return behavior | `JourneyEditor.tsx`, `JourneyMap.tsx`, `FollowupGroupCard.tsx`, `ReadinessDialog.tsx`, existing readiness/repair modules | S10/S12/S13 repair round trips preserve edits, focus, and undo; server validation retains authority |
| 4. Testing continuity | Clarify existing preview modes, sample assumptions, trace state, test summary navigation, reset and stale-trace handling | `JourneyEditor.tsx`, `JourneySample.tsx`, `JourneyTest.tsx`, `journeyTestProgress.ts`, `journeyTestState.ts` | S3–S11 matching/fallback/back/skip cases distinguish prediction from actual walkthrough; no real side effects |
| 5. Usability and polish | Merchant task sessions, RTL/zoom/screen-reader checks, measured type accents only if justified, documentation | Review evidence and design guidelines; relevant owning components | Resolve serious task failures; explicitly record any unverified area before release |

Keep map state/presentation data outside the visitor graph. Derive issue and
trace display from existing evaluators and stable IDs. Do not introduce new
global state or a second route representation simply to render badges.

## Verification and acceptance

### Behavioral regression coverage

Extend existing tests only for new behavior or a meaningful regression. Reuse
the map controls/camera/layout/grouping/routing tests, readiness/repair tests,
and sample/test progress/state suites. Avoid tests that merely assert a chosen
color, CSS class, or exact toolbar implementation.

Verify selection does not alter draft history or routing; card-density changes
preserve measured connection endpoints; grouped repairs target the correct
member; trace state clears after relevant edits; opening/closing previews leaves
the draft unchanged; undo restores structural changes and their issue state.

Run TypeScript, lint for touched code, relevant behavioral suites, Free/Pro admin
builds, and repository-required checks. If shared graph or runtime helpers must
change, expand testing to the affected TS/PHP traversal and capture contracts.
This plan does not authorize changing semantics to make a visual test pass.

### Browser checks

Use the real WordPress editor with isolated test campaigns and synthetic inputs.
Check 1512px and 1280×800 desktop, narrow inspector, 390×844 phone, 320 CSS-pixel
reflow, and actual 200% browser zoom. A reduced viewport alone does not establish
browser-zoom behavior. Test one RTL journey and long/mixed-direction labels.

Inspect normal, selected, Fit, low zoom, expanded group, Edit connections, issue
repair, preview, and visited-test-path states. Capture before/after screenshots
for representative scenarios, including portals/dialogs and focused controls.
Check computed contrast and overflow rather than relying only on screenshots.
Exercise keyboard-only authoring and a screen-reader sample; report what was
actually verified. Do not send real Leads, connect new destinations, or publish
merchant campaigns for this UX check.

### Merchant task sessions

Use a small formative round of about five people who create campaigns, including
both occasional and experienced editors. This is directional evidence, not a
statistical benchmark. Where possible compare current and revised versions using
equivalent tasks and counterbalance their order to reduce learning effects.

1. Explain who sees the Home/Business questions and where the enquiry is saved.
2. Add a follow-up to one interest and verify two selected interests both run.
3. Change a branch and test its match and fallback.
4. Find and repair a broken continuation, then return to the original task.
5. Explain what happens when optional signup is skipped after a result.

Record completion without help, incorrect predictions, navigation mistakes,
time spent finding controls, and confidence checked against actual behavior.
Any mistaken understanding of required capture, exclusive versus all-matching
paths, or sample versus real delivery is a release concern even if the person
finishes quickly. Fix any recurring confusion seen in two participants and any
single severe capture/routing misunderstanding; verify the affected task again.
Do not make users available or claim results that have not been obtained. If
merchant sessions cannot be run, label usability validation pending.

### Definition of done

- Ordinary and selected maps remain readable, including downstream save/endings.
- Compact cards preserve the information needed to predict visitor behavior.
- Existing branch, group, capture, result, and legacy behavior remains unchanged.
- Issues open precise repairs and return without lost changes or lost focus.
- Preview, predicted samples, visited traces, and real delivery are unambiguous.
- Laptop, narrow, zoom, RTL, and keyboard checks have recorded evidence.
- Relevant checks pass; limitations and any pending merchant/accessibility
  verification are listed accurately in the review, not represented as passed.

## Reference basis

- [Typeform Logic Map](https://help.typeform.com/hc/en-us/articles/360057591531-Logic-Map):
  type icons, grouped canvas navigation controls, and clickable errors. Card
  movement does not change routing; this supports keeping layout/editing distinct.
- [HubSpot workflow testing](https://knowledge.hubspot.com/workflows/test-your-workflow):
  preview enrollment and simulated paths, expose branch decisions, and distinguish
  simulation from actual execution.
- [Klaviyo flow preview](https://help.klaviyo.com/hc/en-us/articles/30325266432539):
  highlighted hypothetical paths with a navigable sidebar timeline and explicit
  limits on what the prediction establishes.
- [NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/):
  retain frequently needed information while deferring specialized detail. This
  supports removing duplication, not hiding essential conditions.
- [W3C dragging alternatives](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements),
  [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum),
  and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast):
  preserve operability and readable controls through visual simplification.

Product patterns above were checked in official documentation during this review;
competitor editors were not independently usability-tested. Layout choices,
phase order, and acceptance scenarios are WConvert-specific recommendations.

Local contracts: [domain context](../../CONTEXT.md),
[ADR 0108](../adr/0108-explicit-journey-graph-and-legacy-migration.md),
[admin design guidelines](../../tools/design-system/GUIDELINES.md),
[journey layout evidence](../reviews/2026-09-28-journey-layout.md),
[merchant workflow implementation](../reviews/2026-09-28-merchant-workflow-implementation.md),
and [workflow stabilization](../reviews/2026-09-28-merchant-workflow-stabilization.md).

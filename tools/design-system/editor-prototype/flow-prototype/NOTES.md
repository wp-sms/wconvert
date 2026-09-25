# Branching journeys — revised A/B exploration

Throwaway prototype, 2026-09-24. C was rejected and removed. B informed the production Manage Screens flow map, with the Screens list retained as a secondary view.

## Product recommendation

Use B, a dedicated Journey workspace, as the permanent home for screen logic. A
keeps the same authoring tools inside a focused Manage screens modal. Compare the
placement and navigation cost, rather than giving each variant different powers.

The primary job is: “What will this visitor see next, and why?” The canvas shows
screens and named answer paths. A contextual panel handles exact editing. A sample
visitor test explains the chosen path. Display eligibility belongs at entry;
destination handoffs belong on saved contact details, separate from visitor routing.

Decisions supplied by the user: arbitrary branches, first matching branch with
visible priority, answer conditions as the main use case, permission to rethink
the existing domain model. Forward acyclic routing is a prototype recommendation;
loops have not been agreed as a product requirement.

## Try it

Run `npm run prototype:flow`, or use the existing server:

- [A: focused screen manager](http://127.0.0.1:5188/?prototype=flow&variant=A&scenario=garden)
- [B: journey workspace](http://127.0.0.1:5188/?prototype=flow&variant=B&scenario=garden)

The bottom arrows compare A/B. Sample campaigns include conditional garden
questions, a coffee quiz, and email followed by optional SMS. Layout switching
shares the in-memory draft. Reloading or switching examples resets it. Save draft
is session-only. Nothing is published, captured, sent, or written to WordPress.

Try selecting “A garden”; inserting a screen with + on its connection; drawing a
new path; changing priority; previewing a screen; testing a sample visitor; and
editing display settings or campaign destination attachments from the summary.

## Earlier A/B revision

- Removed C, its outline renderer/styles, and its switcher option.
- Reduced campaign chrome and closed the inspector until something is selected.
- Replaced thumbnail-heavy cards with compact type, title, question, and path rows.
- Named output handles correspond to ordered paths, including Everyone else.
- Added contextual insertion and a new/existing screen picker. Inserting preserves
  the path's condition, priority, and continuation; branching rejoins the fallback.
- Added find-and-focus navigation, optional map previews, and individual previews.
- Added ELK layout with fixed connection ports and its routed bend points. Manual
  dragging falls back to React Flow's smooth-step routing until Tidy up.
- Added clickable review issues and explanations of the sample runner's decisions.
- Open at readable zoom rather than shrinking every graph to fit; narrow windows
  originally used a vertical arrangement and an overlay inspector (superseded below). Fit journey gives an overview.

## Horizontal B refinement

The user approved investing in horizontal B and clearer everyday authoring.

- B stays left-to-right at every width; alternative answers stack vertically.
  Removed the duplicated entry card from B; entry rules remain editable in the
  labelled Starts summary. A retains an entry card in its modal.
- Tightened automatic spacing and aligned simple journeys on one row. Desktop
  starts with the whole journey when it fits readably; compact windows show the
  first screen and nearby paths. Earlier/later pan buttons, Start and Fit journey
  provide explicit navigation alongside normal canvas interactions.
- Every condition row names its target, so following a line is optional.
- Selecting a path emphasizes its downstream connections and fades alternatives.
  Selecting a screen emphasizes its immediate incoming/outgoing connections.
  Highlighting can be turned off; Focus selection restores the local view.
- The camera uses the canvas space remaining beside the inspector and focuses the
  selected screen or path endpoints. It does not rearrange nodes on text edits.
  Below 700px, the inspector docks underneath the graph rather than covering it.
- The right panel has Content & answers and Next steps. Question labels, choices,
  single/multiple selection and required state are editable in place. Referenced
  answer choices cannot be removed; renaming updates every associated path.
  A path inspector also offers inline source-question editing.
- Add answer path asks for the question and matching answer before creating the
  screen; it suggests an unused answer and rejoins the existing fallback. Existing
  screens can be chosen too. Insert screen is available directly in the path panel.
- Sample testing stores the exact traversed edge IDs, so Continue and No thanks
  are distinguishable even when they point to the same ending. Highlighting the
  sample path frames those screens and dims unused connections.

Additional reference: [React Flow viewport API](https://reactflow.dev/api-reference/types/react-flow-instance)
for selection framing. Ordered conditions and explicit fallback follow the
[Klaviyo multi-branch pattern](https://help.klaviyo.com/hc/en-us/articles/52369094030235).

Exploratory verification: edited an answer in place and observed the path label
update; created an indoor-space branch without drawing, preserved the fallback,
and followed it in the tester; checked exact skipped-SMS edge highlighting and
preserved email handoff; inspected 1440px, 731px and 390px layouts. Switching
scenarios remounts the graph to avoid stale measurement of reused screen IDs.
The visitor runner is still a sample model, not the production renderer.

## Research and how it informed the design

These are patterns observed in official documentation, not evidence that these
products' complete workflows should be copied.

| Source | Observed pattern | Recommendation here |
| --- | --- | --- |
| [Klaviyo multi-branch splits](https://help.klaviyo.com/hc/en-us/articles/52369094030235) | Ordered first-match evaluation, fallback, path previews | Number answer paths; explain which one won |
| [Customer.io workflow builder](https://docs.customer.io/messaging/send/workflows/builder/) | Contextual configuration, insertion affordances, incomplete-step feedback | Put + on paths; automatically connect insertions; make issues actionable |
| [Typeform Logic Map](https://help.typeform.com/hc/en-us/articles/360057591531-Logic-Map) | Overview of branching, screen types, zoom, logic error access | Keep the graph semantic; moving a card must not change behavior |
| [NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Expose primary tasks; defer secondary controls | Keep routes visible; disclose previews, screen options, and manual connection forms |

## Library choices

- **React Flow:** retain for connections, selectable nodes, pan/zoom and keyboard
  foundations. It does not define runtime routing or guarantee accessible custom UI.
- **ELK:** added as a development dependency, dynamically imported. Named ports and
  orthogonal routing fit ordered branches better than the original hand positioning.
  It has a substantial bundle and more configuration than Dagre; production should
  measure layout cost and consider a worker. Do not ship it to visitors.
  [React Flow layout comparison](https://reactflow.dev/learn/layouting/layouting),
  [ELK multiple handles](https://reactflow.dev/examples/layout/elkjs-multiple-handles).
- **Existing Radix/shadcn components and Lucide:** reuse for dialogs, buttons, focus
  behavior and icons; adding a second full UI framework would add inconsistency.
  [Radix accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility).
- **Custom insertion edges:** a small component using React Flow's edge label layer;
  no separate workflow framework required.
  [React Flow button edge](https://reactflow.dev/ui/components/button-edge).

## Further product improvements worth exploring

1. Keep simple campaigns simple: a straight sequence until a user adds an answer
   path. Offer starter journeys rather than a blank diagram.
2. Show a plain-language rule summary with ALL/ANY groups in the inspector; handle
   question availability after merges, changed answers, and deleted choices explicitly.
3. Let Test accept a set of sample answers and compare expected versus actual paths.
   Highlight the winning condition and unmet conditions, not just visited screens.
4. Preserve the selected screen and viewport when moving between Journey and Design.
   Expose where a question's choices are used before changing or removing them.
5. Show shared destination impact separately from a campaign's attachment; destination
   failures should not look like a blocked visitor path.
6. Validate capture/consent requirements across every path before publication. Show
   specific fixes beside the affected screen rather than a generic error banner.

## Boundaries and production implications

This is a proposed graph schema, not a migration of the ordered production model.
Existing independent conditional screens can both appear; they cannot be translated
blindly into exclusive first-match branches. Production ADRs and modules are unchanged.

The inspector now supports flat ALL/ANY conditions with negative comparisons,
independent show conditions and first-match result editing. Screen content previews
use the real renderer in an isolated iframe, with a prototype routing controller.
Design styling, display rules and provider configuration are representative controls.
Destination names, usage counts and handoffs are fixtures; no credentials or provider
calls are involved. Full capture/consent and server validation remain production work.

Before implementation, agree on terminal screens, merge semantics, available answers,
progressive capture, backtracking and migration. Use a compact versioned visitor
contract and a shared evaluator for preview and runtime. Keep canvas libraries out
of visitor assets. Production layout needs measured geometry, stable user placement,
performance checks on larger journeys, keyboard coverage and RTL/touch validation.

## Validation

The initial prototype had browser checks for conditional/fallback routes, priority,
merges, drawn connections, Undo, loops, display settings, destinations, optional SMS
and quiz results. This revision additionally checks insertion, named path editing,
sample decision explanations, A/B switching, desktop and compact layouts. These are
exploratory checks, not production acceptance coverage. Build verification is recorded
in the task response. No maintained test suite is added for the throwaway prototype.

## Visitor-first B refinement (revision 4)

See [RESEARCH.md](./RESEARCH.md) for the service/library comparison and decisions.

This pass shifts B from diagram-only interpretation toward live visitor exploration: sample answers, exact route highlighting, immediate arrival explanations, WHEN/THEN ALL/ANY editing, bidirectional priority changes and clearer fallback protection. Ordinary continuation cards are smaller so branches remain prominent. State remains in memory and the shipping admin is unchanged by these prototype edits.

Browser walkthroughs verified garden completion and its simulated webhook, switching to balcony clears the previous sample route, ANY conditions and overlapping-first-match explanation, moving a branch changes its winner, ALL uses fallback when not all clauses match, newsletter email capture followed by No thanks produces only the MailPoet handoff and highlights the skip edge, and coffee multi-answer selection follows a rule based on the earlier brew question. Desktop (1440), normal in-app browser (731), and phone (390) layouts were inspected; viewport overrides are reset afterward.

Remaining production limitations and a proposed merchant task comparison are recorded in RESEARCH.md. The new condition UI extends the prototype; it does not validate a production schema migration.

## Scenario workbench (revision 5)

- One **Preview & test** replaces the two separate testing interfaces. Uses the shared
  renderer and premium question renderer in a preview iframe; normal runtime mounting
  is unchanged. The iframe avoids closed-shadow focus issues inside an editor dialog.
- Preview includes Back, path explanations, independent-condition skips, overlapping
  branch winner explanations, immutable simulated submissions, and product availability
  states. Restart clears the test; changing earlier answers discards later answers.
- **Multiple interests** demonstrates sequential, independently conditional follow-ups.
  Choosing garden and balcony asks both. Arbitrary graph branches remain first-match.
- Added **Simple email signup**, a blank campaign and three starting-point templates.
- Screen navigator labels type and conditions. The canvas starts near the top on tall
  narrow panels. Desktop focus mode expands the workspace. Selected content survives
  navigation to Design; its preview uses the shared renderer.
- Show-condition editor with flat ALL/ANY; badges on conditional cards; answer usage
  links cover screen visibility, result conditions and outgoing routes.
- Duplicate ordinary screens with a unique question ID and retained visibility; remove
  ordinary screens after an impact summary, reconnect incoming paths, and Undo. Deletion
  is blocked for referenced answers and ambiguous branching/terminal structures.
  Move-after is limited to safe ordinary positions and checks new reference errors.
- Result cards support heading/body, fixture product selection, conditions, priority,
  and a protected fallback. The coffee blueprint can move its one email capture before
  or after results; this control is deliberately bounded to that prototype structure.
- Review links cover disconnected screens, missing conditions/defaults, invalid answer
  references, contradictory single-answer clauses and exactly duplicated shadowed paths.
  These checks do not prove all arbitrary rule combinations or capture/consent validity.
- Display setup includes popup/inline and delay/exit/click. Destinations show compatible
  capture sources and shared settings distinguished. Revision 6 removes the invented per-campaign tag and adds a sample setup status.

Validation this pass: real-renderer browser walkthroughs of simple signup, both-interest
follow-ups, balcony-only skipping, Back and retained submissions, coffee result matching,
product loading failure, optional signup skip, and required-email placement. Screen
copy/removal/reconnection/Undo and incomplete-condition review were exercised. Desktop,
562px and 390px layouts were inspected. Keyboard Enter advanced the actual question form.
Ten temporary model assertions passed, covering the same routing semantics and validation.
No maintained tests were added to this throwaway exploration. Merchant task studies,
complete keyboard/screen-reader testing, large graphs and production migration remain open.

## Combined enquiry and review (revision 6)

User decisions: one combined enquiry; primary audience is merchants who rarely build
conditional flows. Added a guided setup disclosure, contact fields and answer review,
simulated save failure/retry and destination retry, saved-enquiry inspection, exact-draft
walkthrough evidence, and a separate saved/published demo snapshot.

`?prototype=flow&compare=current` now renders the actual current JourneyEditor with
equivalent isolated data. Variant A must not be described as the existing implementation.
A twenty-screen fixture is available through the campaign selector.

See [EVALUATION.md](./EVALUATION.md) for observed comparison findings, validation, the
merchant study protocol, migration contract, and staged production recommendation.
No production migration, capture, persistence or publishing was implemented.

## Task clarity and Steps view (revision 7)

Question: can B keep its campaign context while making everyday conditional-screen
work as direct as a list? The user authorised simpler controls, explicit visibility
versus branching, a compact Steps view, and less repetitive review after content edits.

- B has Steps / Map controls, with `view=steps|map` retained in the URL. Both views
  share the draft, selected screen, inspector, Undo, and preview. Selection and edits
  survive switching; reload restores the view but resets all sample campaign state.
- Steps uses connection order, not storage-array order. Branches show ordered routes;
  shared screens appear once after their predecessors. The list does not imply that
  every listed screen belongs to one visitor path. Search and keyboard buttons avoid
  requiring canvas interaction.
- One Review & publish entry collects structural issues and walkthrough guidance.
  Removed the separate Review journey action. Focus and prototype controls move to
  More. The setup guide is dismissible and recoverable from More for the session.
- Source connection handles appear on selection/focus; target handles remain usable
  for drawing. The inspector continues to offer explicit button/select connections.
- Add a conditional follow-up inserts an independent show condition and preserves
  continuation. Add branch is explicitly an exclusive, ordered choice. The picker
  explains the distinction and does not offer a conditional ending without a skip path.
- Behavior fingerprints preserve walkthrough evidence across wording/appearance edits.
  Conditions, question values/types/requiredness, connections, captures, result rules,
  display and destination changes invalidate its relevance. Previous records remain
  in memory so Undo can recover evidence for an identical behavior contract.
- Walkthroughs are recommendations rather than mandatory repeated publication gates.
  Unsaved drafts and structural errors still block demo publication. Content changes
  prompt preview; completed walkthroughs are explicitly not proof of intended behavior.
  Automatic scenario replay and partial invalidation are not implemented.

Validation: browser-created indoor-only follow-up was inserted before the existing
follow-ups, remained selected across Map/Steps, appeared in preview for indoor answers,
and saved its answer in the combined enquiry. Wording edits retained evidence; changing
requiredness marked it stale. Saving with incomplete walkthroughs enables demo publish,
while an incomplete destination still blocks it. Its issue link opens the correct
settings even from a different campaign section. Dismiss/reopen setup, keyboard Enter
on a list row, desktop, 562px and 390px layouts were checked. Temporary assertions
covered behavior fingerprints, six scenarios' ordering and merge uniqueness, conditional
insertion/skipping and evidence retention. No maintained tests or production edits.

## Revision 8 — map first, independent follow-ups, sample answers

Question: can a merchant understand conditional questions without mentally rebuilding a flow from a flat list?

- B keeps the horizontal map primary. The former Steps view is now a secondary Screens inventory, with search and editing but no implied visitor sequence or routing controls.
- Uninterrupted runs of conditional questions/messages become a presentation-only “Ask every relevant question” group. Conditions are checked in order; nonmatches are skipped. Expand the group, select a member, or edit a touching connection to reveal actual screens. Shared downstream screens and exclusive branch points are never hidden inside these groups. Large groups preview three members and expose all members on expansion.
- Exclusive branches retain ordered ports and explicit “Take the first matching path”; merge screens say “Paths rejoin.” Conditional continuation copy says “Check” instead of promising the next screen will appear.
- React Flow's built-in NodeToolbar supplies selected-screen actions. Contextual zoom emphasizes names and routing meaning without changing handle geometry. ELK remains the layout engine; no third-party plugin or Pro code was added.
- Try answers uses the existing sampleJourney evaluator, with explicitly prefilled sample choices and simulated submission. It highlights reached screens, explains skipped show conditions and first-match decisions, shows the actual sequence and submission count, and supports optional capture skipping and optional unanswered questions. It is not a completed visitor walkthrough and does not satisfy or create test evidence.
- At phone widths the inspector fills the workspace so answers and settings have room; closing it returns to the map.

Validation: production prototype build passes (existing lazy ELK chunk warning). Browser checks covered grouped overview, individual question selection, screen inventory, exclusive branching/merge, contextual zoom, garden+balcony together (one submission), indoors (both follow-ups skipped), and desktop/390px layouts. Temporary SSR assertions checked safe grouping, merge/branch boundaries, nonmutation, two-interest routing, skipped answers, and first-match priority. No production campaign writes or maintained prototype tests.

Verdict remains open: this is a design candidate, not evidence that merchants prefer B. Next usability comparison should ask occasional merchants to explain who sees each follow-up, configure two interests, and locate/fix an incorrect condition without coaching.

## Box-drag routing fix

Reproduced on B / Garden consultation: dragging Garden size upward caused the unrelated Your project → Request a consultation fallback line to abandon its ELK detour and cut through the middle of the graph. The camera transform remained unchanged. Cause: a global `Object.keys(positions).length` check invalidated every ELK route whenever any box had a manual position.

Routes are now invalidated per edge, only when its source or target was moved. Connected edges follow their moved endpoint; unrelated edges retain their arranged route. Tidy up clears manual positions and restores ELK routes. This does not add obstacle avoidance for arbitrary manually overlapping boxes.

Regression verification used actual browser drags and rendered SVG path comparisons (0.01px tolerance for subpixel noise): the unrelated-route assertion failed before the fix and passed afterward; all four unrelated edges stayed stable, both incident edges updated, and the camera remained stable. Repeated vertical/horizontal drags also passed; Tidy up restored all six routes and the original node position. Prototype build passes with the existing lazy ELK chunk warning. This is a throwaway prototype; no maintained test suite was added.

## Continuous line flicker while dragging — measured dimensions

The previous endpoint-only routing fix addressed route jumps, but a before/after SVG comparison missed the user's continuous flicker. A temporary MutationObserver probe on the actual canvas reproduced it: all six edges were removed and recreated eight times during one short box drag.

Root cause: `onNodesChange` retained positions but ignored dimension changes. Every render rebuilt controlled nodes without their `measured` dimensions. React Flow's `adoptUserNodes` / `parseHandles` then cleared handle bounds; `EdgeWrapper` returned null until measurement ran again. This affected every edge on each movement.

The graph now retains measured dimensions from React Flow's dimension events and includes them on its controlled nodes. Equal dimensions do not trigger another state update. Initial ELK estimates remain only initial estimates; actual DOM measurements remain authoritative.

Verified with the same DOM-removal probe: zero line removals during repeated box drags, dragging a collapsed follow-up group, and Tidy up. Probe removed after verification. This prototype has no maintained regression suite; when implementing the production graph, retain React Flow node state (including measurements) and add a browser regression that observes edge continuity during drag, not only endpoint geometry after mouse-up.

## Revision 9 — editing recovery and change impact

- Removing a referenced answer opens its actual uses, with direct links into show
  conditions, branches and result rules. Merchants can repair individual conditions
  or explicitly replace every use with another answer before removing the choice.
  Replacement preserves operators and priority, deduplicates values, and is one
  undoable action. Minimum two answers remains enforced.
- Undo/Redo now names the action, restores selection, coalesces a short typing burst
  in the same field, and clears Redo after a new change. Cmd/Ctrl+Z and Shift+Z work
  outside editable controls and dialogs; native text undo remains in fields. Focus
  returns to the inspector when an undo control becomes disabled, and to remaining
  choices after replacement/cancel.
- Reconnecting an existing path (canvas, destination selector, or existing-screen
  picker) and removing a conditional branch previews newly unreachable screens and
  new structural errors. Submission screens explicitly explain that captures there
  will stop. Cancel preserves the draft; Apply remains undoable. The check is graph
  reachability, not exhaustive satisfiability analysis of every answer combination.
- Capture-screen removal copy now states its submission consequence. The production
  proposal follows the repository's pre-release policy: direct model changes and
  behavior-parity checks, without migration or dual-editor scaffolding.

Validation: temporary SSR assertions covered replacement across visibility, explicit
branches and results; operator/priority preservation; minimum-choice guards; immutable
inputs; one combined enquiry; and newly unreachable screens after rerouting/removal.
Browser checks covered answer replacement/Undo/Redo, direct reference navigation,
whole typing-burst undo, branch priority restoration, removal and reroute impact,
cancel/apply/undo, capture-bypass warnings, Cmd+Z/Shift+Cmd+Z, and finding a distant
screen in the 20-screen fixture. At 390px, replacement remains operable with no page
horizontal overflow and focus returns to Answer choice 1. Viewport override reset.
Prototype build passes (2262 modules; existing lazy ELK chunk-size warning).
No production integration, merchant usability study, or maintained prototype tests.

## Revision 10 — scenario, clarity and visitor-state pass

User approved retaining still-relevant answers after Back and discarding only excluded
answers (September 25). Preview now preserves Back drafts, reconciles answers forward
on the selected path, freezes submitted answers, and displays immutable submission
snapshots. It keeps submission drafts separate and excludes later answers from earlier
capture snapshots. Connection intent choices are visible rather than hidden in a select;
show-condition explanations name the skip destination, rule-repair shortcuts open the
right section, and individual previews say Preview screen.

See [SCENARIOS.md](SCENARIOS.md) for the actual browser/model checks and limitations;
[BEHAVIOR.md](BEHAVIOR.md) specifies routing, Back, results, submission and publication
behavior without claiming that the proposed graph model has shipped. Existing production
ADRs remain authoritative until deliberately amended. No production integration or
merchant usability study in this pass.

## Production follow-up — September 25

The production editor now uses a horizontal React Flow map inside Manage Screens,
with a selected-screen inspector, ordered answer paths, a Screens list, and links to
Display rules and Destinations. Production routing is deliberately bounded to
forward paths before the next capture/result boundary. The visitor runtime, preview,
and server validation share that model; Back retains still-relevant answers.
[ADR 0107](../../../../docs/adr/0107-forward-journey-paths-and-flow-editor.md)
records the shipped decision. The prototype remains an exploration of A/B and
additional authoring ideas, not the production specification.

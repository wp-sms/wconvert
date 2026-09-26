# Journey workspace B: production gap and completion plan

September 25, 2026. This is a source and interface audit of the current PR #190
against the [B prototype behavior](../../tools/design-system/editor-prototype/flow-prototype/BEHAVIOR.md)
and its [scenario checks](../../tools/design-system/editor-prototype/flow-prototype/SCENARIOS.md).
It is a plan, not a claim that prototype simulations work in WordPress. The user
chose to hold PR #190 until the full journey behavior is implemented. Earlier
seven-screen and ordered-flow plans describe the current implementation, not a
constraint on the next design. The existing [ADR 0107](../adr/0107-forward-journey-paths-and-flow-editor.md)
must be amended alongside a changed production contract.

## Product test to optimize for

An occasional merchant should be able to answer four questions without learning
graph terminology: What does the visitor see first? Which questions appear for a
given answer? At which screen are details actually saved? What happens after a
successful save? The map is an overview and navigation aid. The selected-screen
inspector, a searchable Screens inventory, and a real visitor test must each make
the same answers clear without requiring line dragging.

The three authoring intentions must remain distinct:

| Intent | Merchant language | Visitor semantics |
| --- | --- | --- |
| Continue | Continue this path | Go to the next connected screen. |
| Conditional follow-up | Show this screen when… | Independently test visibility; several follow-ups may run. |
| Exclusive branch | Take a different path if… | First matching path wins; Everyone else is the explicit fallback. |

The user has already decided that multi-interest enquiries ask **every relevant
follow-up**, then make **one combined submission**; exclusive paths have visible
first-match priority; Back retains answers that remain relevant; and capture
requirements depend on the Campaign Goal. A quiz/content journey can finish
anonymously, while an enquiry must reach its combined submission. Do not ask
again or turn conditional follow-ups into mutually exclusive branches.

## Progress after this audit

### September 26: actual publication and visitor capture

The first real graph publication attempt exposed a missed boundary:
`OptinRepository::publish()` still used the version-2-only form validator after
REST had accepted the graph. It returned null, surfaced as “No such Campaign.”
The repository now applies the same goal-aware capture contract to v3 graphs.
Regression tests promote an unordered combined enquiry, refuse a later branch
that bypasses its required capture without changing the live snapshot, and
allow an anonymous graph quiz only under the quiz goal.

A separate local QA campaign was restricted to one QA page and configured for
local-only capture, with no destinations. The **published visitor popup**, not
the admin simulation, was operated by keyboard in its production closed shadow
root. Garden and Balcony both showed their follow-ups. After entering email,
Back retained both answers; deselecting Garden skipped it, retained Balcony's
answer, and retained the contact draft. Submit reached Request received. The
WordPress database contained exactly one Lead, one enquiry snapshot, the Balcony
selection and answer, and no Garden answer. Back showed the accepted email
read-only and disabled the accepted question choices; Continue did not create
another Lead. The QA campaign was then unpublished and its page returned to
draft. The two original QA campaigns were not changed. The test Lead remains
for inspection (`journey-browser-20260926@example.test`).

Real WordPress 6.8 / MySQL checks also passed in a separate disposable database
under PHP 8.2, in both Free and Pro: graph publication, Pro graph capture,
inactive-answer exclusion, replay returning the same Lead, Free refusal of
premium graph capture, six concurrent submissions producing one Lead, and
recovery across 120 queued submissions. The lead-log SQL verifier passed with
the distinct-millisecond fixture fix. CI now runs the capture verifier with
both Free and Pro installed in sequence. GitHub's latest run could not allocate
a runner because of the account billing/spending limit; local evidence does
not mean that required CI gate has passed.

The full PHP suite passed 2,124 tests / 10,873 assertions after the publication
fix, and PHPStan passed. No visitor bundle changes were needed for this slice.

The following quiz and saved-screen slice closes the missing read-only
explanation and published informational quiz checks. External delivery and
live WooCommerce recommendation availability remain separate release checks.

### September 26: published quiz timing and saved-screen details

Accepted screens now explain “Already saved” on Back in Free, Pro and Test
journey. The shared localized labels support older cached payloads; Free no
longer discards translations when PHP supplies more than two labels.

A real local quiz publication exposed three additional gaps. Moving the signup
before the result retained the generated marketing checkbox; required gates now
hide and unown that generated checkbox, restoring it for optional signup.
Merchant-written consent is preserved. Hidden consent can remain as design copy
only when no submission claims it. The review's capture classification now uses
graph result timing rather than storage order. Result content renders before
navigation, absent links no longer paint an empty button, and the modal's
accessible name follows the selected result rather than the fallback. Test
journey also updates the selected result link instead of retaining the fallback.

Two isolated published local fixtures verified both timings through the visitor
popup using keyboard controls. The required gate refused an empty email, then
accepted a test address and reached Sunny garden picks. Back showed the accepted
address and read-only notice. The database held one Lead, both answers, purpose
`request`, and no accepted marketing consent. The anonymous fixture reached the
same result before signup, displayed optional signup with the restored checkbox,
and allowed “No thanks” to reach Thanks for visiting. It created zero Leads.
Review correctly distinguished the required request gate from optional marketing
signup. Both fixtures were unpublished and their shared QA page returned to
draft afterward. Original QA drafts were untouched. These were informational
results with product requirements disabled, not WooCommerce availability tests.

Validation: the full JavaScript suite passed 2,834 tests; an additional selected
result-link regression passed in the six-test Test journey suite. PHP passed
2,125 tests / 10,876 assertions. TypeScript, ESLint, PHPStan, Free/Pro admin
builds and all unchanged visitor/phone byte budgets passed, including loader
compression under Node 22. Required GitHub CI remains externally blocked by
account billing/spending-limit status.

### September 26: repair controls and path-aware authoring review

Readiness now names missing/deleted question sources, questions that cannot be
answered before a rule on any incoming path, stale answer choices, incompatible
comparisons, and missing default/hidden continuations. A question available on
only some incoming paths remains allowed. The controls retain invalid selections
visibly instead of displaying an unrelated question, let merchants replace them,
and repair absent continuations without drawing lines. Editing visibility keeps
an existing hidden route even while the default route is missing. Empty required
branch conditions stay invalid until repaired; removing their last clause cannot
silently turn them into a match-everyone route.

In local WordPress, the unpublished multi-interest QA campaign was temporarily
changed so Balcony details referenced the Garden answer, then Garden's normal
and hidden routes were sent directly to Contact details while a separate branch
still reached Balcony. Review correctly blocked publication and named the
impossible Garden dependency. Its repair opened Balcony's condition and focused
the unavailable-question selector. Replacing the source with the initial
interests question cleared the blocker. All scenario edits were undone, leaving
the saved QA campaign unchanged. No campaign was published by this check.

The focused repair/readiness/editor suite passed 37 tests, the full JavaScript
suite passed 2,830 tests, and Free/Pro admin builds completed. The database CI
fixture also now separates lead writes by milliseconds so random ULID suffixes
cannot make its newest-first expectation flaky; confirmation awaits the next CI
run. These checks do not close the remaining release gate below.

The current branch now accepts several answers in a multi-choice condition in
the editor, PHP normalization, capture validation, and the existing JS matcher.
The editor uses checkboxes, and the map names the matching choices. Tests cover
authoring, PHP/JS evaluation, invalid references, and vocabulary round-trip.

Test journey now keeps contact drafts, marks simulated accepted and skipped
submissions, supports a retryable save failure, and locks accepted fields and
question answers when going Back. Each accepted snapshot includes the visited
questions through that save point, including optional ones left unanswered, and
excludes answers from later screens. A failed save preserves a draft question
typed on the same screen as the contact fields. The preview also separates a
simulated accepted save from queued or failed destination delivery, lets the
merchant retry delivery without another save, and names traversed graph edges
with their conditions. The local WordPress browser check exposed and fixed a
narrow modal and internal submission IDs in its summary. These improvements
are slices of the release work, not a claim that path-sensitive validation or
full prototype parity is done.

Publish review now catches an unfinished answer condition on a v3 connection
before the server rejects it. Its fix action opens that connection's source
screen and path settings; incomplete screen visibility/result rules and
disconnected screens likewise name the affected screen. This is a focused
authoring check, not a replacement for the server's full graph and capture
contract. Other server-only failure codes still need precise repair targets.

The live visitor and Test journey now share one capture-prefix calculation.
Submitting from an earlier save includes only answers on screens reached before
that save; it never accidentally sends a retained answer from a later screen.
An accepted save locks every reached question, including optional questions
left blank. The server stores that question coverage with the accepted snapshot
and rejects a later progressive submission that changes a covered answer or
fills a previously blank one. A new transaction test exercises both refusals
and a valid unchanged second capture; the mounted visitor test exercises Back,
earlier optional signup, and retained later answers. This closes the accepted
snapshot gap but does not replace a real browser visitor walkthrough.

The next slice added route and skip decisions to the shared JS/PHP evaluator.
Try answers now explains whether a screen was bypassed by a winning branch or
hidden by its own condition; Test journey labels that distinction too. This
trace still uses the ordered v2 journey model and does not yet identify stable
edge IDs or capture boundaries. Those remain part of the graph-contract work.

The graph-contract slice now has an explicit v3 entry and stable edges, equivalent
JS/PHP traversal, structural validation, a v2 migration with path-parity checks,
and an unordered multi-interest fixture. The visitor runtime, server answer
capture, purpose detection, Try answers, and Test journey use that graph when
present. Draft normalization preserves graph IDs and priority; v2 remains on its
old evaluator. The v3 publish boundary now checks capture ownership,
goal-specific required paths, and result/question requirements. The editor can
explicitly upgrade a v2 draft, insert on a named edge, and edit branch
priority, fallback and hidden destinations without changing visitor routing
through array order. The Screens inventory and map use a topological reading
order. Safe one-destination graph deletion previews its reroute and supports
Undo. This is still an implementation slice, not prototype parity: complex
branch deletion, result-gate authoring, grouped follow-ups, browser scenario evidence,
and precise readiness repair links remain open. The server currently requires
field and consent screens to appear on every path to their save point because
capture requests cannot otherwise prove a conditional field was visited.

## Initial gaps recorded September 25

This table preserves the initial audit, **not the current implementation status**.
Use the progress and dated browser evidence above/below for completed changes;
the release checks at the end remain open until explicitly verified.
“Current” below meant source inspection of PR #190 plus a real WordPress browser
walkthrough on the local Pro build. “B” means prototype behavior, which used
simulated submissions and delivery. A gap is not proof of an observed visitor bug
unless stated as such.

| Area | Current plugin | B behavior / required decision | Priority |
| --- | --- | --- | --- |
| Journey data | `tree.steps` is both storage order and implicit continuation; paths may only target later array items before the next capture/result boundary. Seven screens and two submissions maximum. | A graph with stable screen/edge IDs, explicit default continuation, directed acyclic branches and merges. Content order and canvas position must not silently route visitors. Reassess limits with payload and layout measurements. | P0 |
| Hidden screens | A false `when` falls through to the next array item, even when that item is not the intended visual continuation. | The skip destination must be explicit, named in the inspector, and exercised in preview/server validation. | P0 |
| Question availability | PHP validates conditions against globally earlier questions, not questions guaranteed to be available on each incoming path. A branch can legally reference a question from another branch and never match for some visitors. | Validate path-specific source availability. An unvisited or unanswered question evaluates false, with a named explanation on paths where it is absent. Reject a source that cannot be visited before this rule on **any** path; do not reject useful conditions after a merge merely because one incoming path lacks the question. | P0 |
| Multiple answers in one clause | JS matcher accepts `values[]`, while PHP normalization requires exactly one value and the admin editor exposes one `<select>`. | Align authoring, JS, PHP and the saved schema. Multi-choice “contains any of…” needs a deliberate multi-value control; otherwise keep single-value semantics everywhere. | P0 |
| Capture boundaries | Existing ordered model owns field/consent references and forbids paths crossing the next save/result boundary. | Specify which goal requires capture, prove all required paths reach it, and prevent a path from bypassing required consent or saving fields from unvisited screens. Preserve one Lead across explicit progressive submissions. | P0 |
| Visitor trace | `journeyPath()` returns visible indices and active answers. The sample dims cards but does not mark the actual winning edge or explain an exact skipped rule. | One evaluator returns visited screens, traversed edge IDs, winning condition, bypassed screens and reason, active answers, and capture boundaries. Visitor, sample and server must agree. | P0 |
| Full preview | `JourneyTest` uses the real renderer, but Submit/Skip just advances. It has no accepted-submission ledger, failed-save/retry state or destination outcome. It stores only question answers; remounting can discard a typed contact draft on Back. | A test session runs the actual navigation semantics without network writes, keeps unsaved drafts, freezes accepted snapshots, and explains that provider delivery is queued/failed separately from local save. | P0 |
| Back after acceptance | The live runtime locks accepted fields and question IDs; the preview does not model that boundary. | Back reviews accepted data read-only; no replacement or duplicate Lead. Answers after the accepted boundary remain editable. | P0 |
| Publish validation | Readiness catches structural route problems but has no end-to-end scenario evidence, precise clause/edge repair path, shadowed-rule warning, or path-sensitive capture proof. | Link every blocking issue to a field/edge; warn on redundant priority; offer representative walkthroughs as evidence, not a mandatory publish checklist. | P0/P1 |
| Map overview | This branch now opens the Journey tab on a full-width map and opens the inspector on selection. It does not group independent follow-ups; a five-screen modal needs horizontal panning for later screens. | Group repeated independent follow-ups without changing semantics; keep the expanded group navigable by keyboard. | P1 |
| Context and saving | The Journey summary now reuses the Display rules wording, and capture cards say where details are saved with a link to Destinations. The map still cannot distinguish accepted save from queued delivery or trace separate submissions. | Differentiate saved request, queued delivery, result completion and optional signup at the exact handoff. | P1 |
| Authoring affordances | New connection can create an empty answer condition, then opens path settings. Insertion lives in the inspector. The Screens list now calls itself an inventory, and Add screen names its actual insertion point. | Offer clear intent before connecting; put insert action on the specific path; show exact rule priority/fallback. | P1 |
| Rule repair | Referenced answer replacement exists, but discovery remains mostly through selected settings. | Direct “Used by” links, exact clause focus, impact preview for reroute/delete, and one named undo action for structural edits. | P1 |
| Screen preview | The current map offers text previews; B offers per-screen preview from the card and full path preview. | Separate “Preview screen” from “Test journey” in labels and controls; render the selected screen at realistic viewport sizes. | P1 |
| Canvas state | Map layout is recalculated from the ordered graph and drag positions are local to the mounted tab. Sample path styles leave edges visually present regardless of whether they were traversed. | Persist or deterministically restore layout independent of routing; highlight actual traversed edges; preserve viewport/selection across tab changes; keep drag smooth. | P1 |
| Small screens and access | Mobile Map/Edit switch exists. The map and inspector still have dense controls and the canvas is pointer-oriented. | Complete every task through controls without drag, test focus and announcements, 200% zoom, 320/390px, RTL, long labels, and reduced-motion preferences. | P1 |
| Scale | Current seven-screen cap makes realistic multi-interest and branching campaigns run out of space quickly; B's 20-screen fixture is only a stress example. | Set a measured limit after testing dense branches, serialization, layout, preview, server processing and loader budget. Do not treat 20 as a user-requested limit. | P1 |

The code evidence is concentrated in `resources/loader/src/journey-rules.ts`,
`src/Template/JourneyRules.php`, `src/Template/CaptureJourney.php`,
`pro/modules/journeys/loader/journey.ts`, and `resources/admin/src/builder/`
`JourneyEditor.tsx`, `JourneyMap.tsx`, `JourneySample.tsx`, `JourneyTest.tsx`,
`JourneySettings.tsx`, and `ReadinessDialog.tsx`. The prototype's [evaluation](../../tools/design-system/editor-prototype/flow-prototype/EVALUATION.md)
is engineering evidence, not a merchant study.

## Browser walkthrough, September 25

The local WordPress campaign **Reveal a welcome discount** remained a saved,
two-screen draft throughout the walkthrough. Its Display rules said **after 12
seconds on the page**, while the Journey tab initially said **Automatic
trigger**. The Journey summary now uses the same rule sentence. Before the
map-first change, its inspector occupied 35% of the canvas at entry; after the
change the two-screen map opens full-width, the capture card names the save
point, and the instruction sits above rather than on top of that card. The
Add screen menu had said **After Details** but inserted a question **before
Details**; it now states the actual insertion location. No campaign change was
saved or published during this check.

In the isolated five-screen comparison fixture, the former fit-all camera
made the nodes illegibly small inside Manage screens. The camera now starts
with the first two screens at readable size; later screens require scrolling
or **Fit journey**. The inspector can be closed to return to the overview.
The production Test journey still advances straight from a simulated submit
to its ending without a save ledger, unlike B's preview. Readiness checks
structural errors but does not present a route and capture walkthrough.

B's **Multiple interests** scenario was walked through with garden and balcony
selected, then Back to deselect garden. Both relevant questions appeared
before one combined enquiry; the garden answer was removed, the balcony answer
and contact draft persisted, and a simulated save failure kept the form.
The **Find your coffee** scenario showed a result before any contact details;
choosing **No thanks** at optional email signup ended the journey with no
simulated submission. Its result preview also offers product-unavailable and
loading-failed states. B's Add screen dialog initially clipped its action below
the viewport; it now has a scrollable form and a visible footer action. These
are prototype observations, not claims about the production visitor runtime.

In a separate local WordPress enquiry draft, the first question was changed to
three interests and three conditional follow-ups were inserted before one
contact save. Try answers showed Garden and Balcony together, then Balcony
alone after Garden was deselected; both paths still reached one contact save.
The draft is saved as **QA — Multi-interest graph (draft)** and remains
unpublished for review.
That walk exposed a real insertion defect: adding a follow-up after a hidden
conditional screen originally left its hidden edge pointing beyond the new
screen. The insertion helper now retargets that hidden edge when it shared the
selected default destination, and a graph traversal regression test covers it.
The same walkthrough found that Design's screen picker still numbered screens
by storage position; it now uses the Journey's topological reading order.
The full Test journey modal rendered the real first screen and its route and
capture summary, but the browser automation surface could not interact with
the renderer's closed shadow root. JS mounted-visitor tests cover the Back and
answer-pruning behavior; the full WordPress visitor interaction remains a
release check.

A separate local **QA — Graph quiz capture (draft)** exercised the product
finder after explicitly enabling flexible paths. The merchant can now add an
optional email signup after an anonymous result, then move that same signup
before the result as a required gate. Both transformations preserve upstream
graph edge IDs, explicit field/consent ownership, and the existing ending
screen, including merchant-written ending content. The required version was
saved and reloaded in WordPress; the map and Design screen picker showed
contact before the result, then the ending. The readiness dialog reported destination
configuration as the remaining publish blocker for this local draft, not a
graph-route error. This is evidence for a simple quiz gate, not proof that
arbitrary result topology can be rearranged; the editor disables the timing
choice when it cannot safely transform the existing connections. The browser
walkthrough also caught and corrected misleading first-capture and stale
status wording.

After rebuilding the Pro admin assets, the same saved quiz draft was reloaded
in WordPress. Test journey showed the real first screen, the required-contact
notice, topological path summary, an expandable connection trace, and the
capture checkpoint summary. The browser control could inspect the rendered
screen and modal but could not click inside the renderer's closed shadow root;
mounted-renderer UI tests cover the simulated save failure, snapshot, Back,
and destination retry. This does not yet satisfy the full real-browser visitor
interaction release gate.

The saved quiz draft was reloaded again after the readiness-link change. Review
& publish still showed destination setup as its only publish blocker; it
did not invent an unfinished-path problem for a valid route. A draft with an
empty graph answer condition is covered by the readiness UI test, which checks
that its fix action selects the stable source screen and matching path.

## Browser follow-up, September 26

The admin-only Test journey mount now uses an open shadow root, allowing the
browser test to operate its actual rendered controls. Published visitor mounts
retain the existing closed root. Both QA campaigns remain unpublished drafts;
the following evidence is real WordPress **admin simulation**, not a claim of
published visitor capture or provider delivery.

- **Required quiz gate:** selected Garden and Mostly sunny, reached contact
  before the result, typed an email and consent, simulated failure, then retried.
  The retry reached Sunny garden picks. Back showed accepted contact fields and
  the preceding answer read-only. This exposed generated “Back to result” copy
  on a gate before that result; result-timing transformations now use “Back.”
- **Combined enquiry:** selected Garden and Balcony, answered both follow-ups,
  typed contact details, then went Back and deselected Garden. Balcony's answer
  and the email remained. Garden and Indoor were hidden. A simulated failed
  save stayed on contact, and retry accepted one snapshot with only Balcony,
  its follow-up and the email. The snapshot initially displayed stored option
  keys; its review now resolves the visible choice labels.
- **Authoring gaps:** inserted question screens lacked Back. New follow-ups now
  include it; inserting/moving a screen to the start removes Back there and
  gives the former first screen a Back control. Existing merchant content is
  not silently rewritten; the two old QA follow-ups were repaired using Design.
- **Design parity:** Layers called every later storage item “After they submit,”
  disabled Question on an upstream follow-up stored after contact, and described
  Continue as “Shows a result.” Layers now uses named screens, graph additions
  follow navigation rather than storage order, and button summaries describe
  their actual action. The WordPress browser confirmed Garden details and its
  enabled Question insertion control after rebuilding.
- **Phone and keyboard:** at 390px and 320px, Test journey now scrolls its body
  while retaining its title and Close action. Snapshot labels and values stack
  at phone widths. Opening focuses the visitor heading, Tab reaches the first
  answer, and keyboard selection/Continue advances to the next heading. Closing
  returns focus to Test journey; a condition repair instead targets its screen
  settings. These checks cover this modal, not the entire editor's accessibility.

The accepted-save implementation initially exceeded the Basic/Pro/Elite loader
budgets. Reusing the existing node index and sharing question enumeration across
the v2/v3 route and save-prefix evaluators brought all tiers back under the
unchanged budgets. No diagram library is included in the visitor loader.
CI's Node 22 compression initially remained above the local Node 24 result.
The follow-up consolidation shares the full node traversal and result-timing
classification too. The shared shell's result-first check now follows graph
connections rather than storage order; fixtures reverse storage for both
optional and required signup and retain the expected classification.

Remaining release work includes external delivery and live-product evidence,
precise repair targets for server-only failures, grouped follow-up readability,
complex graph edits, and the responsive/keyboard/RTL checks below. Do not mark
the feature merge-ready solely from the successful admin simulation.

## Scenario contract before more visual polishing

For each fixture, assert the same visited screens, winning edge, skipped-screen
reason, active answers, result, capture snapshot, and conversion boundary in
JS, PHP, real preview and the WordPress visitor. The following set is the
minimum; record expected outputs as fixtures instead of duplicating the
evaluator's implementation in tests.

| Scenario | Expected invariant |
| --- | --- |
| Simple signup | One visible save point and one acknowledgement. Next/Back never saves. Failed save retains inputs; retry creates one Lead. |
| Multi-interest enquiry | All seven nonempty combinations of three interests. Every relevant follow-up appears; unrelated follow-ups do not. One final enquiry contains only visited answers. |
| Change interests | Answer two follow-ups, type contact details, go Back and deselect one interest. Retain the still-relevant follow-up and contact draft; discard the excluded answer permanently. |
| Independent and exclusive rules together | Several independent conditions may match; only the first matching exclusive branch is taken. A merged screen appears once. Everyone else is explicit. |
| Missing answer and negative rule | An unanswered optional question does not satisfy either positive or negative comparison. A newly visited required question blocks forward travel. |
| Inaccessible rule source | A rule depending on a question from a skipped sibling path evaluates false on that path and preview names why. A rule whose source is unreachable on every incoming path is a publication error with a direct repair link. |
| Reroute or delete | Show disconnected screens, lost submissions and changed result/capture paths before applying. Undo restores one coherent graph. |
| Product finder | Test 48 brew/taste/grinder combinations, result fallback, unavailable products, result-first anonymous completion and optional signup. No Lead before explicit capture. |
| Required result gate | Every route to the result passes the required capture with its fields and consent; quiz text promises a gate on the first screen. |
| Progressive email/SMS | Email acceptance creates one Lead; skip or failed SMS does not replay email. Accepted question/field snapshots are read-only on Back. Explicit later SMS adds to that Lead with its own consent. |
| Save versus delivery failure | Save failure stays on the form with inputs. After accepted save, a provider failure means queued/retry delivery, not a second visitor submission or a claim of subscription. |
| Display and destination context | Different display rule combinations affect campaign eligibility, not the journey route. A destination is associated with an actual accepted capture, not mere arrival at a card. |
| Draft edits and publication | Rename preserves IDs; removing a referenced option requires repair; incomplete draft saves; publish blocks on actionable structural/capture errors; walkthrough evidence is advisory. |
| Responsive/accessibility | Complete creation, rule priority change, test, repair and publish review by keyboard and touch; maintain focus at 320/390px, 200% zoom and RTL. |
| Free and paid boundaries | Existing Free linear journeys keep working. If paid capability is unavailable, a conditional campaign does not silently run as a linear campaign; its draft remains inspectable and publishing reports the missing capability. |
| Template/design transfer | Import, duplicate and design replacement preserve stable question/choice/submission references or show a concrete repair preview. No orphaned rule publishes. |
| Draft versus live version | Editing a published campaign does not change an already mounted visitor's capture contract mid-session; the saved draft and published behavior are distinguishable. |

## Implementation slices and gates

The recommended representation is one entry screen ID; stable screen, question,
choice, edge and submission IDs; and explicit connections. A non-ending screen
has one default continuation, zero or more prioritized answer connections,
and, where applicable, a separate **when hidden** continuation or optional
**Skip** action. A result/ending is terminal only when no further action is
available; result-first optional signup remains an explicit continuation.
Independent conditional follow-ups are ordinary screens with `showWhen`, not
exclusive outgoing branches. A collapsed group is a visual view of those
screens, not an extra runtime node. The graph is acyclic, and screen array
order and canvas coordinates have no routing meaning. This is an implementation
recommendation to settle in the contract slice, not an already-shipped schema.

React Flow remains a suitable **admin canvas**. Its core supports focusable
nodes/edges and localized accessibility text, so a parallel Screens inventory
can be a deliberate accessible route rather than a concession. Its official
[sub-flow guidance](https://reactflow.dev/learn/layouting/sub-flows) supports
visual groups, but `parentId` affects positioning, not visitor semantics.
The [layout guide](https://reactflow.dev/learn/layouting/layouting) notes a
known Dagre issue with groups whose children connect outside the group; it
lists ELK as supporting edge routing. Therefore keep Dagre for the simple
overview only if measured grouped/branching fixtures stay readable; use an
admin-only ELK chunk if those fixtures show crossings or misrouted edges.
Do not add another diagram library just for styling. The current controlled
`JourneyMap` updates the whole `positions` record for every drag movement;
verify drag continuity and re-render counts with the official
[performance guidance](https://reactflow.dev/learn/advanced-use/performance)
before accepting it at the higher graph limit. Localize canvas instructions
and preserve full non-drag editing, as described in React Flow's
[accessibility guide](https://reactflow.dev/learn/advanced-use/accessibility).

1. **Freeze the behavior contract.** Define that graph shape in `TemplateTree`,
   including explicit default and skip continuations, edge IDs, capture IDs,
   ending semantics, and layout metadata outside visitor behavior. Measure
   representative payloads and loader budget before setting limits. Amend ADR
   0107 and the inline superseded claims in ADR 0106 in the implementation
   commit. Keep Free linear journeys functioning; React Flow/layout remain admin
   only. No table/column is proposed.
2. **Make traversal and capture authoritative.** Implement a trace-producing JS
   evaluator and equivalent PHP path validation. Validate acyclicity, reachability,
   question availability, default routes, required capture/consent, result
   fallback and submission ownership. Use the same semantics in the live loader,
   capture endpoint, answer pruning, result selection and analytics. Add
   scenario fixtures, including combinatorial cases and failure/Back behavior.
3. **Replace the split preview experience.** Make Try answers a quick route
   explanation backed by trace, and Test journey a realistic simulated session
   with the real renderer, contact drafts, immutable accepted snapshots, save
   and provider outcomes, result states, exact skip/branch explanations and
   direct edit links. Neither action writes a Lead or calls a Destination.
4. **Finish the workspace.** Give simple campaigns a calm overview; group
   independent follow-ups; make branch priority and fallback visible; add
   contextual connection/insert actions, screen preview, per-save handoff,
   issue/usage navigation, named undo and stable map layout. Keep Screens as an
   inventory and a complete non-drag editing route. Connect Display rules and
   Destinations to the relevant context without recreating their settings.
5. **Release gate.** Run the scenario matrix in unit, PHP integration and a real
   WordPress browser; verify both Free and paid builds, loader and design byte
   budgets, RTL, keyboard, mobile, 200% zoom, and drag continuity. Run a small
   qualitative merchant study on common tasks against the current manager;
   prioritize confidently wrong predictions about saving or routing over visual
   preferences. Keep PR #190 unmerged until P0 behavior and the common-task UX
   are coherent. Split later polish only if it does not leave an unusable
   interim model.

## Decisions still open

- The precise higher screen/edge/question limits need measured evidence, not an
  arbitrary number. The graph should stay acyclic; “arbitrary branches” need
  not imply loops or unrestricted contact-capture bypass.
- Test the wording for a rule with a missing source on one incoming path with
  occasional merchants. Recommended behavior is false on that path, explained
  by name; only an impossible-on-all-paths reference blocks publication.

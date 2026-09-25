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

## Verified gaps

“Current” below means source inspection of PR #190, with limited WordPress smoke
testing from the implementation turn. “B” means prototype behavior, which used
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
| Map overview | The Journey tab opens with the first inspector already occupying the right side. Conditional follow-ups remain separate nodes, with no overview group. | Start at a quiet overview; group repeated independent follow-ups without changing semantics; open inspector on selection. Ensure grouping can be expanded and navigated by keyboard. | P1 |
| Context and saving | Display and Destination summaries are campaign-wide text above the map. An individual capture card does not show its actual save/handoff; two submissions are hard to distinguish. | Show trigger/eligibility and destination context near the relevant handoff, with links to actual sections. Differentiate saved request, queued delivery, result completion and optional signup. | P1 |
| Authoring affordances | New connection can create an empty answer condition, then opens path settings. Insertion lives in the inspector. “Screens in visitor order” implies a sequence that branch visitors will not follow. | Offer clear intent before connecting; put insert action on the specific path; show exact rule priority/fallback; call the list an inventory and avoid misleading ordinal itinerary labels. | P1 |
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

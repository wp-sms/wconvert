# Merchant editing scenarios: audit and implementation plan

Date: 28 September 2026. Reviewed local plugin at commit `d08b3a3` on
`codex/plan-questions-conditional-screens`. PR #190 remains unmerged.

## Recommendation

Keep Edit as the default and Flow as the overview and advanced routing surface.
Improve complete merchant tasks before adding more canvas features or undertaking
another visual redesign. Routine work should not require translating a business
intention into connections, hidden edges, save points, or graph migration.

Primary merchant: occasionally adapts a ready-made campaign. Their central questions
are: What will visitors see? Who sees this question? What changes if I remove it?
Where do the answers go? How do I check that I have set it up correctly?

The current implementation supports these behaviors, but several ordinary actions
still expose the underlying routing model. This is a usability assessment, not a
claim that the routing engine failed or that merchants have been user-tested.

## What was actually checked

Fresh Chrome session against local WordPress. Inspected Edit, Flow, relevant
dialogs, Preview & test, Theme & layout, Display rules, Destinations, and the
goal/setup chooser. Temporary changes were reversed through Undo; Save draft
returned disabled. No campaign, shared destination, or publication was saved.
The enquiry submission was explicitly simulated with an example.test address.

| Real sample | Merchant task | Observation |
| --- | --- | --- |
| Demo 01, simple newsletter | Change heading to “Get coffee tips and new arrivals” | Live canvas updated; named Undo and unsaved state were clear. Reverted successfully. |
| Demo 01 | Add a question before collecting email | Global Add screen opened after Email signup with message selected. Choosing Question showed “Choose a connection before a save…”; valid placement was behind Change location. Cancel was inert. |
| Demo 04, home/business enquiry | Add Outdoor lighting as a fifth home interest and ask where lighting is needed | Contextual + Follow-up prefilled the correct condition. Added question was selected and grouped. However, the fifth choice's follow-up was inserted first; the dialog showed New question → Garden landscaping details, although Garden is conditional. |
| Demo 04 | Configure the new follow-up | New question initially had Choose one and First option / Second option. Switched to Short answer. Creation did not ask for answer type. |
| Demo 04 | Delete temporary follow-up, then undo | Deletion listed incoming paths, outgoing-connection effects, and continuations across home/business. Deletion and Undo worked. Later checked an existing Garden follow-up: Balcony was already preselected, so this is primarily a presentation problem, not a missing default. |
| Demo 04 | Reorder a normal conditional follow-up | Duplicate or move said “This screen cannot be moved here. Use Next screen to change its connections.” Common ordering requires advanced routing. |
| Demo 04 | Test Garden + Outdoor lighting | Test visited Lighting, then Garden, with Follow-up 1 of 2 / 2 of 2. Reached one combined enquiry. Accepted snapshot included both answers and both interests. No real Lead or service request. |
| Demo 05, coffee quiz | Retire Filter or pour-over | Review uses identified the result and branch. Offered replacement with another answer or links to edit conditions. Useful safeguards, but no cohesive “retire this option” workflow. Cancelled. |
| Demo 05 | Change Choose one to Choose several | Review explained affected rules and first-match semantics before applying. Good existing behavior; cancelled. |
| Demo 05 | Add a matching result | Immediately added “Your result” with Rich and chocolatey as its condition, triggering an overlap warning before the merchant chose a rule. Undid it. |
| Demo 05 | Remove optional email signup | Dialog explained removal of fields/consent/save actions and preserved historical Leads. Exposed a continuation selector even though All set was the only available target. Cancelled. |
| Demo 02, email then optional SMS | Remove the SMS screen and undo | Screen options → Screen actions → Delete screen immediately removed SMS from the draft. Undo restored it. Different interaction and terminology from optional email removal in graph campaigns. |
| Demos 02 and 05 | Configure destinations | Primary destination selection was clear. Optional SMS with no compatible service showed explanatory text without an action in that section. Add destination said to create, then select it. |
| Demo 04 | Inspect shared MailPoet settings | Correctly warned that changes affect other campaigns immediately and campaign Undo cannot reverse them. Cancelled without saving. Preserve this distinction. |
| Demo 05 | Inspect theme and eligibility | Theme stated Applies to all screens. Display summary and Test a sample visit exposed eligibility separately from journey testing. No changes applied. |
| New campaign chooser | Collect enquiries → Route a service enquiry details | Goal/setup structure was clear. Detailed summary prioritized counts, format and timing; the journey explanation lived in the setup checklist. No new campaign created. |

Fresh browser coverage was four demos, not all six or every possible graph.
This pass did not verify mobile layouts, real destination delivery, persistent
save/reload, failure simulation, or Back-answer pruning again. Earlier reports
cover some of those; they remain explicit acceptance checks below. VoiceOver
remains unverified by the user's prior choice.

## Ranked findings and proposed behavior

### P1 — Make adding a screen start with the merchant's intention

Keep contextual entry points: Add follow-up beside an answer and Add screen here
on a selected path. Give the global action a small first decision: Ask a question,
Show a message, Collect details, or End the journey. Then show a suitable location
and a plain-language consequence before applying.

For the newsletter example, after choosing Question, offer “Before Email signup”
as a clear proposed placement with an action to use it. Do not silently move a
screen requested on an explicit edge. For a fixed, incompatible edge explain why
and offer a visible way to choose a suitable location.

Include Answer type in question creation. A follow-up asking for project details
should be configurable as Short answer before insertion. Do not guess the type
from wording, and do not require a second edit to replace dummy choice options.

For grouped follow-ups, summarize the actual experience:

> If Outdoor lighting is selected, ask “Where would you like outdoor lighting?”
> Check the other selected interests, then send one combined enquiry.

Show position within the follow-up group rather than implying a conditional
neighbor always appears. Default new follow-ups to their source choice order
where the group is simple; preserve existing explicit order unless changed.

Acceptance: newsletter question can be added at a valid location without knowing
what a save connection is; explicit branch insertion affects only that path;
cancel creates nothing; the selected answer and other group members are preserved.

### P1 — Make deletion about its outcome, with routing as a secondary option

For an unambiguous continuation show a compact summary, not an initial routing
selector: “Remove Garden details. Continue checking the remaining selected
interests, then Send one combined enquiry.” Offer Change continuation separately.

For a branch point, shared screen, or multiple distinct exits, keep explicit
review; never invent which branch should survive. Name affected visitor paths and
any disconnected screens. Distinguish removing one screen from removing an
optional signup, its consent, and all screens belonging to that signup.

Use one discoverable Screen actions location in Edit and Flow. Give ordered and
graph campaigns consistent labels and consequence summaries without rewriting
legacy storage just to display the same controls. For capture removal retain
historical-data wording; do not add a confirmation to every harmless text edit.
Offer a visible Undo action in the completion notice and restore useful selection.

Acceptance: delete a plain message, one matching follow-up, a branch point, an
entry screen, and an optional signup; test protected last ending/required capture;
one Undo restores content, rules, connections and capture definitions together.

### P1 — Support follow-up ordering without editing connections

Provide Move earlier / Move later within a recognized follow-up group, including
keyboard operation. Explain that these controls change the order of matching
questions. Map dragging remains a visual-layout action and must not reorder visits.

Reordering must update shown and skipped continuations together and keep the
group's source and shared destination. For groups with custom exits, external
entries or dependencies that prevent a safe move, explain the specific restriction
and link to the affected rule. Keep the advanced graph option.

Acceptance: move Outdoor lighting after Garden; test Lighting only, Garden only,
both, neither when optional, and the untouched Business path. Reordering does not
change eligibility, drop an answer or add a second submission. Undo restores order.

### P1 — Create results and retire choices with deliberate rules

Add matching result should stage a small local editor: result name/content and an
explicit condition selection. Apply only when the rule is valid; cancel leaves
the journey unchanged. Do not initialize a real rule from the first answer simply
to make it structurally valid. Show priority and overlap warnings after selection.

Keep the existing dependency links and answer-type conversion review. Extend
Review uses into a focused retirement workflow: list affected follow-ups,
exclusive branches and results; allow intentional replacement or explicit removal
of affected behavior in one reviewed operation. Do not silently delete a shared
screen, broaden a result condition, or map a retired answer to an unrelated answer.
Complex mixed conditions should open a targeted rule edit, with a route back to
the pending task and preservation of current draft edits.

Acceptance: adding a result creates no accidental match; fallback stays last;
overlap is understandable; removing Filter lists both its result and grinder path;
renaming retains references; every applied compound change has one complete Undo.

### P2 — Turn verification into a clear next step after a change

Keep Preview & test, Appearance, Why this path, and the accepted-answer snapshot.
After a routing change offer Test this change. Prefill a possible visitor answer
set only when it can be derived reliably, explain the choices, and let the merchant
edit them. For conflicting/unsupported conditions, ask for a sample rather than
claiming the path is reachable. Invalidate any passed indication when related
rules change; do not equate a simulation with actual service delivery.

The simple default is a visitor walkthrough with a short path explanation. Keep
failure simulation and detailed capture diagnostics available under test details.
Use friendlier visible labels such as Submissions and Submitted answers for the
current Capture checkpoints / accepted snapshot concepts where accurate.

Acceptance: test first-match alternatives, multiple matches, fallback, optional
capture skip, failed submission/retry, and Back with still-relevant answers retained.
The merchant can explain why a question appeared and which answers were included.

### P2 — Finish the template-to-launch journey and secondary setup

Show a short journey summary in setup details before technical configuration:
“Choose a service → answer relevant questions → send one enquiry.” Include what
the merchant will customize. Avoid a mandatory wizard for returning editors.

In Destinations distinguish Email and Optional SMS sections and give an unavailable
channel an actionable next step. State why a compatible service is missing; offer
setup navigation or removal of the optional signup as appropriate. Do not imply
that email services receive SMS or that local collection supports a channel unless
the existing product contract allows it. After creating a destination, make the
remaining selection step prominent or offer explicit Create and select for this
campaign. Preserve the immediate shared-settings warning.

Keep theme scope and display eligibility summaries. Explain the two tests at their
entry points: “Will the campaign appear?” versus “What happens after it opens?”
No extra permanent toolbar row is needed.

Acceptance: a merchant can adapt a setup, find incomplete channel configuration,
test eligibility and journey separately, and distinguish Save draft from Publish.

## Implementation order and boundaries

1. Agree on the interaction contracts above; make small UI sketches for Add,
   Delete and group ordering. Keep the existing overall editor layout.
2. Implement P1 insertion and grouped ordering together. The same grouping model
   must drive both Edit and Flow. Verify behavior with real sample combinations.
3. Implement P1 deletion and choice/result review, reusing existing dependency,
   graph-impact and Undo mechanisms rather than parallel state models.
4. Add targeted testing handoffs and the P2 setup improvements.
5. Run the acceptance matrix below in the browser, then a short merchant usability
   round. Log each friction point and its consequence, not just pass/fail clicks.

Relevant implementation areas: GraphScreenInsert; GraphScreenRemove and
GraphCaptureRemove; CampaignScreenNavigator and FollowupGroupCard;
structure/followupGroups, graphInsertion, graphRemoval and graphScreenActions;
QuestionSettings and ResultSettings in JourneySettings; JourneyTest;
DestinationSetupDialog, DestinationsEditor and SubmissionSettings.

No new graph library is required for these tasks. Preserve arbitrary branches as
an advanced capability, first-match priority, one combined enquiry, goal-specific
capture, and existing legacy compatibility. Keep essential effects visible;
tooltips are for supporting explanations, not where an action will insert/delete
or whether it changes a published shared destination.

## Acceptance matrix for the next implementation pass

| Scenario | Required check |
| --- | --- |
| Simple newsletter | Edit wording; add a question before capture; delete it; Undo; save/reload a dedicated test draft. |
| Email + optional SMS | Edit each consent separately; skip SMS; remove/restore SMS; preserve accepted email and its destination. |
| Multiple interests | Add/reorder/remove follow-up; zero/one/several/all selected interests; one combined enquiry; Back retains relevant answers. |
| Home/business branches | Same edits on Home leave Business unchanged; default path insertion; shared-screen deletion requires impact review. |
| Coffee quiz | Add result without fabricated rule; priority overlap; fallback; retire referenced choice; optional signup removal; result before capture. |
| Content guide | Move ordinary content; shared continuation; content-only steps; required/optional capture boundary. |
| Complex custom graph | External group entry, distinct skip target, nested branch, blocked move, dependency conflict, and unreachable screen. |
| Shared setup | Correct channel empty states; immediate destination scope; display eligibility separate from journey simulation. |
| Interaction quality | Keyboard add/delete/reorder/undo and focus return; 390px and tablet dialogs; long labels; Edit/Flow selection parity; visible hover/focus states. |

Use behavior tests for structural edits and browser checks for understanding and
discoverability. Tests passing alone do not establish usability. No GitHub CI or
merge is authorized by this plan; VoiceOver remains deferred.

Proposed merchant validation: start with five occasional merchants, each given a
ready-made campaign and task goals without click instructions. Ask them to predict
who sees a newly added question, remove a follow-up, change a result, and verify
the affected path. Record unassisted completion, wrong-path edits, recovery, and
whether the stated prediction matches the visitor test. A working release gate
is no unnoticed wrong-path/capture changes and at least four of five completing
each core task unaided; this is a decision aid, not statistical proof.

## Research informing the recommendations

- [Nielsen Norman Group: usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/):
  familiar language, recognition, consistency, error prevention, and recoverability.
  Applied here as evidence for task wording, explicit consequences and coherent Undo,
  not as proof that any particular proposed design is validated.
- [Typeform: Logic Map](https://help.typeform.com/hc/en-us/articles/360057591531-Logic-Map)
  and [editing logic from the map](https://help.typeform.com/hc/en-us/articles/34108393268756--Use-the-Logic-Map-to-add-logic-to-your-form):
  maps can support understanding and editing conditional paths. My recommendation
  to retain our Edit/Flow split follows our merchant needs and observed workflows;
  these sources do not establish that a map should be everyone's primary editor.
- [React Flow accessibility](https://reactflow.dev/learn/advanced-use/accessibility):
  preserve keyboard operation and meaningful accessible labels as custom map
  interactions evolve. A library's accessibility features do not by themselves
  verify our custom controls or screen-reader experience.

This document is the planning deliverable. No implementation changes were made
in this audit, and no additional product answer is required to begin the P1 work.

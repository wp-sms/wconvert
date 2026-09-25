# B: enquiry workflow assessment and rollout proposal

September 24, 2026. This is an engineering walkthrough and proposed merchant study,
not evidence from usability participants. No production replacement or migration ran.

## Current prototype update (revision 10)

B uses a horizontal map as the primary workspace and Screens as a searchable inventory.
Independent conditional follow-ups can collapse into a group; exclusive branches retain
visible first-match priority. Try answers explains routes and submission counts.
Revision 9 adds referenced-answer replacement, grouped Undo/Redo, direct links to the
condition using an answer, and impact review when rerouting disconnects screens.
Revision 10 makes connection intent visible and fixes Back/answer retention and saved
submission review. See [SCENARIOS.md](SCENARIOS.md) for completed checks and
[BEHAVIOR.md](BEHAVIOR.md) for the behavior specification and production gaps.
These changes are engineering-verified, not merchant usability evidence.
Revision 6's exact-draft walkthrough gate has been superseded: content edits retain
routing evidence with a preview reminder; behavior changes mark it stale. Walkthroughs
are recommended, while saving and structural validity remain required for demo publish.
No automatic replay, real merchant study, or production migration has been performed.
See NOTES.md for the latest browser and model checks.

## Audience and decisions

Primary user: a merchant who rarely builds conditional flows. Multiple selected
interests should produce every relevant follow-up and one combined enquiry. Explicit
branches follow the first matching rule in visible priority order; the fallback runs
last. These are different operations and must remain distinct in authoring and runtime.

Recommendation: keep B as the direction for a campaign workspace, but do not declare
the map a universal replacement for the current screen manager. Make ordinary
visibility edits and visitor testing the primary tasks. Keep branching available as
an additional capability. Retain a searchable screen list and button-based editing;
users must not need to drag connections to finish common tasks.

## A fair baseline

- B: `/?prototype=flow&variant=B&scenario=interests`.
- Current: `/?prototype=flow&compare=current` imports the actual `JourneyEditor`
  from this checkout, including its existing settings and test components. It uses
  an isolated equivalent five-screen fixture. It is not a clone of the UI.
- Variant A is another prototype and is not the current implementation.
- The current comparison harness does not reproduce the entire WordPress editor,
  provider configuration, or campaign saving. The component may include changes in
  the working checkout that have not been released.
- The current model supports seven ordered screens. Do not score its lack of arbitrary
  graph branches as failure on the shared visibility-editing task.

## Observations versus hypotheses

| Task | Current implementation | B | Interpretation |
| --- | --- | --- | --- |
| Understand several matching follow-ups | Ordered rail, visible condition summaries, explanatory visibility settings | Same independent conditions on horizontal cards, test with explicit skipped/visited screens | Both support the correct model. B is not inherently clearer for a short sequence. |
| Add indoor space to the balcony condition | Add a clause, choose Any condition, choose indoor; summary updates correctly | Answer choices and ALL/ANY in contextual inspector, condition badge links directly to editor | Both are usable. Merchant evidence is needed to choose wording and density. |
| Protect a referenced question | Existing manager disables incompatible answer changes and referenced choice removal; shows usage links | Prototype has usage links and guarded deletion/reconnection | Preserve current protections; they are not a new advantage of B. |
| See submission consequences | Current settings distinguish continue-only from saving the request | Answer review, saved-enquiry inspector, one simulated capture, explicit queued/failed delivery | B makes the wider submission task more inspectable. Backend delivery remains simulated. |
| Review readiness | Outside this current-manager harness | Saved draft snapshot, structural checks, four recorded walkthroughs, separate demo published snapshot | Useful proposed workflow, not proof of improved production publishing. |
| Work on a large flow | Outside current seven-screen scope | Twenty-screen fixture; search locates a distant screen at readable zoom | Search helps navigation. A twenty-node sequential fixture is not a performance or dense-branch benchmark. |

The real current test preview was visually inspected. Automation cannot interact
with its closed shadow root through the available browser tool, so this pass does
not claim a completed baseline visitor walkthrough. This is a tooling limitation,
not a demonstrated product defect.

## Revision 6 implementation and verified behavior

- Optional setup disclosure ties questions, contact details, display rules,
  destinations, and review together without another permanent navigation layer.
- Contact settings support optional name, an answer review, and a use-of-details note.
  The enquiry fixture does not imply permission for marketing.
- Four walkthrough presets: garden, balcony, both, indoors. Browser runs completed
  all four. Both asks both follow-ups; indoors skips both. Each saves one enquiry.
- A failed sample save retains details and answers. Retrying can succeed. A destination
  failure still shows the visitor success, with the saved enquiry and pending retry
  visible in the merchant inspector. Ordinary delivery is labelled queued, not delivered.
- Review displays the visited screens. Completion means a walkthrough finished, not
  that its logic has been proven correct. The merchant must compare it with intent.
- Save, edit, and demo publish use separate session snapshots. Browser verification:
  four completed runs plus save enable publication; changing destination setup clears
  the runs, marks the draft changed, and blocks the next publication with a linked issue.
- Destination configuration now respects the existing domain: campaign references a
  shared destination. Removed the prototype's invented per-campaign tag. Provider
  notes distinguish webhook answers from explicitly supported provider mappings.
- Twenty-screen fixture: searched for Project detail 15, selected it, and verified the
  camera and inspector. Review inspected at 562px and verified 390px viewport.
- Temporary executable assertions checked all four routes, single handoffs, independent
  visibility, exact-draft evidence, required-capture bypass, destination setup, and
  fixture size. No maintained test suite was added to this throwaway prototype.

All capture, retry, save, and publication behavior here is simulated. No real lead,
provider request, analytics event, or campaign publish occurs. State resets on reload.

## Merchant study to run before choosing the replacement

Recruit a small first round (for example five occasional merchant users). Treat this
as qualitative discovery, not a statistical comparison. Alternate starting order:
current then B for some participants, B then current for others. Use reset fixtures
and equivalent tasks; do not teach the solution before measuring independent work.

1. Predict the questions shown for garden plus balcony. Expected: both follow-ups,
   then contact, then confirmation.
2. Make the balcony question appear for indoor visitors too; predict what changes.
3. Duplicate a follow-up, rename it, then remove it. Explain the effect on the journey.
4. Identify when answers are saved and how many enquiries are created.
5. Try the visitor journey, go Back, change the interests, and explain which answers
   remain relevant. Previously accepted submissions cannot be silently overwritten.

Only after the shared tasks, test B-specific tasks: an overlapping branch, its fallback,
one shared screen reached by two branches, a failed save, and a saved-but-undelivered
request. Do not combine these with the baseline task score.

Record per task: completed without help, misleading predictions, assistance required,
backtracking/navigation effort, observed time (without invented targets), and a simple
confidence rating. Ask participants to explain the result in their own words. The
strongest failure signal is a confidently wrong prediction about questions or saving.
Do not average a critical submission misunderstanding away with fast cosmetic edits.

A separate accessibility pass must cover keyboard navigation, focus return, dialogs,
announcements, zoom, touch, and the complete authoring task without canvas dragging.

## Migration contract

| Existing behavior | Required preservation |
| --- | --- |
| Ordered screens with independent `when` | Preserve order and evaluate each visibility rule independently. Sequential connections may illustrate this; never convert matching follow-ups into exclusive branches. |
| Question and option IDs | Keep stable references and stored answer values. Labels are editable presentation, not identity. |
| Existing content/design tree | Keep component content, styles, fields, and validation intact; do not rebuild it from prototype cards. |
| Submission IDs, fields and consent references | Preserve each explicit capture boundary and required/optional semantics. One-enquiry fixture does not redefine campaigns with progressive capture. |
| First-match result rules | Preserve result priority and fallback separately from screen visibility and branch priority. |
| Back navigation | Re-evaluate later answers on change; accepted submissions remain immutable and must not submit twice. |
| Destination IDs | Keep references to sitewide named routes; preserve provider capability and mapping rules. |
| Display and conversion behavior | Preserve trigger, targeting, eligibility and existing conversion boundaries. UI redesign must not silently alter them. |

This repository is pre-release: change the selected model directly, without introducing
migration machinery or maintaining two production schemas. Use existing scenarios as
behavior-parity fixtures. Compare included/skipped screens, captures, results and conversion
boundaries with identical answers. For the three-interest fixture cover all seven nonempty
combinations, not only the four onboarding walkthroughs. Include missing/changed answers,
optional capture, overlapping branches, merges, broken references and failed submissions.
Canvas positions are authoring metadata and must not affect visitor behavior.

## Production sequence

1. **Shared contract and evaluator.** Specify visibility, branches, fallback, merge,
   completion, Back, answer invalidation and capture identity. Preview and visitor
   runtime must use the same evaluator; server validation must enforce the contract.
2. **Small integrated slice.** Integrate the selected workspace into the editor.
   Read/write the current ordered visibility model, preserve full Design editing,
   and use real draft persistence plus real preview. Start with the enquiry task.
3. **Branching slice.** Implement the selected graph contract directly, reference validation,
   shared-screen merging and runtime tracing. Ensure ordinary campaigns need no
   branching setup. Do not infer rule priority from node position.
4. **Parity and usability.** Run behavior comparisons and accessibility checks; test
   with occasional merchants before deciding whether B replaces the current interface.
   Keep the baseline comparison in the prototype; do not maintain parallel production
   editors or backward-compatibility scaffolding for this pre-release product.
5. **Operational readiness.** Integrate real capture idempotency, delivery diagnostics,
   provider mappings, publication validation and analytics. Test dense branches,
   long names, larger graphs and low-powered machines. Keep React Flow/ELK out of
   visitor bundles; consider a worker for layout if measured cost warrants it.

Keep React Flow, ELK and the existing Radix-based controls for now. The service/library
review and sources are in RESEARCH.md. The next decisive evidence is successful merchant
tasks and runtime parity, not another canvas library or another visual variant.

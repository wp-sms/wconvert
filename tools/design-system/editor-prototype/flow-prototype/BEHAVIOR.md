# B journey behavior proposal

September 25, 2026. Prototype specification, not a production schema or accepted ADR.
Scope: occasional merchants configuring signup, enquiries and quizzes. This document
records the proposed behavior before implementation; no database change is proposed.

## Status and authority

User decisions: B's horizontal map; arbitrary branches; visible first-match priority;
all relevant follow-ups for several interests; one combined enquiry. On September 25,
the user also chose to retain still-relevant answers after Back and discard only answers
that no longer apply.

The production authority remains [ADR 0103](../../../../docs/adr/0103-progressive-capture-keeps-one-lead-per-journey.md)
and [ADR 0106](../../../../docs/adr/0106-question-journeys-extend-the-paid-loader.md).
Production currently uses ordered screens. The graph below is a proposed extension,
not a claim that production already supports arbitrary branches. Adopting that extension
requires a deliberate ADR amendment and production implementation. No compatibility
layer, migration framework or parallel production schema is planned for this pre-release
repository.

## Merchant-facing choices

| Intent | Control | Visitor behavior |
| --- | --- | --- |
| Continue a sequence | Continue this path | Insert before the existing next screen; preserve the incoming rule and continuation. |
| Ask only a relevant question | Ask a relevant follow-up / Show this screen when… | Check this screen independently. If false, skip along its default continuation. Several matching follow-ups can appear. |
| Choose a different next screen | Take a different path | Evaluate ordered rules; follow exactly the first matching one, otherwise Everyone else. |
| Recommend something | Choose a result | Show exactly the first matching result inside one Results screen, otherwise its fallback. This does not fork the journey. |

Use actual screen names in explanations. The right panel edits content and rules for
the selected screen/path. The Screens inventory locates screens; it is not a numbered
visitor itinerary. Moving boxes only changes layout. Reordering branch rules changes
behavior; their priority must never be inferred from box position.

## Routing contract

1. One entry, stable screen/question/answer IDs, directed acyclic connections. A visit
   follows one path at a time. A shared screen is reached once per forward traversal;
   a merge never waits for, combines, or executes unvisited branches.
2. Every non-ending screen has one default continuation. Explicit answer branches
   have unique ordered priorities. Everyone else is checked last. Optional submission
   Skip is a distinct visitor action, not another answer condition.
3. A screen's show condition runs before displaying/validating it. False bypasses
   the screen through its default continuation, without executing its branches,
   requiring its inputs, accepting a submission, or showing its result. Entry and
   ending screens are unconditional. The editor must name the skip destination.
4. Rules refer only to earlier reachable questions. Being upstream does not imply
   the visitor answered it: a skipped/unanswered question never satisfies any clause,
   including negative comparisons. `all` needs every clause; `any` needs one.
5. Single choice uses one valid answer ID; multi choice uses a set of valid answer IDs.
   Missing optional answers are absent, not an empty value that means “not X”.
6. Results have one fallback, checked last, and are recalculated from active answers.
   Product unavailability keeps result copy and an alternative browsing action; it
   does not turn an anonymous result into a required signup.
7. Reject cycles, missing references, missing default paths and invalid results before
   publication. Warn about identical shadowed branches. Structural checks do not prove
   satisfiability or cover every possible combination; scenario replay is separate.

## Back, changes and saved data

- Back returns to a screen actually visited. It does not submit, count a conversion,
  visit skipped screens, or enqueue a Destination handoff.
- Preserve unsaved question choices and contact drafts on Back, including input entered
  before pressing Continue. Returning without changing an answer preserves later work.
- On an answer change, recompute the route forward using only answers encountered on
  that route. Keep answers still on that route, discard answers and unsaved contact
  drafts from excluded screens. Recompute results. Cleared answers are not resurrected
  if a visitor changes back to the old choice.
- An unanswered rule uses the false-clause behavior above; if a newly visited required
  question has no answer, the visitor stops there before advancing. Draft reconciliation
  can compute a provisional continuation, but it does not auto-answer or auto-advance.
- An accepted submission freezes the included details, question answers and consent
  evidence. Earlier submitted questions can be reviewed, not changed. Even an optional
  unanswered question already covered by that submission stays read-only. Answers and
  fields outside that accepted boundary remain editable until explicitly submitted.
- A capture shows and snapshots only active answers encountered up to that submission
  screen. Retained answers from a later screen are not retroactively added to an earlier
  submission. Back and retries never replace the accepted snapshot.
- Restart test clears only the simulated session. It is a prototype control, not a
  promise that visitors can erase or edit a previously accepted Lead.

## Submission and Destination boundaries

Ordinary enquiry: all relevant questions, contact details, explicit Submit, one Lead
and one handoff for the combined enquiry. Navigation alone never persists a Lead.

Progressive signup: the accepted email submission remains saved if optional SMS is
skipped or abandoned. Explicit SMS signup adds its details and separate consent to
the same Lead. It does not replay email delivery. Different capture journeys remain
separate Leads, even with the same contact identifier.

A save failure keeps the visitor on the form with their inputs. A successful local
save advances; provider failure belongs to delivery retry and does not ask the visitor
to submit again. Acknowledgements say the request/signup was received, never that a
provider subscribed, confirmed or delivered it. Production needs the existing atomic
receipts and retry machinery; the prototype ledger is only a simulation.

Conversion policy remains ADR 0103/0106: ordinary journeys count once on first accepted
capture; result journeys count on showing the selected result, with capture tracked
separately. Back, retries and additions do not create another campaign Conversion.
The prototype does not implement real analytics.

## Authoring, preview and publication

Draft content, rules and destinations are campaign edits with Undo/Redo. Changing an
answer label preserves its ID. Removing a referenced answer requires fixing its uses
or explicitly replacing them as one undoable action. Rerouting previews disconnected
screens and lost submission opportunities; disconnected screens remain in the draft
until repaired or removed. Canvas arrangement is independent authoring metadata.

Try answers is a route explanation using supplied samples. Preview & test runs the
visitor renderer with sample submission outcomes. Neither sends Leads or provider
requests. Production must share one evaluator between preview and visitors and enforce
the contract on the server. Publishing needs valid configuration and a saved draft;
walkthroughs are recommended evidence, not a compulsory checklist or proof of correctness.

## Implementation seams still to resolve before production

- Adopt and bound the graph schema and payload budget; agree free/paid boundaries.
  Preserve the existing free linear journey behavior and keep React Flow/ELK admin-only.
- Map stable submission IDs, field ownership and explicit consent into graph screens;
  a screen ID in the prototype ledger is not the production submission identity.
- Enforce freezing of included question answers across client/server. The current
  production loader visibly locks accepted capture fields; its question-input binding
  remains editable. Treat that as a parity gap to resolve during production work,
  not as evidence that the prototype behavior has already shipped.
- Implement cycle/reference/submission-boundary validation, evaluator parity and
  idempotent capture tests. No real WordPress integration was performed in this pass.

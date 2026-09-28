# Journey B merchant validation session

Prepared September 26, 2026 for draft PR #190. **No participant sessions have
been run or scored.** This is a runnable session guide, not usability evidence.
Engineering evidence remains in the [completion checklist](2026-09-26-journey-completion-checklist.md).

## Setup and boundaries

Recruit people who manage campaigns but rarely build conditional flows. The
facilitator should not be the participant. Start with three individual sessions;
use the findings to decide what to change and test again. This small qualitative
sample can reveal confusion; it cannot establish population success rates.

Allow about 30 minutes per session. Use a disposable local/staging site with the
current PR build, no live destinations and unpublished copies of the enquiry
and coffee campaigns. Give the participant a fresh copy for each task so that an
earlier mistake does not invalidate later observations. Save and publish are
separate actions: ask them to keep these campaigns as drafts and use Test journey.
Do not use real customer details. Reset disposable copies between participants.

Record the commit, browser, viewport/zoom, input method and prior experience.
Explain: “We are testing the editor. Please say what you expect to happen and
what you are looking for. Getting stuck is useful information.” Do not introduce
terms such as graph, fallback, first match or save ownership before the tasks.

## Tasks to read aloud

Only read the **participant prompt**. The expected behavior and observations are
for the facilitator. Let the participant choose controls, including drawing or
using the panel. Do not count finding an alternative valid method as failure.

| Task | Participant prompt | Expected behavior / what to observe |
| --- | --- | --- |
| 1. Understand the campaign | “This shop takes enquiries about Garden, Balcony and Indoor projects. Without changing anything, explain what someone interested in Garden and Balcony would see, and when the shop receives their enquiry.” | Predict both relevant follow-ups, no Indoor follow-up, and one explicit combined save. Note whether screen inventory order or box position is mistaken for routing. |
| 2. Add a relevant question | “Ask Garden visitors whether they need installation, before they send their enquiry. Visitors interested in both Garden and Balcony should still answer both sets of questions. Check your change as a visitor.” | Add a conditional follow-up, preserve other interests and one save. Observe insertion-point choice, condition editing, hidden continuation, test discovery and whether content labels are understandable. |
| 3. Resolve overlapping choices | “A visitor can qualify for two offers. Make the VIP offer win when both apply, keep the other offer for its matching visitors, and keep an option for everyone else. Show how you know which wins.” | Use ordered exclusive routes and a remaining default route; explain priority independently of canvas placement. Distinguish this task from asking all relevant follow-ups. |
| 4. Change an earlier answer | “In the test, choose Garden and Balcony, answer their questions, then go Back and choose Balcony only. Before continuing, explain which answers you expect to keep. Finish the enquiry.” | Keep Balcony answers, remove Garden answers, one simulated combined save. Observe whether diagnostics clarify pruning and distinguish simulated acceptance from delivery. |
| 5. Repair a broken route | “This coffee campaign has a path that finishes without showing a recommendation. Find the problem and fix it, keeping the other routes working. Check your repair.” | Start with an explicit result-bypass fixture. Find Review & publish, follow the named repair to the shortcut before the shared join, select the result and replay the route. Observe whether the wording provides enough context without help. |
| 6. Explain optional signup | “Let people see their coffee recommendation without signing up. Offer email updates afterward. Explain what happens if they skip, if saving fails, and if the email service is unavailable after their details are received.” | Distinguish optional result access, local save failure with retained input, and delivery failure after acceptance. Participant need not know implementation terms or recovery internals. |

Before task 3, prepare an independent exclusive-route fixture with two overlapping
conditions and named offers. Before task 5, prepare a draft-only shortcut from
“How you brew” to optional email that bypasses “Your coffee match”; preserve the
normal route and shared ending. Do not alter the full 48-case coffee fixture or
user-owned campaigns. Verify the starting issue and restore a fresh copy for the
next participant. The existing repair QA draft has already been fixed and must
not be described as a currently broken starting fixture.

## Facilitation and evidence

After an unassisted attempt, ask “What did you expect?” before explaining a
control. If they cannot proceed, record the point of difficulty, offer help,
and mark the remainder assisted. Record assistance even when the final result
is correct. Pause a frustrating task rather than making time spent the goal.

For every task record:

| Participant | Task | Prediction before action | Outcome: independent / assisted / incomplete | Time and hesitation | Wrong turn / exact wording | Saved configuration or replay evidence | Follow-up issue |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Not run | — | — | — | — | — | — | — |

Check the resulting campaign and visitor replay as well as the participant's
explanation. Completion alone can conceal a wrong mental model. Record preference
for the interface separately from correctness and confidence. If a participant
uses assistive technology, record their actual setup and observed tasks; do not
substitute facilitator keyboard testing for that evidence.

## Comparison and decision

For a fair comparison with the old screen manager, use a separate disposable
baseline checkout/site and the same simple sequence and conditional-follow-up
tasks. Alternate which editor is tried first across sessions. Do not make the
old manager attempt arbitrary branching it cannot support, and do not infer
that B is easier solely because it supports more behavior.

Review findings by consequence: wrong routing or save expectations first, blocked
tasks second, hesitation and wording third. A misunderstanding that silently
sends visitors down the wrong path or loses expected data is a release concern
regardless of participant count. Fix observed critical issues and rerun the
relevant tasks with a fresh participant before claiming them resolved. Do not
create a numerical acceptance rate from this small sample.

Attach anonymized observations and resulting issue/commit links here when actual
sessions happen. The owner must arrange participants or provide their feedback;
the agent can implement fixes and verify them but cannot invent merchant evidence.

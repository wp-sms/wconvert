# Scenario and clarity pass — September 25, 2026

Engineering checks against prototype B, not usability research with merchants.
All submissions, failures and destination outcomes below were simulated locally.

| Task / case | Verification | Outcome |
| --- | --- | --- |
| Simple email signup | Browser: submit, Back, continue again | One saved signup; acknowledgement does not promise provider delivery; no duplicate submission. |
| Several interests | Model: all 7 nonempty combinations | Every relevant follow-up appears; one combined submission. |
| Change interests before submitting | Browser: garden + balcony; answer both; enter contact draft; Back; remove garden | Balcony answer stays selected, garden answer is discarded, contact draft stays. Change is explained by name. |
| Failed save | Browser with custom contact draft | Remains on form, retains inputs and answers; changing test outcome does not wipe typed details; successful retry advances. |
| Destination failure after successful save | Browser | One saved enquiry, delivery retry indicated; returning and continuing does not submit again. |
| Review an accepted enquiry | Browser | Submitted details are displayed; submitted question controls are disabled. |
| Create an independent follow-up | Browser: add indoor-only question; answer Yes; submit | Correct condition and continuation, other nonmatching follow-ups skipped, new answer included in one enquiry. |
| Repair a show condition from Preview | Browser: click skipped screen's Edit show condition | Exact rule opens expanded in the inspector, with a named skip destination. |
| Exclusive quiz branch | Model: 48 brew/taste/grinder combinations; browser filter route | Relevant grinder question appears only for filter; one selected result; optional signup can be skipped. |
| Change quiz path | Browser: filter + bright + grinder; Back; switch to espresso | Taste retained, grinder answer discarded, result recalculated without visiting grinder. |
| Optional unanswered question | Browser: leave taste empty | Advances to fallback result; no hidden required question blocks the visitor. |
| Unavailable product | Browser: product-load failure control | Explanatory fallback copy remains, result can continue. This is not a network/provider test. |
| Finish quiz without signup | Browser | Neutral completion acknowledgement, zero submissions. |
| Create an exclusive branch | Browser: Espresso strength after brew | Matching answer enters it, continuation rejoins taste; Undo removes the addition as one action. |
| Overlapping branches | Temporary model assertion | First matching branch wins, other matching branch not visited; shared capture appears once. |
| Progressive email/SMS | Temporary model assertions | Skip SMS = one handoff; submit both = two explicit handoffs within intended one-Lead journey. Actual persistence is outside prototype. |
| Answer cleanup | Temporary model assertions | Keep still-relevant answers; prune excluded answers; changing back does not resurrect cleared answers; accepted and accepted-empty answers lock. |

## Changes made from these findings

- Replaced hidden connection modes with visible intent choices and consequences.
- Removed scenario-specific garden examples from generic authoring controls.
- Show-condition copy names where a skipped screen continues.
- Distinguished Preview screen from the full Preview action.
- Fixed Back state: keep current inputs and applicable answers; prune obsolete path data.
- Scoped contact drafts per submission screen; Skip clears unsaved fields for that screen.
- Accepted capture review uses its saved snapshot and cannot silently display later edits.
- The submission snapshot includes only answers up to that capture boundary, never
  retained answers from later screens.
- Locked included question answers after acceptance in the preview.
- Removed visibility editing from ending screens; a terminal screen cannot be silently
  skipped without a continuation.

## Practical limits and next evaluation

Prototype build passes with 2263 modules and the existing lazy ELK chunk-size warning.
Temporary assertions were run through Vite's SSR loader, not committed as maintained
prototype tests. Production needs durable regression coverage at evaluator, validation,
submission and browser seams. No WordPress writes, actual delivery, real analytics or
merchant study were performed.

The add-screen dialog now explains the three choices, but it is taller. Its usability
is a hypothesis to test, not a proven improvement. Ask occasional merchants to add an
independent follow-up versus an exclusive branch, explain a skipped screen, and recover
from a wrong answer condition without coaching. Compare task completion, errors and
hesitation against the actual current screen manager.

The concrete behavior proposal and production gaps are in [BEHAVIOR.md](BEHAVIOR.md).

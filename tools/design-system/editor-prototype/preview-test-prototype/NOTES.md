# Preview & test — prototype, 2 October 2026

Question: how can merchants confidently check a campaign without understanding the testing machinery first?

Accepted: concept A, Preview + helpful context. The user approved production implementation. The comparison code and launch command were removed after implementation; this document and screenshot retain the design evidence. See docs/reviews/2026-10-02-preview-test.md for implementation verification.

The former comparison used the existing editor prototype with three concepts and four example campaigns. It has been replaced by the production modal.

## Evidence and user needs

Inspected the production `JourneyEditor`, `JourneyTest`, `JourneySample`, `JourneyScreenPreview`, domain contracts in CONTEXT.md, and the live Preview & test modal in DEMO 04. Also reviewed the existing editor prototype and its routing model. No production campaign was saved or published.

The modal currently exposes three valid but different tasks under terminology the merchant must interpret: Visitor journey, Appearance, Sample answers. At entry, the sidebar already contains current-screen duplication, 12 pending screens, a not-reached submission, failure recovery, destination setup, map navigation and reset. Real rendering and accurate simulation are valuable; their presentation competes with the first task.

The merchant needs to answer: Does it look right? Do visitors get the right questions and result? Does submission behave correctly, including errors and optional signup? What has this test actually checked? Where do I fix something?

## Concepts

- A — Preview + helpful context (recommended): three action-oriented tabs, immediate interactive form, small progressive sidebar, contextual failure tools only at a form, explicit ending and submitted-details review. Fast repeat use without an extra chooser.
- B — Choose a task, then focus: explains the jobs before entry, gives the preview most of the space, and puts diagnostics behind “See what happened.” Most approachable first visit; adds a click on repeat visits.
- C — Guided review: persistent review steps, design review acknowledged by the merchant, then visitor testing. Helps users who want a process; consumes more horizontal space and risks implying exhaustive verification, so run counts explicitly refer to individual paths.

All concepts distinguish layout preview (inactive), interactive visitor test, and hypothetical route prediction. Predictions begin unanswered and stop where input is needed. No-question campaigns omit answer-path exploration. Desktop/mobile widths, screen selection, product-result selection, submission failure and retry, simulated delivery retry, optional signup, restart, edit-screen return, and map return are interactive.

## Boundaries to preserve in implementation

- Keep the real production renderer, rule evaluator, capture snapshots and immutable accepted answers. This uses the existing throwaway renderer adapter and fixture graph; it is not a replacement controller for production.
- Preserve the visitor test across mode switches; predictions and layout review never increment completed-run counts. A run counts once even if its ending is revisited. Reset starts another run; concept switching retains state for comparison.
- Never equate accepted capture with confirmed provider delivery, subscription or resource receipt. Retry delivery without resubmitting the accepted capture.
- Label safe simulation once prominently. Put detailed limits in a disclosure: no Leads, conversion counts, real catalog fetch, real delivery or website targeting evaluation.
- Future production work must retain all existing accessibility, change-specific suggested checks, conditional skipped-screen reasons, progressive capture, product fallbacks and focus restoration contracts. This prototype explores information hierarchy, not complete capability parity.
- Mobile device view is a width simulation, not proof of device behavior. Actual consent controls, comprehensive keyboard behavior within renderer iframes, and full campaign coverage still need production validation.
- Delete these throwaway concepts after the direction is chosen; rewrite the selected design using production components and existing logic.

## Verification

Browser walkthrough on the existing 1280 × 720 viewport: all three concepts render; garden branch reaches the matching follow-up, failed save stays on the form, retry reaches the ending with one simulated submission; route prediction pauses until an explicit answer/action; optional SMS skip retains the accepted email submission; design width toggle and concept/example switching work. Production source and assets are unchanged.

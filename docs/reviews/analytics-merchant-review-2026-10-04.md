# Analytics merchant review — 4 October 2026

## Authorized scope

Following the user-perspective review of PR #214, the user requested all six improvements, with short, clear copy: (1) prevent no-appearance warnings for newly published campaigns and explain when data appears; (2) open display rules directly and preserve the report return route; (3) name actual outcomes in rate observations; (4) make sales linkage limits visible; (5) explain multiple-answer percentages beside their counts; (6) keep outcomes first, prioritize actions over sales and add report shortcuts for long screens. Preserve Harbor, accessibility, existing reporting boundaries and manual merchant decisions. No AI. This is implementation and heuristic review, not actual merchant feedback.

Baseline: merged PR #214 / `75e37f93f25cdd9ef5db6d2bb75a2a3ae901ef22`. The user requires explicit approval before any future merge; this PR must remain open.

## Implementation

No-appearance advice requires the latest stored publication time to predate the complete report window. Recent publication, republication and missing timestamps suppress it conservatively; no publication-history storage is added. Empty campaign reports whose latest publication falls after the selected dates explain the timing. The overview zero state is neutral.

Display actions open the existing Display rules editor tab and preserve the accepted report URL. The Goal supplies rate names for every outcome, including quiz completion and resource requests. Current and previous figures stay visible, with full evidence in a disclosure.

Sales places a short 30-minute/non-causal explanation beside report figures. Multiple-choice questions carry their saved type into summaries, show the overlap explanation visibly and display choice counts out of the question denominator. Single-choice questions do not get a multiple-choice note.

Outcomes stay first. Findings precede sales on campaign reports. Compact shortcuts register only mounted reports, keep the report URL and move focus as well as scrolling. Empty answers and unavailable commerce do not create dead shortcuts. The same report components work without navigation when opened from the editor.

## Verification

Pending final browser verification and two-axis review. Preliminary targeted checks passed 666 JavaScript tests and 155 PHP tests. TypeScript, ESLint, PHPStan and Free/Pro admin builds passed. No real merchant study or measured conversion improvement is claimed.

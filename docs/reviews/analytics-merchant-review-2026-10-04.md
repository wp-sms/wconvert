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

667 targeted JavaScript tests and 155 PHP tests passed. TypeScript, ESLint, PHPStan and Free/Pro admin builds passed. In disposable WordPress with production assets and illustrative response fixtures, verified overview/campaign reports, setup, empty, loading, failure, multi-currency, consent-missing and tracking-off states. No overflow at 390px or 320px, including RTL; long setup labels wrap; no JavaScript page errors. The Display rules action selects the correct tab and returns to the same accepted 30-day campaign report. Jump controls retain the report URL and focus their target.

The first navigation probe compared an implicit default-period URL against its explicit accepted-period return and reported a string mismatch. The follow-up used an explicit 30-day report and verified an exact return. This is the existing accepted-report routing contract, not a changed filter.

Screenshots use illustrative fixtures, not merchant data: [sales](analytics-merchant-review-2026-10-04/sales.png), [answers](analytics-merchant-review-2026-10-04/interests.png), [mobile](analytics-merchant-review-2026-10-04/campaign-390.png), [RTL](analytics-merchant-review-2026-10-04/rtl.png), [display rules](analytics-merchant-review-2026-10-04/display-rules.png).

Standards review: no blocking findings; tightened the new rate-label contract after a nonblocking suggestion. Recheck found no outstanding findings. Spec review: all six requirements satisfied, no findings. No real merchant study or measured conversion improvement is claimed. CI status is recorded on the PR; no merge is authorized.

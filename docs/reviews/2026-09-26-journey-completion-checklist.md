# Journey B completion checklist

Updated September 26, 2026. PR #190 remains draft. This is the current checklist;
the [production-gap review](2026-09-25-journey-b-production-gap.md) is a historical
record of findings and browser evidence. Later entries there close several
gaps mentioned by earlier entries. Do not reopen a completed item solely because
an older paragraph still describes it as unfinished.

The behavior contract is the [prototype specification](../../tools/design-system/editor-prototype/flow-prototype/BEHAVIOR.md),
as amended for production by [ADR 0108](../adr/0108-explicit-journey-graph-and-legacy-migration.md).
The target user is an occasional merchant. A correct graph that requires them
to guess when answers are saved or which path wins does not meet the UX goal.

## Implemented and verified to the stated extent

| Requirement | Current evidence | Limit of that evidence |
| --- | --- | --- |
| Explicit acyclic branches, shared destinations, visible first-match order and hidden exits | Graph evaluators, publication checks, authoring tests; native browser creation/reconnection, cycle refusal and Undo | Does not prove arbitrary predicate satisfiability |
| Every applicable independent follow-up, one combined enquiry | All seven three-interest combinations in `journey-graph-enquiry.test.ts`; actual combined enquiries through the popup and database | Not seven separate manual browser submissions |
| Back retains applicable drafts and permanently prunes excluded answers | Mounted visitor and Test journey tests; real Garden/Balcony/contact-draft walkthrough | Accepted snapshots deliberately cannot be edited |
| Accepted saves freeze their encountered question/contact/consent snapshot | JS and PHP capture verification, local database runs, actual progressive capture | A save snapshot excludes later answers even if retained in memory |
| Required versus optional result access | Both modes published and exercised; adjacent pair transformation preserves downstream branches and shared ending | Complex non-adjacent gates require named manual preparation, not automatic rewiring |
| Add/remove optional second capture | Owned-field/consent insertion and removal tests; saved graph contract and browser skip/failure/retry | Shared/dependent/required captures are protected with explanations |
| Graph edits and repair | Named insertion points, removal/reroute impact, missing choices, hidden/default exits, disconnected screens, result links and missing required contact repair. Blank screen/question/choice/result text has precise repair links; missing result conditions can be added; product refusals focus product requirements. Consent/field ownership is explicitly assignable; navigation and consent blockers open the affected Design control or screen, including from Style | Goal/save-boundary audit remains below; malformed imported identities are not automatically rewritten |
| Save versus destination delivery | Actual visitor acceptance, real Action Scheduler retry against a loopback HTTP receiver, manual stored-submission recovery; one Lead and frozen separate payloads | Does not certify every external vendor's behavior; provider unit coverage is separate |
| Product outcomes and catalog failure | Shared production fixture: all 48 coffee combinations through the visitor renderer and PHP; first-match/fallback, anonymous completion and Back/pruning. Actual WooCommerce stock exclusion, refetch, API 503/recovery and shop fallback. Preview simulation now supports Retry without remounting | Preview explicitly simulates availability; it does not fetch live prices or stock. Real catalog checks used representative products, not every possible external response |
| Map clarity and drag continuity | Grouped independent follow-ups; 13-screen branch and 53-screen map checks; two instrumented drag samples without missing paths | Short local samples are not a broad performance guarantee |
| Keyboard and narrow layouts | Canvas traversal, non-drag controls, modal focus/return, RTL walkthrough, 320/390px layouts, light/dark/no-palette button focus | Native 200% zoom and assistive-technology walkthrough are not yet verified |
| Compatibility and publishing safety | Legacy evaluator/migration, Free/paid builds, import normalization, goal-aware PHP contract, mounted live snapshot retention and per-path question bound | Field/consent ownership must be present on every path to a save; ten questions per connected route remains a deliberate bound |

## Remaining work, in order

1. **Finish server-only repair destinations.** The [repair audit](2026-09-26-journey-publication-repairs.md)
   records the implemented text/result/product repairs and their browser checks.
   Consent wording/ownership and navigation-button repairs now have regression
   and browser evidence. Still check goal/save-boundary errors. Name the affected screen/control for routine
   authoring mistakes; distinguish malformed imported structures rather than
   promising automatic repair of every invalid graph.
2. **Complete the accessibility task walkthrough.** Verify creation, priority
   change, test, repair and publish review at native 200% browser zoom, including
   nested dialogs. Extend current keyboard/RTL/narrow-layout evidence with an
   assistive-technology check; do not label viewport resizing as browser zoom.
3. **Run the final integrated release checks after those changes.** Existing full
   suites passed 2,943 JS tests and 2,132 PHP tests before subsequent focused
   fixes. Run the complete suites and required artifact/source/build checks on
   the final revision, then require green CI. Runners currently cannot start
   because of account billing/spending-limit status; this needs the account
   owner's intervention, not repeated unchanged reruns.
4. **Merchant validation before replacing the old experience.** Have occasional
   merchants create independent follow-ups, choose an exclusive branch, explain
   when details are saved, and repair a wrong condition. Record completion,
   wrong predictions and hesitation. Agent walkthroughs cannot supply that user
   evidence. Keep this separate from code correctness and visual preference.

## Latest focused verification

Capture assignment/navigation: 3,017 JS tests passed before the final inspector
tab repair, followed by 114 inspector/structure/ownership tests after that fix.
Final ownership/readiness checks cover separate SMS contact requirements.
TypeScript, ESLint, both admin builds and source contract pass. The browser
repaired consent assignment and a deleted optional exit; saved PHP contract
verification passed with the QA campaign still unpublished.

Publication repairs: 99 JS tests; 69 PHP tests / 525 assertions; TypeScript;
ESLint; PHPStan; Free/Pro admin builds. Local WordPress verified exact second
question/second choice focus, fallback result-heading focus, and a real server
product refusal followed by focused repair. QA draft `01M3EJK75SA40GBH933WRCHBMC`
was repaired, saved and confirmed unpublished with a passing capture contract.

Coffee scenarios and preview: 524 JS tests; 15 PHP tests / 379 assertions;
TypeScript; ESLint; Free/Pro admin builds. Local editor walkthrough covered
matching/fallback results, Back/change branch, product-error simulation/Retry,
optional signup skip and desktop/320px scrolling. The new coffee QA campaign
is an unchanged unpublished draft; this walkthrough made no actual submission.

Product recovery: 27 JS tests; 23 PHP loader-contract tests / 38 assertions;
TypeScript and ESLint; Basic/Pro/Elite visitor builds; source contract; Node 22
loader and combined phone budgets. The paid byte-cap amendment is explicit in
ADR 0108; Free and the separate phone/payload/design caps did not change.

No merge or production publication is authorized by this checklist. Local QA
campaigns used for actual visitor capture/product tests have been unpublished.

# Campaign editor direction and resumption notes

Latest authorization: implement the revised UX; keep conversation updates short.
Primary user: occasional merchant adapting a ready-made campaign.

## Decisions
- Default to editing the rendered campaign. Keep the horizontal Flow view editable.
- Both views share the campaign tree, screen selection, draft and undo history.
- Put conditional follow-up creation beside answer choices; prefill its source rule.
- Independent follow-ups ask every matching question. Exclusive branches choose
  the first match, with explicit priority and a fallback. Do not conflate these.
- Multi-interest enquiries produce one combined submission. Quiz capture depends
  on campaign goal. Back retains relevant answers and clears excluded answers.
- One Preview & test entry point for routed visitor checks.
- Existing layout, formatting, consent and campaign format controls must remain.
- Do not merge PR #190 or run GitHub CI. VoiceOver is deferred by the user.

## Acceptance scenarios
1. Adapt signup wording and field labels directly; live preview updates.
2. Add a follow-up for Garden without reselecting its source question/answer.
3. Garden + Balcony asks both follow-ups; one enquiry; Back preserves valid data.
4. Exclusive branching remains editable, with first-match priority and fallback.
5. Quiz result rules and optional/required contact capture remain available.
6. Email + optional SMS retains separate consent and one lead identity.
7. Edit a legacy ordered campaign; do not silently rewrite its stored routing.
8. Edit and Flow changes share selection and history; no loss on switching.
9. Review dependencies before destructive edits; Undo restores references.
10. Narrow windows and keyboard navigation keep content and controls reachable.

This is an implementation checklist, not evidence of merchant usability testing.
Append actual validation and remaining limitations when this pass is complete.

## Implemented in the local plugin
- Edit campaign opens on the actual rendered campaign and its graph entry screen.
  Screen navigation, Flow, element inspection and Undo share the existing draft.
- Answer choices offer a prefilled follow-up dialog; its question text becomes the
  actual rendered label. Existing independent follow-ups retain their sequence.
- Related follow-ups have a grouped continuation control, with impact review before
  bypassing a contact screen. Exclusive paths retain first-match priority.
- Expandable inspector, mobile screen selector and Popup/Edit screen switch.
- Preview & test is shared across campaign tabs and publish-check actions. Closing
  restores the original tab/focus; returning to Edit does not reopen the preview.
- Legacy campaigns convert routing only when confirming an insertion; cancellation
  is inert and Undo restores conversion and insertion together.

## Verification on 2026-09-27
- Browser: local enquiry, signup and quiz drafts; direct rendered-heading edit and
  live update; Undo back to a clean draft; prefilled Garden follow-up; shared Edit/
  Flow selection; grouped continuation; quiz results and capture options; expanded
  settings; preview return/focus; phone and tablet access. No campaign was saved
  or published during these checks. Temporary browser sizing was restored.
- New route regression covers all seven nonempty interest combinations after an
  insertion and confirms one shared contact screen. Shared continuation changes
  require review and update both shown and skipped paths.
- Full JS suite: 166 files passed initially; three files exposed old default-tab
  assumptions and a missing mobile scope hint. Those were fixed. The affected
  suites were rerun; seven remaining assertions were corrected for renamed UI /
  hidden Activity DOM, and all seven passed on targeted rerun. Latest editor/shell
  run: 116 passed. Final preview checks: 2 passed. No unresolved test failures.
- TypeScript, targeted ESLint, git diff checks, Free and Pro admin builds passed.
- GitHub CI not run. VoiceOver remains unverified at the user's request.

## Limits and continuation
- These checks establish implementation behavior, not merchant usability evidence.
- Changing a referenced question's answer type still requires resolving its rule
  dependencies; this pass does not introduce automatic answer-type migration.
- PR #190 remains unmerged. This pass is in the local working tree on
  `codex/plan-questions-conditional-screens`; do not assume it was pushed.
- For a fresh conversation: read this file, inspect the working-tree diff, and
  continue from the actual local editor rather than rebuilding the old prototype.

## Compact chrome and scenario drafts
Follow-up polish aligns Edit/Flow/search at 32px, reduces toolbar padding,
uses two clickable rules/destinations summaries, removes the repeated draft
instruction from the visible footer, and sizes inspector icons consistently at
18px. The campaign footer retains the goal and current save state.

Local demo drafts (created with the normal repository; none published):
- DEMO 01 — Simple newsletter signup: 2 screens; `01M3H5CS4E69305QDYW9SW7GHH`.
- DEMO 02 — Email then optional SMS: 3 screens; `01M3H5CS4M5EY7NERVYE13CGWG`.
- DEMO 03 — Multiple interests, one enquiry: 6 screens; `01M3H5CS4QQSBV0XAN75XP7WN4`.
- DEMO 04 — Home or business, then relevant questions: 13 screens; `01M3H5CS4RA4BQZ4W3ZMK6S58P`.
- DEMO 05 — Coffee quiz with optional signup: 6 screens; `01M3H5CS4VZQGXCDH25GV8QWT9`.
- DEMO 06 — Content guide before email signup: 4 screens; `01M3H5CS4W3P4WKWQQGWBP7B1M`.

Repeatable source: `tools/design-system/seed/wconvert-editor-demos.php`, executed
with `wp eval-file` in the local site's shell. It validates all journeys before
creating drafts, preserves existing demos on repeat runs, and refuses other hosts.
Quiz results use local store links with no fixture product dependency.

Polish verification: browser-measured buttons/search both 32px with identical
vertical alignment; inspector icons all 18px. Checked desktop and 390px layouts,
opened display settings from the new summary, inspected the 13-screen map, and
walked the coffee quiz through a result and optional signup skip. The Campaigns
list shows exactly six DEMO drafts. Three targeted interaction tests, TypeScript,
ESLint, PHP syntax, diff whitespace and both admin builds passed.

## 27 September — map controls and merchant walkthrough audit

Scope: user-reported overlapping Else/insert control, ineffective Focus selection,
redundant pan hint, plus concrete inspection of demo 04 and 05 editing and testing.

Fixed:
- Edge labels and insertion buttons previously occupied the same midpoint. They
  now share a vertical anchor with separate elements and a 4px gap. SVG labels
  remain at overview zoom, where insertion buttons are hidden.
- Removed the floating selection toolbar and persistent Scroll to pan panel.
  Highlight related paths now lives in View options. Show selected screen beside
  zoom fits only the selected card; automatic selection framing still includes
  its continuation where readable. Keyboard pan actions remain in View options.
- Found a functional bug in the walkthrough: Add follow-up for My home inserted
  on the default business path. Single-choice branches now resolve with the shared
  first-match evaluator before choosing placement; grouped follow-ups retain their
  existing insertion behavior. Mixed-source/multi-answer branches ask for explicit
  placement rather than guessing. Moving placement preserves the chosen answer;
  locations without that question show an explanation and cannot insert it.
- Screen appearance preview now offers a result picker for result screens. It
  renders a preview-only variant without mutating campaign conditions or order.
- Removed the unconditional Undo available statement from campaign context panes.

Evidence:
- Reproduced edge/control and home-placement failures before fixing them.
- 88 tests passed across journey-editor, journey-map-controls,
  graph-screen-insertion and builder-preview. Home/business regression asserts
  the new screen appears only on its intended path and existing visits retain
  their sequence; ambiguous multi-answer case requires explicit placement.
- TypeScript, changed-file ESLint, diff whitespace, Free and Pro admin builds pass.
  Existing build chunk-size and renderer-test act warnings remain.
- Browser: after Fit journey at zoom 0.641, Show selected screen centres its card
  at zoom 1. Measured Else label/button gap 4px; insert button opens the business
  edge modal. No persistent pan or selection toolbar. View options toggle present.
- Demo 04 visitor test: My home + Garden landscaping + Indoor plants visits both
  matching follow-ups, skips other home/business screens, and one simulated
  accepted enquiry contains both answers. No real Lead/request is created.
- Demo 05 visitor test: Espresso machine + Rich and chocolatey reaches the rich
  espresso result before capture; optional email -> No thanks reaches the ending
  with signup marked Skipped. No real submission.
- Inspected Add screen (including location/behavior expansion), answer follow-up,
  expanded result inspector, appearance preview, Preview & test, display-rule
  presets and Add destination modal. Result preview switches actual headings.
  At 390x844 the preview/result picker and Add screen remain usable with visible
  footer actions; viewport restored afterward.
- Browser console has no errors. Save draft remains disabled after walkthroughs;
  demo campaigns remain unchanged and unpublished. PR remains unmerged; no CI run.

Remaining limits: this is a targeted two-campaign audit, not proof of every
possible graph or integration. VoiceOver remains explicitly unverified per user.
Long branched journeys still make the test Path summary lengthy; a future focused
improvement could prioritize the current/visited path and disclose skipped paths.
The main editing canvas still shows the default result; use the appearance-preview
result picker to inspect other results or Preview & test to validate their rules.

Follow-up (same date): the long Path summary limitation above is addressed by
collapsed visited/skipped/future sections and a current-screen card. Group
ownership and selection behavior were also improved. See
[follow-up hierarchy review](2026-09-27-followup-hierarchy.md) for the research,
implemented changes, browser evidence and remaining scope.

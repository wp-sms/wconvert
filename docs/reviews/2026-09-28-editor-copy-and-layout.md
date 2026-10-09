# Editor copy and layout polish

Implemented locally on `codex/plan-questions-conditional-screens`. PR #190 remains
unmerged. No campaign, destination or publication changes were saved during review.

## Fixes

- Reproduced the preview tab collapse at 1280 × 600: the modal allocated three
  grid rows for four sections. It now reserves the title, description and mode
  controls; only the preview body shrinks and scrolls.
- Destination actions use the existing region toolbar, so they cannot squeeze
  the heading into one word per line in the contextual inspector.
- Screen options use responsive full-width fields, aligned controls and spacing
  before actions. Labels are now “On completion” and “Duplicate or move”.
- Preview selectors have consistent sizing, wrapping and focus styles. Editor
  text actions, tab buttons and disclosures have explicit hover/focus feedback;
  disabled actions retain their disabled appearance.
- Shortened guidance in Edit, Theme & layout, Display rules and Destinations,
  including the PHP-provided MailPoet, WP SMS and download-email descriptions.
- Reused the existing InfoTip help popover for theme override behavior and
  answer-comparison details. These work by click or keyboard, including Escape
  and focus restoration. Essential unanswered-question behavior, publishing
  requirements and shared destination scope remain visible.

## Verification

- Local WordPress: Edit, result rules/help, result and capture screen options,
  Theme & layout/help, Display rules and its sample test, full and contextual
  Destinations, provider creation and shared settings dialogs.
- Preview & test verified at 1280 × 600 against the original reproduction;
  mode row measured 44.6px and the body remained inside the dialog.
- Standalone result preview and destination form inspected at 390 × 844.
  Preview descriptions wrap, result controls fit, and footer actions are reachable.
- JavaScript full run: 170 files passed; five assertions in three files still
  expected old wording. Updated those assertions while retaining scope, readiness
  and binding checks. Final focused run: 138 tests passed across five files,
  including all three affected files plus journey/editor regression coverage.
- Destination PHP suite: 82 tests, 259 assertions passed. All three changed PHP
  files passed syntax checks.
- TypeScript, changed-file ESLint, Free and Pro admin builds, and diff whitespace
  checks passed. Existing bundle-size warnings remain.

VoiceOver remains unverified as requested. GitHub CI was not run. This was a
presentation/copy pass; visitor routing and data contracts were not changed.

## Result-card follow-up

- Fixed a specificity conflict: the generic native-button rule overrode result
  summary padding. Result summaries now retain 12px insets, 14px titles and 12px
  condition summaries. Secondary help is explicitly 12px in the admin cascade.
- Grouped priority and removal actions in one bordered footer. Enabled removal
  controls for results, conditions, choices, products, paths and screens get red
  hover/focus feedback; disabled actions and “Review uses” stay neutral.
- Moved detailed result priority, unanswered comparisons and result-access
  explanations into existing keyboard/click help popovers. The first-match rule,
  fallback summary and reminder to disclose required contact details stay visible.
  This supersedes the earlier always-visible unanswered-question sentence.
- Verified in a separate browser tab because the user's original tab had unsaved
  edits. Did not reload, save or alter that original draft.
- Measured card insets, help typography and red keyboard focus in the rebuilt
  browser. At 390px the three footer actions fit on one row with no page overflow.
  Restored viewport afterward. Matching help still includes negative comparisons.
- 67 focused JavaScript tests, TypeScript, touched-file lint and both admin builds
  passed. No routing or draft mutation logic changed.

## Canvas cropping and interaction feedback

- Reproduced Demo 05 “Your taste”: its popup was 460px tall inside a 414px
  absolute-positioned slot. Centering clipped both ends, while Fit measured only
  the shorter mock page. The popup's inner wrapper also aligned left.
- Editor overlay previews now overlap the mock page using grid while contributing
  their intrinsic height. Popup content is centered; slide-in and bar placements
  remain aligned to their configured edges. Changes are scoped to EditorCanvas,
  leaving library thumbnails and live visitor layouts unchanged.
- Fit subtracts the stage's actual computed padding on both axes, rather than
  assuming 32px total when the stage has 32px on each side.
- Added shared hover/focus feedback to native editor disclosures, next-screen
  cards, continuation controls, preview close and selects. Keyboard focus has a
  visible outline. Existing shared-button, selected and destructive styles remain.
- Browser checks at 1280 × 800: coffee question and optional signup at desktop
  and mobile preview widths; Fit contains all content; 100% starts at the top and
  scrolls. Also checked slide-in with reasons (including top-left placement),
  floating bar with a field, fullscreen editorial and its ending. Verified the
  standalone screen-preview modal. A focused visibility disclosure showed the
  new tinted background and 2px outline in computed browser styles.
- All template swaps were in a separate unsaved verification tab and discarded.
  The user's original tab and unsaved draft were not reloaded or changed.
- TypeScript, touched-file ESLint, 83 existing preview/design/style tests, and
  Free/Pro admin builds passed. Existing bundle-size and React act warnings remain.
  No GitHub CI or VoiceOver run.

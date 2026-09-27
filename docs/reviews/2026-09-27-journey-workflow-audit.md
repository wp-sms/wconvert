# Journey B workflow audit — September 27

Scope: the running B interests prototype and the local WordPress plugin, followed
by questions, conditions, connections, capture and results. This pass addresses
editing continuity and clarity, in addition to feature availability. It does not
close the original goal or merge PR #190.

## Gaps found and corrected

| Area | Actual gap | Correction |
| --- | --- | --- |
| Map at rest | Every card repeated Add next screen and drag instructions. | Selection toolbar owns those actions. A selected card exposes a labelled plus connection handle. Selection does not resize cards. |
| Grouped follow-ups | The preceding connection named a hidden member rather than the group visible on the map. | Name Relevant follow-ups while grouped; name the actual screen when expanded. |
| Message and capture cards | Non-question cards did not show their visitor heading; messages were called Screen. | Show the heading and the concrete Message/Collect details type. |
| Screen panel | Question screens were described as Continue only; outgoing count was missing. | Show screen type, draft context and the outgoing path count. Keep saving semantics in a secondary disclosure. |
| Answer dependencies | Used by collapsed several different uses into a screen name. Clicking did not reveal the rule. Removal review listed unrelated answers' uses. | Address show conditions, branches and individual results separately. Open and focus the exact control. Removal review filters to the selected choice. |
| Navigation continuity | Following a dependency or destination required finding the original screen again. | Back to the source screen restores Content or Next screen. Navigation does not change the draft. |
| Next screen | Condition and destination controls were in the wrong reading order; destination could not be opened or previewed. | Condition first, then destination. Add Edit destination screen and Preview, and explain the destination's own show condition. |
| Preview access | Inspector-only/narrow editing required finding the card preview on the map. | Preview selected screen is available in the panel header. |
| Multi-answer conditions | Checklist occupied half of an already narrow inspector. Nested section spacing wasted room. | Full-width checklist and reduced nested spacing, including result and route conditions. |
| Capture fields | Field overview was read-only; ordinary wording changes required Design. | Expand an existing field to edit its label and placeholder. Preserve identity, validation, layout, consent and submission ownership. |
| Add screen | Several explanatory paragraphs competed and the resulting sequence was implicit. | Explain the selected connection mode, retain direct type choices, and show the resulting sequence before applying. Conditional skip behavior and branch fallback remain explicit. |
| Rule summaries | A one-choice multi-answer rule read “includes any of Garden.” | Read “includes Garden”; retain any/none wording for multiple choices. |

## Validation ledger

- Compared both running workspaces at 1512px, including map selection, panel hierarchy,
  Next screen and Add screen.
- Browser: an Interests dependency opens Garden's show condition, expands it and
  focuses its question selector. Back returns to Interests. Save draft remains
  disabled throughout navigation.
- Browser: Next screen → Edit destination screen → Back restores Next screen.
- Browser: changed Contact details' email label, opened the actual visitor-rendered
  preview and confirmed the wording, then used Undo. Save draft returned to disabled.
- Regression coverage: individual answer references (including several uses on a
  screen), exact-rule navigation, inspector round trips, and field wording edits
  preserving routes, save ownership, field validation and button actions.

Further final-build browser and regression results are appended below; do not
infer unrecorded checks from the implementation list.

## Deliberate differences and remaining external evidence

The prototype's sample-only provider, product and publishing controls must remain
real plugin workflows. Shared destination settings have a separate live scope.
Formatted text, layout and consent authoring remain in Design; this pass does not
flatten their structured content into plain text. Contact collection remains an
owned save point, rather than an unrestricted second form that could duplicate an
enquiry. Graph cycles remain unsupported.

Successful live WooCommerce catalog selection, native 200% browser zoom, and an
occasional merchant's first-use session were not established by the earlier pass.
They must not be represented as passed. VoiceOver is explicitly deferred and
GitHub CI is waived by the owner. These are separate from the concrete UI gaps
above; they were not used as a reason to leave those gaps unfixed.

## Final verification for this pass

- Full local JS suite: **169 files / 3,101 tests passed**, one worker. Subsequent
  focused checks cover the later review-use, accordion, grouping and wording
  changes: **84 tests**, then **69 tests** after the final grouping adjustment.
- TypeScript and ESLint passed. Free and Pro admin builds passed; the existing
  large-chunk advisory remains. No PHP or visitor-loader code changed.
- Browser: the quiz question's Balcony result reference expands **Balcony picks**
  and focuses its condition, rather than the first result or only the result screen.
- Browser: moving the first question changes its map position with the connection
  still attached. Drawing its selected plus handle to Contact details creates an
  incomplete branch, focuses its unchecked answers and leaves Everyone else intact.
  Choosing Garden exposes an exact branch reference under Used by. Following that
  reference reopens the branch and focuses its answer. Undoing both edits returns
  Save draft to disabled.
- Phone inspection exposed a space problem with the outcome panel outside the
  form scroller; it now scrolls with the form while Cancel/Add stay available.
- Two-choice questions exposed a disabled Review uses action; reviewing is now
  allowed while Replace uses & remove remains disabled until another choice exists.
  Added a regression covering the minimum and filtering out the other choice's uses.
- All browser content changes were temporary QA edits and were undone. No campaign
  publishing, real enquiry, destination configuration save, or GitHub CI was run.
- The browser connection briefly failed during the final phone recheck, then
  recovered. Final built assets at **390 × 844**: no document horizontal overflow;
  the Add form scrolls to the name and resulting sequence; Cancel/Add stay within
  the viewport. The condition checklist occupies **328px** and keyboard Tab brings
  its answers into view. Temporary viewport override reset and test tab closed.
- Final browser: Review uses opens for a two-choice quiz question, lists only the
  selected Garden answer's show condition and result, explains the minimum, and
  keeps removal disabled. Cancel leaves Save draft disabled.
- Final Free/Basic/Pro/Elite packages rebuilt successfully; all artifact contracts
  passed. Work remains on `codex/plan-questions-conditional-screens`, PR #190 draft.

# Merchant workflow implementation

Implemented locally on `codex/plan-questions-conditional-screens`, 28 September 2026.
PR #190 remains unmerged. No GitHub CI or VoiceOver run.

## Changes

- Question creation includes answer type and a visible valid-position proposal
  when the selected connection is after collection. Explicit insertion paths are
  not silently moved.
- Recognized independent follow-ups insert in source-choice order unless the group
  has custom ordering. Move earlier/later rewires shown and hidden continuations
  together. Insertion describes the group, its ordinal and shared continuation.
- Deletion leads with the resulting visitor continuation. Advanced continuation
  choices remain available; ambiguous deletion still requires a selection.
  Optional signup removal is confirmed in both ordered and graph campaigns.
- Results are staged with an empty rule until the merchant chooses a question and
  answer. Cancel is inert; fallback stays last.
- Used answers can be retired in one reviewed edit, listing exclusive results,
  branches and follow-ups. Shared screens remain. Contact collection and mixed
  conditions require explicit repair. Existing replacement and dependency links
  remain available.
- Structural-change notices offer Undo and Test this change. The test preserves the
  change summary and starts at the real entry; it does not fabricate answers or
  visited screens. Diagnostics use Submissions and Submitted answers, with failure
  controls disclosed separately.
- Optional SMS setup opens the provider chooser locally. Fixed its compatibility
  lookup from `sms` to the provider contract's `phone`. Newly created primary
  destinations have explicit selection buttons. Template details lead with the
  supplied journey description.

## Browser evidence

Chrome against the local WordPress plugin. Temporary campaign changes were
reversed or discarded; no campaigns, shared destinations or publications saved.

- Demo 04: added Outdoor lighting as a fifth interest; created a Short answer
  follow-up directly; verified it appeared fifth; moved it fourth. A visitor chose
  Garden plus Outdoor lighting, answered exactly those two questions, then sent
  one simulated enquiry. Submitted answers contained both interests and both
  answers. Deleted the new follow-up and restored it with one Undo.
- Demo 05: opened staged Add matching result with no preselected question/answer;
  added a French press result before Everyone else, then undid it. Retired Filter
  after reviewing its result, branch and grinder; verified the shared result and
  optional capture remained, and Undo restored the grinder and original choice.
- Demo 02: removed optional SMS only after confirmation; Undo restored it. The
  destination check exposed and led to fixing the phone-channel compatibility bug.

## Boundaries

These are developer walkthroughs and automated regression checks, not merchant
usability sessions. Automatic answer prefill for arbitrary changed paths is not
implemented: the walkthrough explicitly asks the merchant to choose answers.
Complex mixed-rule retirement remains a guided manual repair using the existing
rule links. Legacy and graph screen-action controls still reflect their different
capabilities inside the common Screen options location. Real destination delivery
and VoiceOver are unverified in this pass. No storage migration was added.

Additional browser checks after the fixes:

- Demo 01: adding a Question after email displayed a named “Add before Email
  signup” recovery action. Used it to create a Short answer question before the
  primary signup; Test this change opened the real entry with the change summary;
  Undo returned Save draft to disabled.
- Demo 02: refreshed SMS setup correctly displayed “WP SMS contacts — Needs WP
  SMS on this site.” No provider or destination was installed or created.
- Demo 05: staged result dialog checked at the normal 1512px viewport and at
  390 × 844. Fixed the staged heading input and full-width multi-answer choices.
  Cancel returned Save draft to disabled. Temporary viewport override reset.

The phone-channel check also corrected optional email insertion and capture
readiness for SMS campaigns whose goal reports the canonical `phone` value.
The former `sms` alias remains accepted for older callers.

Visual evidence: `/tmp/wconvert-result-dialog-desktop.png` and
`/tmp/wconvert-result-dialog-mobile.png` (local review artifacts).

## Local validation

- TypeScript check, targeted ESLint and `git diff --check` passed.
- Free and Pro admin bundles rebuilt in the local plugin. Vite still reports the
  existing large-chunk advisory; this change does not add a library.
- Added regression coverage for all eight interest combinations during reordering,
  external entries, custom order, explicit insertion location, staged result rules,
  retirement of exclusive versus shared/protected content, and provider channels.
- The broad suite covers 3,188 tests. One run passed 3,187 and exposed the new CSS
  type-scale violation; that was fixed and all 530 stylesheet checks passed.
  A subsequent broad run hit timeouts under machine load, so affected files were
  rerun with a single worker instead of increasing timeout limits.
- Single-worker recheck completed: all 195 tests in the five affected files passed
  with the normal timeout. The final JourneyEditor check also passed all 59 tests.
  Together with the broad suite and stylesheet recheck, no failing assertion
  remains. The full suite was not rerun again after these successful rechecks.

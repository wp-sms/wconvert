# Edit and Flow simplification

Audience: occasional merchants adapting a ready-made campaign. This pass implements
the agreed simplification across Edit, Flow, insertion, styles, results and testing.
It adds no storage or visitor-routing mode, removes no arbitrary-branch capability,
and does not change display policies or external destination contracts.

## Implemented

- Edit and Flow use the same inspector. Scope identifies screen versus element.
  Consent wording, formatting, links and visibility reuse SlotFields in a disclosure
  beside contact fields; email and SMS consent ownership remains unchanged.
  Answer-review controls appear only when the campaign contains questions.
- Theme & layout identifies its campaign-wide scope. Palette selection is prominent;
  essential typography/size/spacing controls use design-relative presets, retaining
  custom values. Detailed styling exposes exact units, pictures, effects and other
  controls without rewriting values merely by opening/closing the disclosure.
- Follow-up source and child inspectors expose a single shared continuation.
  Shown/hidden destinations and branch creation are disclosed as Custom routing,
  with an explanation of how changing them can break grouping. Repair links bypass
  disclosure when needed. Flow names the source relationship instead of suggesting
  that an optional predecessor must have appeared.
- Flow defaults to moving/selecting screens. Edit connections explicitly enables
  handles and reconnection, with callback guards as well as disabled affordances.
  Optional capture cards explain Submit versus Skip; result cards can disclose
  their outcomes and priorities. Shared saves remain one node.
- Insertion shows one resulting-journey summary with Change location. Existing-screen
  reuse is a secondary action; answer follow-ups retain prefilled conditions. Adding
  after a saved submission defaults to a message rather than an invalid question,
  without silently moving the requested insertion point.
- Referenced answer types are reviewed instead of simply locked. Compatible
  single/multiple-choice conversions preserve choices and map every visibility,
  route and result condition together. Incompatible conversions link to affected
  rules and remain blocked until repaired. Undo restores the whole draft edit.
- Selecting a result updates the main canvas to that variant without changing its
  rules. Product catalog controls are disclosed, automatically visible when used.
- Preview & test offers Visitor journey and Appearance; appearance supports screen,
  result and device selection. Switching modes retains the visitor test's progress.

## Verification

New regression coverage exercises guarded connection callbacks, child group
continuation, selected result versus draft mutation, reviewed answer-type conversion,
SMS consent ownership, essential styles/custom measurements, and incompatible rules.
Existing checks cover all interest combinations, capture boundaries, Back pruning,
result access, legacy insertion, structural removal, Undo/Redo, forms and formats.

Browser checks on local WordPress:
- Newsletter: consent is available from Edit and essential styling offers presets.
- Optional SMS: edited its consent, verified Undo returned to a clean draft; it
  remains distinct from the email consent. Narrow Add screen dialog keeps actions
  reachable. Temporary viewport override was reset.
- Home/business enquiry: group child shows shared continuation; Flow connection
  editing explicitly toggles on/off. Home + Garden + Indoor asks 1 of 2 then 2 of 2.
  Going Back and removing Garden retains the Indoor answer and changes to 1 of 1.
  Completion reaches one simulated accepted enquiry. Switching Appearance and
  Visitor journey retains that completed test. No real Lead/request was created.
- Coffee quiz: selecting the filter result displays its actual heading/content on
  the main canvas; product controls are collapsed for the local link-only demo.
- Earlier browser review also inspected the simpler multi-interest enquiry,
  content guide, display setup and destination editor. Those domain behaviors are
  retained; this pass does not claim new merchant usability research.

Final local validation:
- JavaScript suite: 3,149 tests passed across 173 files (`--maxWorkers=2`).
- TypeScript and lint passed (32 changed TypeScript/TSX files linted).
- Free and Pro admin builds passed, with the existing size warnings.
- `git diff --check` passed.
- Rebuilt assets were checked again in WordPress, including the narrow Add screen
  dialog and the grouped follow-up inspector. Demo 04 was left open in Flow with
  a clean, unsaved draft state for review.

## Delivery and limits

Changes are in the local plugin on `codex/plan-questions-conditional-screens`.
PR #190 stays unmerged; no GitHub CI run. VoiceOver remains unverified at the user's
request. Browser drafts were not saved or published. Existing build size warnings
remain. These are implementation and scenario checks, not proof of usability for
all merchants or every possible custom graph.

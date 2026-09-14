# Audit closeout — 14 September 2026

Reviewed against main `363ccda` (PR #156 merged). This is a reconciliation of
existing audit findings with current source, tests and recorded verification;
it is not a new full browser, accessibility or provider-delivery audit. No
runtime code or campaign data changed. The separate project's Top Pages tooltip
request is excluded; the mistaken WConvert Layers change was reverted.

There is no standalone roadmap-named file in the tracked repository. The
[template strategy](template-strategy-2026-09-11.md) and the reviews below carry
that planning history. This index is the current reconciliation; historical
counts, test totals and observations remain dated evidence in their reports.

## Completed work and its limits

| Audit area | Current status | Evidence |
| --- | --- | --- |
| Reading pages, filters and route summaries | Implemented. Optins, reports, Leads and Destinations have the subsequent layout and navigation work. | [Reading-page review](2026-09-10-panel-pages.md), [flow phases 3–4](2026-09-10-flow-by-flow-ux.md#phase-3-delivered-implementation). |
| “Nothing is live” despite recorded activity | Addressed. Partial milestone history uses impression/conversion evidence without inventing dates. | [Milestones](../../resources/admin/src/milestones/Milestones.tsx), [regression cases](../../tests/js/milestones.test.tsx). |
| Finding and comparing designs | Implemented: feature search, filters, recommended order, desktop/mobile and Form/Success preview, Keep/Sample preparation. | [Library curation](template-library-curation-2026-09-11.md), [TemplatePicker](../../resources/admin/src/builder/TemplatePicker.tsx), [TemplateDesignDetail](../../resources/admin/src/builder/TemplateDesignDetail.tsx). |
| Draft-wide Undo, Save/Publish separation, placement guidance | Implemented. Saved unpublished changes are identified; this is not a visual comparison of the two versions. | ADRs 0070/0075, [OptinBuilder](../../resources/admin/src/builder/OptinBuilder.tsx), [ReadinessDialog](../../resources/admin/src/builder/ReadinessDialog.tsx). |
| Destination setup, compatibility, shared usage and recovery | Implemented. Requirements cover selected providers and routes; publishing does not exercise delivery. The failure log is bounded diagnostics, not a complete delivery ledger. | [DestinationRequirements](../../src/Destination/DestinationRequirements.php), [DestinationUsage](../../src/Destination/DestinationUsage.php), [flow phase 5](2026-09-10-flow-by-flow-ux.md#phase-5-remainder--editor-qualification-and-destination-contracts). |
| Existing fields and first qualification choice | Implemented: email/phone/name feedback and optional `interest`, with stable value and captured label. A free-text message field is not implemented. | [CanonicalFields](../../src/Destination/CanonicalFields.php), [manifest](../../resources/templates/manifest.json), [lead journey](2026-09-11-lead-journey-qa.md). |
| Truthful success wording | Bundled wording corrected; capture is not confirmation, appointment booking or inbox receipt. Existing merchant snapshots were not rewritten. | ADR 0073, [library curation](template-library-curation-2026-09-11.md), later enquiry acknowledgement in [QA](2026-09-11-lead-journey-qa.md). |
| Layers insertion, scrolling, keyboard operation and selection | Implemented within the existing structure. Reordering is within siblings; arbitrary movement between containers remains deferred. | [Controls audit](editor-controls-audit-2026-09-11.md), [editor follow-up](editor-followup-2026-09-11.md), [structure tests](../../tests/js/builder-structure-view.test.tsx). |
| Fonts, shadows and short-copy formatting | Implemented: font search/WordPress Font Library route, visual shadows, Bold/Italic/Link/Clear. Rich multi-range text is not implemented. | [Editor follow-up](editor-followup-2026-09-11.md), [controls audit](editor-controls-audit-2026-09-11.md). |
| Split swapping, picture focus and success actions | Implemented: Swap sides, desktop/mobile image position, code copy and non-converting resource links. | [Strategy implementation](template-strategy-2026-09-11.md), ADR 0080. |
| Padding, gradients, mobile override summaries | Implemented in PR #156, using existing style values and Undo. Complex CSS stays editable; reset affects the selected element only. | [Style-control review](content-transfer-style-controls-2026-09-14.md), [control tests](../../tests/js/builder-friendly-styles.test.tsx). |
| Content preservation on design change | Implemented with limits: changed pictures transfer to suitable slots. Missing/ambiguous matches and unavailable originals are explained before Apply. This is not lossless arbitrary merging. | [PictureTransfer](../../src/Template/PictureTransfer.php), [matching tests](../../tests/unit/Template/PictureTransferTest.php), ADR 0084. |
| Library quality and flagship coverage | Curation completed; 50 current designs, twelve flagship starting points. Placeholder assets remain intentional. Counts are not a reason to add more designs. | [Decision ledger](template-library-curation-2026-09-11.md#decisions-for-every-template), [flagship report](flagship-starting-points-2026-09-11.md). |
| Local template catalog and collections | Implemented: validation, immutable local versions, offline installed access, three collections and ten downloaded starting points. Download support remains Free popup/inline with no media package. | [Installer](template-catalog-installation-2026-09-11.md), [collections](curated-template-collections-2026-09-14.md), [campaign starts](catalog-campaign-starts-2026-09-14.md). |
| Pack scrolling and preview layout | Implemented: header tabs, status badges, aligned list/preview, independent scroll areas and visible actions. | [Pack experience](template-pack-experience-2026-09-14.md). |
| Authoring validation and visitor budgets | Existing manifest/normalization diagnostics and loader contracts cover the core proposal. A generated JSON Schema is optional tooling, not a missing runtime contract. | [Template verifier](../../bin/verify-templates.php), [LibraryLintTest](../../tests/unit/Template/LibraryLintTest.php). |

Track these follow-ups in the [product todo list](../TODO.md).

## Remaining opportunities, in priority order

These are recommendations for subsequent decisions, not approved implementation
in this documentation task.

1. **Resolve shared colors in readability checks.** The renderer handles color
   references such as `input-bg: bg`, while the contrast helper takes literal
   values and can give no reading. Resolve the effective scoped desktop/mobile
   color using renderer-consistent semantics. Keep images, gradients and unknown
   compositing explicitly unmeasured. This is a concrete code-confirmed gap in
   [ScopeContrast](../../resources/admin/src/builder/ScopeStyle.tsx) and
   [contrastOf](../../resources/admin/src/builder/contrast.ts).
2. **Review context-aware offer setup reminders.** Existing checks already reject
   malformed resource links and report selected-route incompatibilities. They
   cannot establish that a merchant's code works or the promised resource will
   be fulfilled. Consider a small pre-publish reminder for applicable setups,
   with clear edit actions. Do not infer requirements solely from a starting
   point that the merchant may have changed, require a Destination for every
   capture, or claim a URL proves fulfilment. Scope this before adding blockers.
3. **Consider a compact draft-versus-live summary.** The product already says
   when saved changes are unpublished. A merchant could benefit from seeing
   which content, rules or destinations changed before Publish changes. Compare
   the existing snapshots; no new storage or general version-control interface
   is needed. This is optional UX work, not broken publishing.

## Deferred or conditional

- **Move to… and cross-container dragging:** explicitly deferred by the user.
  Sibling movement and Swap sides already cover simpler arrangements.
- **Production catalog hosting, paid fetching and media installation:** keep
  the local sample catalog. Assets would need a separate size/provenance and
  download policy; placeholder-only packages do not prove that future policy.
- **New artwork and release preparation:** not authorized in this closeout.
- **More templates:** add a composition only for a demonstrated use-case gap;
  the reviewed collection and starting points already exist.
- **Message fields, rich text ranges, multi-selection, layer search and per-device
  visibility:** optional extensions requiring evidence of need. Current mobile
  overrides change styling, not device-specific copy, ordering or visibility.
- **Restock alerts, emailed baskets and email-then-SMS journeys:** separate
  integration/capture/consent designs, not features unlocked by new templates.
- **Internal cleanup:** the reviews mention shared preview sizing and avoiding
  duplicate picture-preparation calls. These are optional maintenance suggestions,
  not missing merchant behavior or reasons to repeat completed features.
- **Generated JSON Schema:** optional author tooling. Keep the manifest and
  normalizer authoritative; the existing verifier already reports dropped data.

## Verification still has boundaries

The recorded local journeys establish capture, queue execution, MailPoet
acceptance, choice mapping and local mail transport. They do not prove external
inbox receipt or every provider's end-to-end behavior. Those checks require a
chosen receiving service and an explicitly authorized test recipient; no new
send was performed here. Existing tests cover refusal/retry seams, which is
not the same as a fresh live failure/recovery test for every adapter.

The design review measured multiple widths, content variants, RTL and selected
visitor journeys. It was not a complete manual accessibility audit or a physical
mobile-device test. Merchant photos and copy can change readability and layout.
Retain those review limits; do not mark every future customization verified.

The latest recorded loader result reaches the existing Elite cap, so a future
visitor-side feature needs budget verification before acceptance. GitHub CI is
billing-blocked; the merged work used recorded local checks under the user's
instruction. That operational issue is separate from implementation completion.

## Closeout checks

- Read all 14 prior review records, including later completion sections, and
  checked the relevant current source/test seams rather than treating early
  “next” paragraphs as the current backlog.
- Corrected superseded recommendations in the original reviews and linked this
  index from the strategy. This does not alter their historical QA claims.
- Re-ran the template registration verifier: all 50 designs survive intact.
- Verified local Markdown file links and a clean documentation diff. Runtime
  suites and browser QA were not repeated for documentation-only changes.

## Merge review

Standards and specification reviews independently identified two stale passages:
the historical three-field inventory and a completed provider-metadata task
still phrased as a next step. Both now describe the completed state. The panel
review's scope note also explicitly identifies its historical boundary. Neither
review found a material problem with the todo list or its deferred scope.

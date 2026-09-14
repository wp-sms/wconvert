# Product follow-ups

Last reconciled: 14 September 2026. These are reminders for later work, not
instructions to implement everything. The [audit closeout](reviews/audit-closeout-2026-09-14.md)
records completed work and evidence. Check items only when their outcome is
implemented and verified; retain a PR link when closing them.

## Next candidates

- [ ] **Resolve shared colors in readability checks.** Follow color references
  through the selected element's desktop/mobile styles before measuring contrast.
  Example: `input-bg: bg` should use the actual background color. Cover inherited
  values and references with tests; keep unknown image/gradient compositing
  explicitly unmeasured. Start with `builder/ScopeStyle.tsx` and `builder/contrast.ts`
  under `resources/admin/src/`.
- [ ] **Scope offer setup reminders before publishing.** Help merchants notice
  applicable missing setup, such as their discount code or promised resource.
  First define behavior for changed starting points, local-only capture,
  on-screen downloads and externally fulfilled offers. Reuse existing resource
  and destination checks, avoid duplicate warnings, and do not add a universal
  destination requirement or claim a configured URL proves delivery.
- [ ] **Evaluate a compact draft-versus-live summary.** Show what content, rules
  or destination bindings changed before Publish changes. Reuse existing draft
  and published snapshots, preserve Save/Publish separation, and handle campaigns
  with no published version. Prefer a concise summary before a full visual diff.

## Parked — revisit only when needed

- [ ] **Move to… between containers.** Explicitly deferred; require a clear use
  case beyond sibling reordering and Swap sides before designing the destination
  picker, structural guards, focus restoration and Undo.
- [ ] **Production catalog hosting.** Keep the local sample catalog until the
  user chooses to proceed. Treat paid fetching and media installation as separate
  decisions; preserve installed offline copies and existing campaigns.
- [ ] **Paid packs and media installation.** Define entitlement, asset size,
  provenance, safe download and local persistence before expanding the current
  Free popup/inline, placeholder-only package contract.
- [ ] **Additional editor/field capabilities.** Revisit message fields, rich text
  ranges, multi-selection, layer search or per-device visibility only for a
  demonstrated user need. New capture fields need the complete validation,
  storage/export and supported-destination path.
- [ ] **New compositions or commerce journeys.** Add templates for a coverage
  gap, not a target count. Restock alerts, emailed baskets and email-then-SMS
  need separate integration/capture/consent decisions. No generated artwork.
- [ ] **Small internal cleanup when touching the relevant code.** Consider shared
  preview sizing and a single picture-preparation/report calculation. A generated
  JSON Schema is optional author tooling; keep the current manifest authoritative.

## Before a future release

Release preparation remains deferred. These checks are not evidence that a
current defect exists and do not authorize publishing or external test sends.

- [ ] Restore GitHub CI once the account billing issue is resolved.
- [ ] Run focused manual accessibility and physical-phone checks on representative
  visitor/editor flows, including long copy and merchant-selected photos.
- [ ] Verify the selected supported providers' end-to-end delivery and failure
  recovery with explicitly authorized test recipients. Distinguish provider
  acceptance, local mail transport, inbox receipt and subscription confirmation.
- [ ] Recheck visitor bundle budgets for changes that affect them; the latest
  recorded Elite loader result reaches the current cap.

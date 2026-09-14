# Choices first, details on demand

Accepted 2026-09-14 after the merchant review of the Goal and setup screens.

## Decision

The creation and design-browsing surfaces must prioritize comparison and action.
Repeated documentation should not compete with the choices it explains.

- Creation keeps section navigation and Back, but omits the redundant Campaigns
  heading band. The current question is its visible heading; the section heading
  stays available to assistive navigation. List/report headers remain unchanged.
- Campaign setup cards show the real preview, task name, recommendation/collection
  when present, and a short summary of actual format and timing. Inline cards name
  the block/shortcode placement task. **Use this setup** still creates a draft
  directly; it introduces no confirmation step.
- **Setup details** opens one optional dialog for the selected setup, containing
  the full derived facts, measurement boundary, requirements, checklist and notes.
  Opening/closing details writes nothing and returns keyboard focus to its trigger.
  Draft/publication guidance is shared once, not repeated on every card.
- The Goal stays visible as a compact button in the editor's existing footer.
  Its measurement and Change/Duplicate action are in Campaign details, also
  reachable from the header. There is no permanent Goal/metric row above the canvas.
- Browse designs keeps Format and source in the header; search, **For this goal /
  All designs**, and **Filters** in the toolbar. Filter options are collapsed by
  default. Active filter chips and the live result count remain visible.
- Format-change consequences appear beside **Use this design**, including inline
  placement, rather than as a permanent warning above every design. Browsing and
  cancelling remain read-only; Apply/Undo semantics are unchanged.
- Shared dialog titles/descriptions explicitly reset host paragraph/heading margins.
  Header gaps come from the component, not doubled WordPress browser defaults.

This changes presentation, not publication requirements, result definitions,
audience handoff, compatibility checks or storage. No DB/backfill work is involved.

## Verification

Behavioral tests cover optional setup details, no-write browsing, focus restoration,
collapsed/active filters, Goal access, and format warnings associated with Apply.
Verify the built UI on real WordPress as well: automated DOM tests do not measure
layout. A compact UI is an implementation decision, not evidence of successful
first-time-user testing; that study remains outstanding.

# Choices first, details on demand

Accepted 2026-09-14 after the merchant review of the Goal and setup screens.

## Decision

The creation and design-browsing surfaces must prioritize comparison and action.
Repeated documentation should not compete with the choices it explains.
**Extended by [ADR 0088](0088-handoff-state-and-required-fixes-lead-the-review.md)** to
Destinations and Review & publish: current selection and required fixes lead;
setup/measurement background is optional, while consequential warnings stay visible.

- Creation keeps section navigation and Back, but omits the redundant Campaigns
  heading band. The current question is its visible heading; the section heading
  stays available to assistive navigation. List/report headers remain unchanged.
- Campaign setup cards show the real preview, task name, a compact format badge,
  recommendation/collection when present, and a short summary of actual placement
  and timing. Inline cards name the block/shortcode placement task. Format and
  collection filters refine the already Goal-scoped results in the browser; neither
  becomes an earlier or required choice. A filter combination with no matches offers
  a direct reset. **Use this setup** still creates a draft directly; it introduces no
  confirmation step.
- **Setup details** opens one optional dialog for the selected setup, containing
  the full derived facts, measurement boundary, requirements, checklist and notes.
  Opening/closing details writes nothing and returns keyboard focus to its trigger.
  Draft/publication guidance is shared once, not repeated on every card.
- Updated after editor review on 2026-10-02: the Goal, its measurement and
  Change/Duplicate action live in Campaign details, reached from the header’s
  ellipsis button. The redundant Goal footer is removed; save status sits beside
  the campaign name and mobile-editing guidance beside the device selector. Display rules
  and Destinations retain their top-level tabs, with contextual shortcuts at the
  flow’s first screen and capture screens/settings instead of a summary bar.
  These shortcuts open the existing side panels without leaving the campaign.
- The Design tab names **How it appears** — current format, effective physical
  placement where one exists, and design — before offering **Browse designs and
  formats**. A draft without a design starts at that same goal-aware library rather
  than presenting format as a new first question.
- Browse designs keeps Format and source in the header; search, **For this goal /
  All designs**, and **Filters** in the toolbar. When available, the fit control
  names the actual Goal rather than the abstract phrase “this goal”. Format remains
  a browsing filter within the selected Goal, not a mandatory creation step. Filter
  options are collapsed by default. Active filter chips and the live result count
  remain visible.
- Format-change consequences appear beside Apply, including the old and new format,
  the unchanged Goal, inline placement or reset overlay position as applicable.
  The action names the format switch. Browsing and cancelling remain read-only;
  Apply/Undo semantics are unchanged.
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

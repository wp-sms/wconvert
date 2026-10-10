# 0135: Plain style controls; exact values under Advanced

Date: 2026-10-10. Status: accepted.
Phase 3 of [docs/plans/editor-ux-2026-10-09.md](../plans/editor-ux-2026-10-09.md),
after [0134](0134-one-edit-tab-look-screen-element.md).
Amends [0054](0054-every-control-has-the-shape-of-its-value.md) (where the
escape hatch lives), [0078](0078-editor-choices-stay-compact-and-scrollable.md)
(unit menus), [0084](0084-picture-transfer-and-friendly-style-controls.md)
(Custom CSS boxes) and [0108](0108-explicit-journey-graph-and-legacy-migration.md)
(the hidden edge).

The style panel spoke CSS: a hex code on every swatch, a unit menu beside every
number, a typed box under every choice, contrast as "1.48:1 · Under AA", and
three type-size words that did not match the element's own. A merchant reads
"Forest", "Medium" and "Hard to read on this background".

## Decisions

1. **One Advanced switch per panel** (`advanced.ts`). The plain view is presets,
   swatches and words; Advanced adds what only someone who knows CSS reads:
   unit menus, typed values and Custom CSS boxes, shadow pixels, gradient
   degrees and stop positions, position percentages, hex codes, the heading
   level and contrast ratios. Fields read it from context, so none grows its
   own "show more". The Look's switch is Tokens' old "Detailed styling…"; the
   element's sits at the foot of its Style tab, layout boxes included. A value
   only CSS can say shows "This value is set in CSS. Open Advanced to change
   it." rather than a box. One exception stays: a token no field understands
   keeps its text box, because it has no other control.
2. **Colors are named** (`colorName`): the nearest of a small palette in Lab
   ("Forest", "Cream", "Navy, see-through"), or "Custom color" when nothing is
   near. The hex is Advanced's.
3. **One readability verdict** (`readability`, `readableOn` in `contrast.ts`),
   read by the Look, the element panel and the review alike: "Easy to read",
   or "Hard to read on this background. Choose a darker color." (lighter on a
   dark background). **Fix** writes the first of the look's own text or
   background colors that reads, else black or white. The ratio shows only
   under Advanced, at one precision. "Under AA" and "No reading" are gone.
4. **One size word list.** The element's Size reads Small · Medium · Large ·
   Extra large (with the template's Very small and Huge at the ends); the
   Look's type sizes use the same words, and anything else is "Custom". The
   exact Heading size and Text size tokens and the heading level ("Heading
   level, for screen readers and search") are Advanced's.
5. **Reset this element** clears what the element sets for the device being
   edited — desktop or mobile — and is disabled when it sets nothing. It
   replaces the mobile-only reset.
6. **The Flow map opens fitted**, whole, and then follows the selection. Its
   tools are one line: − % + · Fit · Tidy up · Highlight paths · ⋯ (Screen
   previews, Group follow-ups). Go to first screen, panning earlier or later
   and Show selected screen were ways around a map that did not open fitted. A
   card's issue count opens every issue about that screen, each a way to its
   fix. The first drag says once, per browser, that moving a card only tidies
   the map. **The side panel in Flow is the slim screen panel** of
   [0134](0134-one-edit-tab-look-screen-element.md), as on the canvas: it was
   still the old inspector there, with every word as a text box and a Paths
   tab. Clicking a question's path opens the question, where its paths live.
7. **A skipped screen falls through along its default edge.** A screen whose
   "Show only if…" is false continues where it would have gone, so the hidden
   edge is an optional override ("If skipped, go to…"), not a requirement.
   `JourneyGraph::trace` and the loader's `graphTrace` follow `hidden ?? default`
   and agree through the shared fixture's `fallthrough` cases; validation
   allows at most one hidden edge and no longer requires it; readiness stops
   asking "Choose where visitors go when … is hidden"; adding a condition adds
   no edge, and removing it removes the override. "Next screen" means the
   default edge, not the next entry in `steps`, which has carried no order in
   a graph since 0108. Every existing hidden edge already points where its
   default does, so existing campaigns trace the same screens. The server
   already refuses a condition on the first screen, a result, an ending or a
   submit screen, so every skippable screen has a default edge to follow.

## Consequences

- Contrast copy in the review matches the panel's (`problems.ts`).
- Follow-up groups form with or without a hidden edge, as long as one that
  exists points where the default does.
- A hidden edge that points where the default does reads as falling through
  in "If skipped, go to…".

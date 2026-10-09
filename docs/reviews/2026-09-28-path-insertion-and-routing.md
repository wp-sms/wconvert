# Path insertion and structured routing — 28 September 2026

## Decisions and implementation

- Remove global inventory numbers from flow cards and the flow inspector. They
  wrongly imply that competing alternatives are consecutive visitor steps.
- Replace bare edge plus buttons with “Add screen here”, visible on selection,
  hover and keyboard focus, and always exposed on touch. The accessible name
  contains the visible label and destination; the native tooltip names both ends.
- Put the affected path and resulting sequence at the top of Add a screen.
  The Everyone else path explicitly says only its visitors see the new screen.
  Named questions update the preview. Ending/existing-screen choices do not
  falsely show continuation to the old destination. The fixed map toolbar can
  also insert on the selected edge rather than defaulting to another path.
- Route clear forward links through their centre corridor with rounded right
  angles. Use the existing obstacle-aware router when that corridor intersects
  another card, or for backward links. Layout positions and branch semantics
  remain owned by the existing hierarchy pass.
- Give distinct incoming paths stable, separate target ports and approach lanes.
  This avoids an ambiguous shared run of line before the actual rejoin card.
  Port order follows the displayed hierarchy, not the current dragged Y position.
- Reserve the actual label/action rectangle against every card. Check candidate
  positions along straight segments, including alternate positions when a long
  vertical segment runs beside a card. Hide floating tools when no safe location
  exists; the card's path button and path inspector remain usable.

## Routing comparison

React Flow separates layout from routing. Sources:
- https://reactflow.dev/learn/layouting/layouting
- https://reactflow.dev/examples/layout/elkjs-multiple-handles

Compared ELK layered/RIGHT/ORTHOGONAL with fixed ordered EAST/WEST ports on the
coffee, branch-groups and enquiry fixtures. All cards were 252×240 for this
bounded geometry experiment, with 240px layer spacing and 100px node spacing.
ELK returned 4, 20 and 6 bends respectively; cold/warm Node runs took 47/15/6ms.
These are observations from one local run, not production performance estimates.
Coffee entry/taste/grinder/result moved to successive horizontal ranks at
x=12/504/996/1488: the optional-detour hierarchy was lost. ELK is configurable;
this does not prove it cannot preserve that hierarchy. It shows why a wholesale
replacement is not justified by this experiment. No runtime dependency added.

Kept the current hierarchy and routing worker, adding predictable clear corridors.
The router tests cover both RTL directions, obstructed paths, vertical detours,
backward fallback, and full label rectangles near cards.

## Verification

- Demo 04 browser: both branch labels clear nearby cards; no intersections
  between any rendered floating control rectangle and the seven rendered nodes.
- Clicked Everyone else → Add screen here. The dialog showed the specific path
  and source → new question → Your business interests before applying anything.
- Inserted “When should we contact you?” into an unsaved draft. Everyone else
  pointed to it, it continued to Your business interests, and My home still
  pointed to Your home interests. Undid the test; Save draft returned disabled.
- Automated insertion tests verify both default and conditional paths preserve
  every unrelated edge, and a closing screen does not promise continuation.
- Demo 05: detour kept below entry; the two result inputs are 18px apart.
  Keyboard Tab from Everyone else reveals Add screen here (computed opacity 1).
  No floating controls intersected cards. A direct drag moved the taste card;
  all six SVG connections remained valid after it settled. Tidy up restored it.
- The fixed selected-path toolbar opened the correct coffee fallback insertion.
  At 320px viewport width, dialog width/scrollWidth were both 286px; the path
  context was 232px wide without overflow, and page width/scrollWidth were 320px.
- 634 tests passed across editor, map, insertion and stylesheet suites.
  TypeScript, touched-file ESLint and Free/Pro builds passed. Existing bundle
  warnings remain. No GitHub CI, save, publication or merge.

No exhaustive graph/translation audit is claimed. When people manually overlap
cards, or dense paths leave no label space, the inspector remains the reliable
editing surface. VoiceOver remains unverified per the user's earlier decision.

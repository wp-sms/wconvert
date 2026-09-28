# Journey hierarchy — 28 September 2026

## Implemented

The map now recognises conservative, closed branch regions. A single optional
follow-up (including a chain or collapsed group) sits below its entry screen.
The shared result remains on the main horizontal row. Competing alternatives
occupy separate lanes in stored priority order. Independent matching follow-ups
keep their existing grouping and visitor semantics. Complex/nested regions or
arms with outside entries retain the explicit Dagre layout.

Measured region bounds prevent automatic card overlap. Manual positioning and
retained measurements remain intact. RTL mirrors the layout. Top/bottom handles
make the optional detour directional; handle measurements refresh when the
structure changes. None of this alters saved edges or visitor traversal.

Condition labels replace edge numbers/“Else”; priority numbers appear only when
multiple conditional paths compete. Label clicks open the corresponding rule.
Labels use a long straight section of the routed line instead of short elbows,
and insertion remains a separate action. Selected-screen actions occupy a fixed
row outside the canvas. Selection includes a small detour and its shared rejoin
when they remain readable; narrow/dense layouts retain selected-screen focus.

## Evidence

- Real local WordPress Pro editor: Demo 05 coffee quiz, optional grinder question,
  shared result and optional signup. The question is below its entry; the result
  is to the right. Clicking its condition opens the exact question/comparison/
  answer editor. No campaign edits were saved or published.
- Demo 04: Home and Business occupy separate ordered lanes, each with four
  grouped follow-ups, then one shared enquiry and ending. Expanded Home follow-ups
  expose their explicit routes; ten rendered nodes and ten valid SVG paths,
  with no captured browser warnings/errors.
- At 1280×800, the selected coffee detour and shared result fit together at
  0.661 zoom with both condition labels present. The last card ends at y=677.4;
  bottom controls start at y=691, leaving clearance. Padding uses the actual
  toolbar bounds rather than assuming its height alone.
- Direct browser drag moved the entry from (492,279) to (546.981,292.022).
  All six connections remained rendered with valid paths after the move.
  Tidy up restored (492,279). This verifies the settled drag result, not a
  frame-by-frame claim about every possible movement.
- Automated coverage: ordinary sequence; optional single/multiple screens;
  competing alternatives; external entries; nested splits; grouped detours;
  variable measured sizes; RTL; camera context; label and insertion actions;
  preserving manually dragged positions and measurements; obstacle routing.
- 574 relevant map, follow-up and stylesheet tests passed. The 16 grouping tests
  passed again after the final grouped-port adjustment. TypeScript, touched-file
  ESLint, Free/Pro admin builds and whitespace checks passed. Build size warnings
  remain. No GitHub CI was run.

The automatic rules intentionally do not simplify every arbitrary graph. Dense
journeys still need zoom/pan, and cards manually dragged on top of one another
need repositioning. Browser sampling is not an exhaustive audit of every graph
or translation. VoiceOver and a live RTL browser pass remain unverified.

# Explicit journey graph and legacy migration

Accepted 2026-09-25. Supersedes the routing and size assumptions in
[ADR 0107](0107-forward-journey-paths-and-flow-editor.md) for graph journeys;
version 2 campaigns remain readable and keep their existing behavior.

The journey's stored `steps[]` keeps each screen's content and identity but no
longer decides where visitors go. A version 3 journey names one entry screen
and stores edges with stable IDs, `from` and `to` screen IDs, and one of three
kinds: `answer`, `default`, or `hidden`. Answer edges are checked in their saved
order and the first matching condition wins. The default edge is the explicit
Everyone else path. A screen with a show condition uses its hidden edge when
that condition is false; none of its answer edges run. An ending has no outgoing
edge. The graph must be acyclic and every screen must be reachable from the
entry. Canvas coordinates and screen array order never route a visitor.

The capture request currently accepts at most ten question answers. For v3,
publication and the Add question control therefore bound the longest connected
route at ten questions, not the total question bank across exclusive branches.
Hidden exits omit their source screen's questions. This is a conservative
structural bound: conditions may reduce the questions actually seen, but we do
not solve combinations of answer predicates to relax the limit. Publish review
names an over-limit route and links to its question controls. Version 2 retains
its total ten-question bound. A higher per-visitor limit requires separate
payload and capture verification; the request bound has not been raised.

Independent conditional follow-ups remain separate screens connected in
sequence. Each has a show condition, a normal continuation, and a named hidden
continuation to the next relevant screen. Several follow-ups can therefore run
for one multi-answer choice before one enquiry submission. Exclusive answer
edges are used only when one path must win. A merge is several edges targeting
the same screen, which is visited once in the acyclic traversal.

An unanswered or unvisited source question makes either positive or negative
comparison false. A question referenced by a rule must be available on at least
one incoming path; it may be absent on another path, where that rule simply
does not match. Back keeps answers from screens still on the resolved path and
prunes answers from screens no longer visited. An accepted submission freezes
its fields, consent and question snapshot. Required capture is decided by the
campaign Goal: an enquiry route must reach its one combined submission; a
quiz or content route may finish anonymously unless its Goal requires capture.
Publishing must reject cycles, dangling or duplicate edges, missing defaults
or hidden exits, unreachable screens, impossible rule sources, invalid capture
ownership and any path that bypasses required capture.

Version 2 journeys remain on their existing ordered evaluator until explicitly
upgraded in a draft. Migration creates explicit default and answer edges from
their current paths, plus a hidden edge to the next ordered screen wherever a
show condition exists. It removes the old `paths` keys only after creating the
graph, then persists stable edge IDs. The migration is checked against legacy
visitor paths before the editor offers it. Version 3 publication checks graph
topology, field and consent ownership, submission boundaries, and goal-specific
required paths; a valid topology alone is not publishable. A field or consent
screen must appear on every path to its save point. Branch-only contact fields
remain unsupported until the capture endpoint can verify which field screens
were visited.

For a quiz with a terminal result, the editor can attach one optional email
signup after the result. It can move that signup before the result to require
capture, or move it back afterward, when the result/signup/ending connections
have the simple shape the editor can transform without losing another path.
Incoming branch edges keep their IDs and are retargeted together. Field and
consent ownership stays explicit, merchant-written copy stays intact, and a
more complex topology requires manual route editing rather than a silent
rearrangement.

React Flow is an admin view of this data, not the source of routing semantics.
The Screens inventory and inspector must support every authoring action without
dragging, including changing priority, fallback and hidden exits. Layout and
viewport metadata stay outside the visitor graph. The product-facing scale
limit will follow payload, loader and dense-map measurements rather than the
old seven-screen limit or a new arbitrary number.

Dagre continues to position cards using their measured sizes. The lazy admin map
uses React Flow Smart Edge for obstacle-aware smooth-step connections: long
branches and hidden exits must go around intervening cards. Its worker batches
routing updates while dragging; retained measurements and controlled positions
prevent layout resets. When workers are unavailable it routes on the main
thread. This is a presentation dependency only; visitor traversal and server
validation never import it. Overlapping cards still need repositioning, and
dense-map browser measurements remain part of the release gate.

### Product recovery and paid byte caps

Product lookup failure must retain the selected result, its browse fallback and
keyboard position. Retry keeps the same focused control during loading and
another failure; successful recovery moves focus to the first usable product
only if the visitor has not moved it elsewhere. Leaving the result aborts the
request. Malformed or off-site catalog links are filtered before the display
limit, and an entirely unusable list shows the unavailable explanation.

The September 26 recovery build measured with Node 22 gzip level 9 is
13,850 / 24,196 / 25,156 / 25,390 bytes for Free / Basic / Pro / Elite. This
behavior exceeds the paid limits from ADR 0106 by 132 / 68 / 46 bytes. Allocate
256 additional bytes per paid rung for this visitor recovery behavior: the
hard caps are now 24,320 / 25,344 / 25,600 bytes. Free stays at 14,012 bytes,
and the separately loaded phone asset, payload and design caps stay unchanged.
The check remains blocking and flagless; no general waiver or warning band is
introduced. Both loader and combined loader-plus-phone reporting use these caps.

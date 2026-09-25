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
visitor paths before the editor offers it. Publication of version 3 waits for
the graph-specific capture and goal validation; a valid topology alone is not
publishable.

React Flow is an admin view of this data, not the source of routing semantics.
The Screens inventory and inspector must support every authoring action without
dragging, including changing priority, fallback and hidden exits. Layout and
viewport metadata stay outside the visitor graph. The product-facing scale
limit will follow payload, loader and dense-map measurements rather than the
old seven-screen limit or a new arbitrary number.

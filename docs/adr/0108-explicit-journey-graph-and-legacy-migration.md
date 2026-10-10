# Explicit journey graph and legacy migration

*Byte limits amended by [ADR 0111](0111-spam-protection-precedes-capture.md): Free / Basic / Pro / Elite now cap at 14,592 / 25,088 / 26,624 / 26,880 bytes gzip-9 after pre-capture verification and campaign events. Other asset limits are unchanged.*

> **Budget amended by [ADR 0109](0109-ad-block-observation-is-a-bounded-condition.md):** The current loader caps are 14,336 / 24,832 / 26,368 / 26,624 bytes gzip for Free / Basic / Pro / Elite. The earlier measured limits below describe this ADR's feature cost at that time.

Accepted 2026-09-25. Supersedes the routing and size assumptions in
[ADR 0107](0107-forward-journey-paths-and-flow-editor.md) for graph journeys;
version 2 campaigns remain readable and keep their existing behavior.

The journey's stored `steps[]` keeps each screen's content and identity but no
longer decides where visitors go. A version 3 journey names one entry screen
and stores edges with stable IDs, `from` and `to` screen IDs, and one of three
kinds: `answer`, `default`, or `hidden`. Answer edges are checked in their saved
order and the first matching condition wins. The default edge is the explicit
Everyone else path (*"All other answers" since [ADR 0134](0134-one-edit-tab-look-screen-element.md)*). A screen with a show condition (*"Show only if…"*) uses its hidden edge when
that condition is false; none of its answer edges run. *Amended by [ADR 0135](0135-plain-style-controls-exact-values-under-advanced.md): the
hidden edge is optional — with none, a skipped screen falls through along its
default edge, in the server trace and the loader alike.* An ending has no outgoing
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
for one multi-answer choice before one enquiry submission. The editor presents
these as a group of independently checked follow-ups. When
one directly preceding question supplies all conditions, its follow-ups nest
under that question in the screen navigator. Selecting a child keeps the Flow
group intact; expanding individual connections is explicit. Ambiguous ownership
or multiple incoming paths remains un-nested rather than implying a false parent.
The ordinary inspector exposes one shared continuation for a group, both from
its source and from each member. It updates the last member's shown and hidden
exits together. Individual exits remain available through explicit Custom routing (*"Send some answers down another path", on the question element's "Where visitors go next", since [ADR 0134](0134-one-edit-tab-look-screen-element.md)*);
changing them can dissolve the inferred group, and existing impact review still
applies. Broken-path repair opens the necessary individual control directly.
The canvas defaults to selection and layout: drawing/reconnecting requires Edit
connections (*"Edit paths" since [ADR 0134](0134-one-edit-tab-look-screen-element.md)*). This is an authoring guard, not a new stored graph mode.

Edit and Flow share screen/element controls and draft history. Consent wording
and visibility reuse the element controls beside capture fields. Theme & layout
owns campaign-wide styling, with presets first and detailed controls on request.
Result selection is preview-only state and does not rewrite matching rules.
*Amended by [ADR 0138](0138-one-preview-one-review-one-details.md): the standalone screen preview that offered it is gone;
the result being edited is the one the canvas draws.*
Referenced single/multiple-choice type changes require review, preserve choice
IDs/order and map compatible comparison operators in one draft edit. Free-text
conversion and multi-value-to-single comparisons require explicit rule repair;
no conditions are silently dropped.

Exclusive answer edges are used only when one path must win. A merge is several edges targeting
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
~~or hidden exits~~ (*a hidden exit is optional since [ADR 0135](0135-plain-style-controls-exact-values-under-advanced.md)*), unreachable screens, impossible rule sources, invalid capture
ownership and any path that bypasses required capture.

Version 2 journeys remain on their existing ordered evaluator until explicitly
upgraded in a draft. Migration creates explicit default and answer edges from
their current paths, plus a hidden edge to the next ordered screen wherever a
show condition exists. It removes the old `paths` keys only after creating the
graph, then persists stable edge IDs. The migration is checked against legacy
visitor paths before the editor offers it. Version 3 publication checks graph
topology, field and consent ownership, submission boundaries, and goal-specific
required paths; a valid topology alone is not publishable. A field or consent
screen must appear on every path to its save point (*its **form**, in ADR 0134's words*). Branch-only contact fields
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
dragging, including changing priority, fallback and hidden exits. Route lists own
their layout through an explicit list class, so disclosure or visibility wrappers
cannot remove the card styling. Priority appears once; fallback remains
unnumbered. Shared native-control defaults must not override card controls. See
[Admin guidelines §21](../../tools/design-system/GUIDELINES.md#21-editor-cards-lists-and-disclosures).
Layout and
viewport metadata stay outside the visitor graph. The product-facing scale
limit will follow payload, loader and dense-map measurements rather than the
old seven-screen limit or a new arbitrary number.

Before Dagre, a conservative presentation pass identifies single-entry paths
that rejoin. One optional detour is stacked below its entry; competing paths
occupy priority-ordered lanes; the shared continuation appears once. Independent
matching follow-ups retain their own grouped semantics. Nested forks, outside
entries and unproven regions keep explicit graph layout. Measured card sizes
reserve each region's full bounds, including RTL mirroring. This never changes
stored edges, priority or visitor behavior. Dagre positions the remaining blocks. The lazy admin map
uses central orthogonal corridors for clear forward connections and React Flow
Smart Edge for obstructed/backward connections: long
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

### Capture presentation parity (September 26 audit)

Input screens may carry `review_answers: true` and a plain-text `details_note`
(up to 500 characters). These are additive presentation metadata. The optional
name shortcut creates a real owned field; it never creates another submission
or implies marketing consent. The review uses only previously visited screens
and active answers, so changing an earlier answer cannot expose an abandoned
branch. Live and test journeys share the same text-only review renderer.

After reusing the existing node walkers and simplifying DOM construction,
measured gzip-9 sizes are 13,953 / 24,473 / 25,430 / 25,687 bytes. The new
visitor review and details note exceed the prior paid caps by 153 / 86 / 87
bytes. Allocate 256 bytes per paid rung specifically for this formerly missing
prototype behavior: Basic 24,576, Pro 25,600, Elite 25,856 bytes. Free remains
14,012 bytes; payload and phone limits are unchanged. This is a documented
feature-cost amendment, not a claim that the old caps passed or a disabled gate.

# A split can reserve room for its form

The first three collection examples exposed a gap at 390px: a split's two
12rem panes stayed beside each other while padding left very narrow fields.
At 320px the same design stacked and became easier to use. Wrapping without
overflow was insufficient; the form needed usable space.

`split.basis` declares the minimum width of either pane before wrapping. The
manifest offers 12rem, 16rem and 20rem, with 12rem as the default. The editor
exposes these as **Minimum column width** using its existing layout controls.
Fieldwork and Callback notes use 16rem on both screens. Existing snapshots
without this parameter retain their original layout.

The renderer sets each pane's `flex-basis`, including the default. This
property does not inherit, so an outer split cannot silently change a nested
split's default. Ratio still divides the remaining space; both panes continue
to fill a wrapped line. Removing redundant default CSS and a second enumeration
of reset style bags, and using `append(string)` for plain text nodes, keeps the
addition within the existing loader budget. Text continues to be inserted as
text, never HTML.

This amends ADRs 0064 and 0065: a split may stack before the fixed 24rem
`narrow` appearance breakpoint. Column arrangement responds to the space its
contents need; narrow bags still retune typography and spacing below 24rem.
There is no additional style bag, viewport query or stored breakpoint.

A renderer regression test covers the parameter, default and nested splits.
The comparison page uses the shipping renderer and reports actual pane
positions, making 390px stacking and desktop side-by-side layout reviewable.

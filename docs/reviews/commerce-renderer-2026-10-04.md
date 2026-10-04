# Commerce renderer regression review — 2026-10-04

The new renderer seam supplies the Pro products leaf; dynamic product links use
one delegated conversion handler. Existing design, copy and theme sources are unchanged.

Built a baseline renderer from the branch base using `git archive HEAD` into a
disposable directory, with its own original renderer build entry. Built the current
renderer with the products preview registered. Ran
`node tools/design-library/build/compare-renderers.mjs BASELINE_RENDERER_PATH`.
All 122 current prepared campaign setups and all 241 screens/result variants
produce byte-identical markup; the full responsive shadow stylesheet is identical.
This covers the 18 setups referenced by the five shipped collections. It retains
their existing visual review evidence through a complete unchanged-output comparison,
rather than claiming a new manual inspection of every old design.

Baseline SHA-256: `98db80085e6a9e57bb85a64f7d53ae90cb63d5e8aef8d0bbbb1c4d300962b3cb`.
Current SHA-256 after the CI size fix: `db9fa1d0e5b156354db271a13399d20d695055fe8b2067006bd344e520d1cf63`.

All 3714 JavaScript tests pass, including the existing journey/navigation,
conversion, renderer and builder suites. A focused rerun cleared three timeouts
from an earlier overloaded parallel run; the final full run used two workers.
No old campaign navigation or input contract changes in this feature.

Real WordPress 7.1.2 + WooCommerce 11.1.2 checks pass for guest/logged-in sessions,
classic AJAX updates, isolated/empty carts, real Blocks quantity changes, and 320px
LTR/RTL layouts. Inspected the new cards on desktop beside actual Cart Blocks.
The new commerce screenshots are under `tools/visual-tests/out/commerce/`.
The shipping catalog has no changes to any of the 18 collection setups or designs.

The CI follow-up routes only unsupported leaf types through the optional renderer
and uses the delegated click target's optional `closest` method. Normal nodes
avoid the extension callback; dispatch always supplies a target and text targets
remain ignored. A regression checks late-inserted product links and unrelated/text
targets. The same full 241-screen markup/style comparison passes again. All eight
real-WooCommerce checks pass, including recommendation publication and checkout
default validation, and the final 320px screenshot was inspected again.

## Code review

Standards axis: no confirmed documented-standard violations. Two optional cleanup
findings remain: an explicit recommendation mode would be clearer than `max === 6`
in the selector, and cart ID validation could reuse the shared validator.

Spec axis: fixed the missing checkout default and the publication path accepting
unsupported variation recommendations. Explicit sample-basket simulation remains
unfinished and is now marked as such in the plan and ADR. A second review of the
fixes found no blocking defect. The checkout regression asserts prepared
targeting; actual order-confirmation request suppression is not directly tested.

Review decision: retain approval of those unchanged collection setups and refresh
their renderer-bound revision references. Other historical library review states
are not automatically rewritten. This is technical/editorial evidence, not merchant
usability research, sales attribution or release authorization.

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
Current SHA-256: `e8015c23f9fc23d39218e8fd9005dea7699adcf4940e7641736d4b0b5ef63ba8`.

All 3713 JavaScript tests pass, including the existing journey/navigation,
conversion, renderer and builder suites. A focused rerun cleared three timeouts
from an earlier overloaded parallel run; the final full run used two workers.
No old campaign navigation or input contract changes in this feature.

Real WordPress 7.1.2 + WooCommerce 11.1.2 checks pass for guest/logged-in sessions,
classic AJAX updates, isolated/empty carts, real Blocks quantity changes, and 320px
LTR/RTL layouts. Inspected the new cards on desktop beside actual Cart Blocks.
The new commerce screenshots are under `tools/visual-tests/out/commerce/`.
The shipping catalog has no changes to any of the 18 collection setups or designs.

Review decision: retain approval of those unchanged collection setups and refresh
their renderer-bound revision references. Other historical library review states
are not automatically rewritten. This is technical/editorial evidence, not merchant
usability research, sales attribution or release authorization.

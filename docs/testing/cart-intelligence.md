# Cart intelligence verification

Implementation: [ADR 0117](../adr/0117-cart-intelligence-uses-a-bounded-session-projection.md) and [ADR 0118](../adr/0118-sample-baskets-share-live-commerce-evaluation.md).

The isolated real-site fixture uses WordPress 7.1.2 and WooCommerce 11.1.2. It
mounts the working Free and Pro plugins, without installing WooCommerce into the
merchant's saved Local site. Playground runs against a disposable WordPress root.
The version originally selected for the spike (6.8.3) was rejected by this
WooCommerce release; it is not recorded as a successful compatibility test.

## Reproduce

Build with `npm run build`. Activate WooCommerce, WConvert and WConvert Pro in a
disposable WordPress, on `http://127.0.0.1:9431`. Mount
`tools/visual-tests/mu/commerce.php` as a must-use plugin **only in that disposable
site**. It creates products and campaigns and has a test-only login path.
Run `npm run test:visual:commerce`. Do not install the fixture in a saved site.

The fixture covers guest and logged-in session reads, classic AJAX add-to-cart,
isolated shoppers, a known empty cart, and the actual Woo Blocks cart-store
quantity update. It inspects card changes and request responses and captures the
final desktop, 320px LTR and 320px RTL output under
`tools/visual-tests/out/commerce/`. Screenshots are local test artifacts, not plugin
assets. Selected products without images render without a broken image placeholder.

`pro/tests/js/commerce-context.test.ts` covers one read for multiple subscribers,
reverse response order, immediate invalidation, expiry, malformed responses,
functional-consent withdrawal, hidden-page suppression and Blocks store changes.
`tests/unit/Pro/CartRecovery/CartRulesTest.php` covers variation/parent matching,
category ancestry, deleted references, negative rules, currency mismatch,
precision and inclusive bounds. Design transfer tests verify cleared product IDs,
reconfiguration notes and capability refusal on Free.

## Boundaries

This is selected product targeting and suggestion delivery. It has no cart write,
shipping-progress calculation, purchase attribution, revenue report or changed
quiz fallback. Suggestions use a selected shortlist or configured WooCommerce cross-sells. Public reporting continues to count clicks.

Core classic and Blocks mutation paths are exercised. Third-party carts or currency
switchers are not declared compatible. Unknown context does not match; carts that
emit no supported signal may take until the next 30-second or focus refresh.
The tests do not model every tax extension, subscription/bundle product, catalog
size, page-cache vendor or assistive technology.

Sample Visit now evaluates explicitly selected products/variations, quantities
and entered merchandise amounts with the live evaluator, including recommendation
exclusions. Non-cart conditions remain manual assumptions. It never changes a real
cart. The fixture covers unknown/blocked/empty baskets, category ancestry, currency
mismatch, variation-parent matching, authentication and malformed input.
`tests/js/commerce-sample.test.tsx` verifies current-draft requests and stale-response
rejection, including returning to previously tested inputs.

Five-merchant usability recruitment from the plan has not been performed and no
external invitations were sent. The code checks do not establish usability or
conversion uplift. Review that research separately before broad rollout.

## Core implementation results (PR 207)

- PHPUnit: 2516 tests, 15165 assertions passed; cart predicates rechecked after final input hardening.
- Vitest: 3714 tests across 205 files passed (two workers).
- Real WordPress browser suite: all eight checks passed, including authenticated editor product search, recommendation-type validation and checkout prefill exclusions.
- TypeScript, ESLint, PHPStan, source and template contracts passed.
- Free and Basic/Pro/Elite ZIPs built and passed artifact checks.
- Node 22 loader measurements: Free 14585, Basic 25088, Pro 26616, Elite 26999 bytes gzip; optional commerce asset 2921 bytes; combined Elite plus commerce 29920 bytes. All existing limits remain unchanged by the CI follow-up.
- Existing library regression: all 241 screens/result variants across 122 setups have identical markup and responsive styles to the base renderer. The 18 unchanged setups in five shipped collections had their renderer-bound reviews refreshed with recorded evidence.
- Visually inspected final desktop, 320px LTR/RTL cards and the authenticated editor's product selection panel.

## CI follow-up

The first GitHub run exceeded Basic/Pro caps by 3/1 bytes. Running Node 22
locally reproduced those exact failures; running the same artifacts through the
local Node 24 gzip implementation passed. This was compression-version variance,
not different generated JavaScript. Compacting the renderer dispatch and delegated
click handler passes the unchanged limits on Node 22. `.nvmrc` and README now
document the same Node major as CI and releases. The loader contract is the
regression test; no budget was relaxed.

A real-WooCommerce regression first failed because a published variation could
pass recommendation validation and then be discarded by the renderer. Publication,
the selector and delivery now agree on simple/variable parent products, while
cart conditions retain exact variation support. New accessory drafts resolve the
store's checkout page into an editable exclusion. The test covers the prefill
configuration, not an actual order-confirmation request.

## Sample basket and cross-sell follow-up (PR 208)

- All 11 real WordPress/WooCommerce browser checks passed, including an unsaved editor source change and explicit basket edits.
- The authenticated preview and live cross-sell tests filter draft/private and out-of-stock products, respect configured order and remove basket items. Variation samples also include their parent and its relationships.
- The preview accepts 40 authored cart rules plus one required goal rule, rejects 42, denies unauthenticated requests and leaves the shopper cart unchanged.
- PHPUnit: 2517 tests, 15179 assertions passed. Vitest full suite and focused async/gesture/manifest regressions passed; pending basket reads cannot replay exit intent.
- TypeScript, ESLint, PHPStan, template studio/collection checks and all four ZIP artifact builds passed. Node 22 visitor loader and commerce asset sizes are unchanged from the measurements above.
- Visually inspected the sample dialog and its recommendation cards, including 320px LTR/RTL layouts. The longer dialog scrolls while keeping the result and reset action visible.
- Both standards and spec reviews completed. Their publication-state and maximum-rule findings were fixed and checked again.

The first follow-up CI run exposed an existing quiz analytics test race: its
10-second event assertion expired just before the accepted capture response
arrived. Injecting an 11-second capture delay reproduced it. The test now waits
for HTTP 201 before checking analytics delivery; the same delayed response passes.
The temporary delay was removed. Product behavior and analytics assertions are unchanged.

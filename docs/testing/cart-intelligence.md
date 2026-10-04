# Cart intelligence verification

Implementation: [ADR 0117](../adr/0117-cart-intelligence-uses-a-bounded-session-projection.md).

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
shipping-progress calculation, purchase attribution, revenue report, cross-sell
source or changed quiz fallback. Public reporting continues to count clicks.

Core classic and Blocks mutation paths are exercised. Third-party carts or currency
switchers are not declared compatible. Unknown context does not match; carts that
emit no supported signal may take until the next 30-second or focus refresh.
The tests do not model every tax extension, subscription/bundle product, catalog
size, page-cache vendor or assistive technology.

Five-merchant usability recruitment from the plan has not been performed and no
external invitations were sent. The code checks do not establish usability or
conversion uplift. Review that research separately before broad rollout.

## Final local results

- PHPUnit: 2516 tests, 15165 assertions passed; cart predicates rechecked after final input hardening.
- Vitest: 3713 tests across 205 files passed (two workers).
- Real WordPress browser suite: all seven checks passed, including authenticated editor product search.
- TypeScript, ESLint, PHPStan, source and template contracts passed.
- Free and Basic/Pro/Elite ZIPs built and passed artifact checks.
- Top-rung loader: 27000 bytes gzip; optional commerce asset: 2926 bytes; combined 29926 bytes. Existing Free/lower-rung limits remain unchanged.
- Existing library regression: all 241 screens/result variants across 122 setups have identical markup and responsive styles to the base renderer. The 18 unchanged setups in five shipped collections had their renderer-bound reviews refreshed with recorded evidence.
- Visually inspected final desktop, 320px LTR/RTL cards and the authenticated editor's product selection panel.

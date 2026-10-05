# Quiz products share protected cart actions

Accepted 2026-10-05. Extends ADRs 0121–0123 following approval to add quiz cart
buttons, product reporting and self-directed release checks without waiting for
merchant recruitment.

## Visitor and merchant contract

Each result has **Product button → View product / Add to cart**, defaulting to
View product. Category/attribute selection and hand-picked products keep their
existing limits and result rules. Supported simple products can add one item;
variable products and products with extension-specific validation/cart data keep
product-page links. An empty basket is allowed. A variable-only result remains
useful; it does not inherit the standalone offer's `no_direct_add` suppression.
Empty/error states leave the result heading, message and fallback link intact.

Showing the quiz result remains its only headline Conversion. Accepted additions
increment the existing campaign `cart_addition` counter and `product:<id>` Added
counter, never a second Conversion. Visible product cards and explicit product
links reuse Product activity. Shown/Clicked count once per product for the whole
quiz mount, including Back/Forward or switching results. Counts are not people,
purchases, result popularity or proof of sales uplift. Sales attribution keeps
its existing optional consent and last-interaction rules.

The editor uses the shared select styles and a short explanation. Preview & test
shows current matches plus an explicitly simulated cart button; it does not call
cart endpoints or record activity. It demonstrates the action, not a pixel-exact
storefront product grid. Publication/readiness checks reject incomplete actions.

## Capability boundary

Ordinary quiz links and category filters remain in every paid journeys tier.
Direct actions and product-level tracking use the existing cart-recovery module
(internal Elite, the WConvert Pro package sold today), plus WooCommerce. The
shared journey presenter offers a result renderer extension. Only Elite registers
the commerce bridge; Free, Basic and Pro bundles carry no commerce marker.
Cart-action campaigns suspend when the module disappears, with their configuration
and history retained. Link-only quizzes can continue without product tracking.
Transfer retains the action, strips site-specific product/filter references, and
requires `quiz-product-actions:1` and the appropriate capability.

## Transport and lifecycle

The no-store `wconvert_quiz_products` endpoint resolves the published campaign,
revision, screen ID and result ID. It accepts no candidate product list, answers,
visitor identifier or success assertion. It is bounded and same-origin/rate
limited. Screen/result pairs must resolve uniquely. Category results reuse the
existing bounded Store API read; cards share Woo eligibility and price formatting
with standalone recommendations. Reading a named public result is not evidence
that a visitor completed the quiz.

`CartAddition` remains the only mutation path. The expiring session capability and
operation receipt now bind the result context as well as campaign/revision.
Before mutation the server re-resolves the published selection, live eligibility,
current price fingerprint and extension support. Existing origin, functional
consent, session lock, replay protection and unknown-outcome behavior remain.
Only explicit accepted Woo operations are counted. Browser timeouts never retry
mutations. Late outcomes survive navigation and prevent another activation of
the same product in that mount. The native cart refresh remains independent of
whether the result is still visible. Closing aborts card reads/observers, not an
already submitted mutation. No new table, column or index is introduced.

## Payload budget

Node 22.23.3 (the declared release runtime) measures Basic 25,353 B, Pro 26,933 B
and Elite 27,564 B gzip at level 9. Caps increase by 160 B for Basic/Pro to
25,376/26,944 and by 448 B for Elite to 27,616. Optional commerce is 6,045 B
against a 6,208 B cap, up from its 5,400 B cap. Combined checks use those limits.

The previous Free asset and this build are byte-identical (SHA-256
`661b4d907aa212960e27347a96d6b77e22985e3b4ff48357f8bfe4f99ddcbb20`). They both
measure 14,611 B with Node 22 and 14,572 B with the local Node 24 compressor.
The existing 14,592 cap therefore already failed under the release runtime.
Normalize it by 32 B to 14,624; no Free runtime feature or byte change is funded.
The paid limits above also use Node 22, not the smaller Node 24 measurements.

The commerce asset is imported when enhanced cards are reached (or existing
commerce rules need it), not for unrelated campaigns. Every result view cleans
up card reads and observers on navigation and closure; the dedicated navigation
regression caught and verified the closure fix.

Verification and remaining limits: [quiz release checks](../testing/quiz-cart-2026-10-05.md).

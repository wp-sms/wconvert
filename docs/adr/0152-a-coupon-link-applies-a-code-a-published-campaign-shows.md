# 0152: A coupon link applies a code a published campaign shows

Date: 2026-10-17. Status: accepted.
Amends [0025](0025-cart-recovery-captures-nothing.md),
[0119](0119-actionable-reports-use-local-evidence-and-order-provenance.md) and
[0124](0124-quiz-products-share-protected-cart-actions.md). Delivers #286.

A Black Friday bar shows `BF30`. The merchant wants a link beside it that lands
the visitor with BF30 already in their WooCommerce cart. ADR 0025 bans any write
into WooCommerce's coupons, and ADR 0124 makes `CartAddition` the only path that
changes a cart. This is a narrow exception to both.

## Decisions

**1. The `code` block gets an apply link, in free.** Two content keys,
`apply_label` ("Code link text") and `apply_href` ("Where the code link goes").
`apply_href` is validated by the same scheme check as a button's `href`, so a
relative URL is kept and `javascript:` is dropped. The renderer draws it as the
button anchor is, after the copy button, and draws nothing for an unsafe
address. The link shows whether or not copying is on. Free takes any address,
for example EDD's `?discount=`.

**2. Pro fills it for WooCommerce.** On a store, the panel's "Apply in
WooCommerce" sets `apply_href` to `?coupon=<code>`. The address is relative, so
it applies on the page the visitor is already on. The panel says so when the
link's code no longer matches the block's. Free's slot for this
(`codeLinkControls`) draws nothing, so free sells nothing (ADR 0116, 0147).

**3. Pro applies only a code a published campaign shows now.** On `wp_loaded`,
`CouponLink` reads `?coupon=`. It acts only when all of these hold:

- the code equals, without case, the text of a visible `code` block in a
  published, servable campaign whose schedule includes now;
- WooCommerce has a coupon with that code (`wc_get_coupon_id_by_code`);
- functional consent, by `CartAddition`'s rule;
- the cart does not already have it.

With items in the cart it applies the code. With an empty cart it keeps the
code in the WooCommerce session as `wconvert_pending_coupon` and applies it on
the first `woocommerce_add_to_cart`, asking all four questions again. Then it
redirects to the same address without the parameter, with `nocache_headers()`.

A code that fails any check leaves the request alone, parameter and all.
Nothing is stored and nothing is shown. A store's own coupon-URL plugin still
gets the parameter.

**4. It never mints, edits or prices a coupon.** It only calls `apply_coupon()`
on the visitor's own cart, with a code the merchant created and the campaign
already prints. The visitor gains nothing they could not type at checkout.

**Why not `CartAddition`'s POST and session token.** A link lands from an
email, a post or a chat, with no page of ours before it to hand out a token.
"Only codes we advertise" is the guard instead. A link copied out of an ended
campaign stops working when the campaign's window closes.

**5. The scan allows `apply_coupon` in exactly one file.**
`NoWriteIntoWooCommerceTest` exempts `pro/modules/cart-recovery/src/CouponLink.php`
for that one token. Every other banned write stays banned there too.

## Payload budget

The link costs the free loader 44 B gzip-9 on Node 22, which is the runtime CI
measures: 14,712 B before, 14,756 B after. The free budget rises by 48 B, from
14,720 B to 14,768 B. Pro's 27,692 B stays inside its 27,712 B.

## Caveat

A full-page cache that caches URLs with query strings answers before PHP runs,
so the code is not applied. Most page caches skip query strings by default.

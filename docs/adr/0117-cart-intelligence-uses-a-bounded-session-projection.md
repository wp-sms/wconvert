# Cart intelligence uses a bounded session projection

Accepted 2026-10-04. Implements the first release of the [cart intelligence plan](../plans/cart-product-intelligence-2026-10-04.md).

## Matching and transport

Pro adds cart products and categories (any, all, none), inclusive quantity ranges,
and merchandise amount ranges after discounts, excluding shipping and tax.
Product parents match any of their variations; an explicit variation matches only
itself. Category descendants are an explicit choice. Money carries its store
currency and precision. Deleted references, a changed currency, and unknown,
pending, expired or consent-blocked carts never match, including negative rules.
A known empty cart can satisfy contains-none; accessory campaigns independently
require a nonempty cart and at least one eligible suggestion.

A WooCommerce AJAX POST reads the existing shopper session for both guests and
logged-in customers. This replaces the proposed public REST transport: WP REST
cookie authentication without a nonce is unsuitable for a cached public page.
The browser sends only published campaign IDs and their revision hashes. The
server derives predicates from the published definitions; arbitrary browser rules
are never evaluated. Responses contain booleans and public product cards, never
cart contents, contact details, customer IDs or the WooCommerce session key.

The endpoint requires same-origin browser requests, functional consent where the
WP Consent API exists, at most 20 campaigns / 4096 request bytes, and the existing
300-per-minute hashed-IP limiter in a separate commerce bucket. Responses are
private/no-store. Product/category lookups for authoring use authenticated,
capability-checked REST, capped at 20 results. No tables or columns are added.

One document-local service coalesces reads across rule evaluators and cards.
Facts expire after 30 seconds, clear immediately on observed mutation or consent
change, and never survive navigation. Requests time out after eight seconds;
failed reads retry at the freshness interval while a visible page needs them.
Hidden tabs do not poll. Generation checks discard late replies. Classic cart
completion events and the Woo Blocks cart store invalidate the projection.
An exit or click while facts are pending is not replayed when a request completes.
Third-party carts that emit neither supported events nor store updates are only
covered by the freshness/focus refresh; compatibility is not asserted for them.

Legacy count/total-only campaigns retain their cookie path. In a richer campaign,
those existing predicates use the same prepared projection as its new rules.
There is no new persistent visitor identifier, saved cart or order attribution.
The existing hashed-IP transient counters expire after 60 seconds.

## Selected product suggestions

One products block belongs to one click-only content screen. It cannot coexist
with a form, unrelated link button, Results screen or graph. Merchants choose at
most six parent/simple products in priority order; up to three currently visible,
in-stock, purchasable, non-password-protected products are shown. Already-present
products are excluded by default. No automatic compatibility inference is made.
Links go to product pages, including “Choose options” for variable products.
The normal once-per-mounted-campaign conversion counts a click, never a purchase.
If suggestions become unavailable while visible, neutral status replaces them;
focus remains within the refreshed block if the focused link was removed.

Two starts offer selected accessories and shopping guidance. They contain no
site-local IDs or currency thresholds. Publication requires real selections.
Exports clear product IDs and note the required setup. Imports/packs require the
commerce capability and reject embedded local product references. Losing Pro or
WooCommerce suspends the campaign rather than dropping its requirements. Existing
quiz result/fallback behavior is unchanged.

## Assets and verification

The optional commerce ES module has a 3276-byte gzip cap and loads only for
relevant campaigns. The paid top-rung loader cap increases explicitly by 128 bytes,
from 26880 to 27008, for the small import/evaluator bridge and renderer seam.
Free and the lower rung caps are unchanged. `check-commerce.mjs` checks both the
asset and combined cost; source/artifact checks keep the bridge and asset out of
lower editions. The module is packaged with its owning cart-recovery directory.

The [verification record](../testing/cart-intelligence.md) records actual unit,
real-site, browser and visual checks. Merchant recruitment remains a separate,
unperformed research task; technical checks do not establish usability or uplift.
Shipping progress, Woo cross-sell sourcing, direct add-to-cart and order attribution
remain later increments, without controls or claims in this release.

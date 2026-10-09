# Recommendation additions count server-accepted cart actions

Accepted 2026-10-05. Implements the next slice of the [recommendations plan](../plans/product-recommendations-2026-10-05.md).

## Outcome and history

`Increase basket value` is an Elite, WooCommerce-dependent Goal. Its headline,
**Basket additions**, counts mounted campaign appearances with at least one
accepted addition. `cart_addition` is a closed StatKind in the existing daily
aggregate table and counts every accepted quantity-one operation. There is no
schema migration, Lead, contact, purchase or revenue claim.
**Extended by [ADR 0122](0122-product-activity-uses-retained-anonymous-dimensions.md):**
accepted additions now also increment a separate retained `product:<id>` scope.
Anonymous visible-card and product-link activity share those product dimensions;
the campaign headline and empty-scope addition count stay unchanged.
Dashboard impact groups and CSV keep additions separate from product-link clicks.
**Extended by [ADR 0124](0124-quiz-products-share-protected-cart-actions.md):**
quiz results may use this protected transport. Their additions are supporting
activity; quiz completion remains the only headline Conversion. Tokens and
receipts additionally bind the result context.
An old link campaign retains its Goal, action and history; the new playbook and
design create a separate campaign. Existing publication/AB history guards apply.

## Explicit, narrowly supported mutation

Amends ADR 0025's blanket cart-write prohibition for one transport only:
`CartAddition`. A shopper's explicit button activation requests one public,
visible, purchasable, in-stock simple product from the current published
recommendation selection. The server checks campaign revision, dependency,
product/page-or-basket context, exclusion, source and current price fingerprint.
It never accepts a client amount, quantity, arbitrary product or success claim.

The adapter uses WooCommerce's public `WC_Cart::add_to_cart`, standard validation,
calculation and session persistence. Unlike the spike's raw Store API POST, this
owned Woo AJAX transport can bind server counting and replay claims to the same
operation without relying on an internal acceptance hook. It invokes the native
password-product validation. Additional cart-data/validation filters, subclasses,
variable and other product types fall back to product pages. This is deliberately
conservative: one unknown validation extension can disable direct additions for
the store. Compatibility adapters and extension-owned options remain later work.
An addition campaign needs a supported candidate to publish, and no new appearance
is shown when the actual three-card selection has no direct-add candidate.

## Protection, replay and counting

Both endpoints require same-origin POST, functional consent when provided by the
WP Consent API, bounded input and rate limiting. Fresh protection is obtained on
activation, never embedded in cached page markup. An HMAC capability is bound to
the Woo session, campaign, published revision, mounted appearance and a 30-minute
expiry. Nothing automatically retries a mutation.

Short-lived, non-autoloaded WP options provide atomic operation, session-lock and
headline claims. Keys contain salted/session-derived hashes, not raw identities;
receipts hold only product ID and state. One WP-Cron cleanup is scheduled per
claim for expiry plus one minute; delayed cron delays deletion, never validation.
An interrupted lock refuses further WConvert additions until cleanup. Claims are
not a global transaction lock for another plugin's simultaneous Woo requests.

An accepted receipt can be replayed without adding/counting again. Pending or
interrupted operations remain unknown. Claims precede writes: a storage/process
failure can undercount, never justify a retry or an exactly-once-delivery claim.
Woo session persistence precedes counting. The first headline claim increments
Conversion; each accepted operation increments CartAddition. Public beacons
cannot assert either addition result. Browser confirmation only updates local
frequency/analytics observation, with conversion beacon reporting suppressed.
A lost response remains unknown in the browser even if the server counted it.

Optional order attribution observes the server-accepted action under the existing
setting and explicit statistics consent. Supporting product/basket links do not
establish addition credit. Attribution failure cannot repeat or undo a cart action.

## Interaction and native cart

Buttons show Adding, Added, rejection or an explicit check-your-basket state.
Repeated activation is blocked; quantity is always one. Successful/unknown cards
stay in the current appearance so keyboard focus and the confirmation remain
available. New appearances use fresh exclusion rules. This intentionally refines
the plan's remove/replace-after-success wording in favour of stable focus.

Classic widgets refresh through `wc_fragment_refresh`; React Blocks invalidate
the cart store. WooCommerce's newer interactivity mini-cart uses its existing
`wc-blocks_store_sync_required` bridge, as exercised with 11.1.2. That bridge is a
version-sensitive compatibility seam and must be rechecked with Woo upgrades;
we do not unlock or mutate its private store. The adapter does not fire the
added-to-cart DOM event that can open a drawer. Native removals/quantity changes
also invalidate recommendation context through the sync bridge.

The optional commerce bundle cap rises from 3276 to 4800 gzip bytes for protection,
feedback and refresh. Shared renderer/server-counting notification raises Pro and
Elite caps by 32 bytes (26656/27040). This change left Free and Basic budgets unchanged. [ADR 0123](0123-quiz-results-select-products-by-category-and-attributes.md) later adds 128 bytes to each paid cap for filtered quiz product reads; Free remains unchanged. Source
and artifact boundaries still exclude commerce from unsupported editions.

## Evidence and limits

See [addition verification](../testing/recommendation-additions-2026-10-05.md).
Local technical verification is not evidence of merchant usability or sales lift.
Third-party drawers, extension options, actual cache proxies, production load and
concurrent mutations made by unrelated plugins require separate compatibility work.

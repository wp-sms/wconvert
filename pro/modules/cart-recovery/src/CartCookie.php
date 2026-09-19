<?php

namespace WConvert\Pro\Module\CartRecovery;

defined('ABSPATH') || exit;

/**
 * =============================================================================
 * THE WHOLE OF WCONVERT'S COUPLING TO WOOCOMMERCE: ONE COOKIE, WRITTEN ON
 * `woocommerce_cart_updated`, READ TWICE IN THE BROWSER.
 * =============================================================================
 * Two [[Condition]]s need to know about the visitor's cart, and both are
 * evaluated **in the browser at the instant a [[Trigger]] fires** (CONTEXT.md,
 * Condition). So the answer has to already be on the device: a rule that had
 * to ask the server would make the rule engine asynchronous, and "all
 * Conditions hold at the instant a Trigger fires" would stop being something
 * the engine can state.
 *
 * **And it cannot be an [[Engagement]].** A Condition is evaluated in a
 * browser that knows of no visitor identity, so *"has an open cart"* cannot be
 * asked of a person — where WConvert needs cart state it observes the cart
 * itself (CONTEXT.md, Engagement). This is that observation, made once per
 * cart change on the server and handed to the device.
 *
 * =============================================================================
 * SCOPE: TWO NUMBERS. NEVER CONTENTS.
 * =============================================================================
 * `<count>:<total>` and nothing else — no product ids, no SKUs, no names, no
 * prices per line. The cap is deliberate and is what makes cart-*contents*
 * Conditions a later, ADDITIVE decision rather than a re-litigation of this
 * one: a cookie already carrying what a visitor is shopping for would have
 * settled that question by accident, in the direction nobody argued for.
 *
 * The count is there because **the count is what the Optin's copy asserts**.
 * *"You left 3 items in your cart"* is the sentence ADR 0027 is built around,
 * and a Condition guaranteeing it has to be able to see a number of items —
 * a rule named `cart_has_items` answered from the total alone would report
 * "empty" about a fully-discounted cart that has three things in it.
 *
 * =============================================================================
 * `functional`, AND IT IS A JUDGEMENT CALL RATHER THAN AN OBVIOUS READING.
 * =============================================================================
 * Both Conditions declare `functional` on the rule manifest, which under the
 * WP Consent API is never withheld. The honest case for it: this records
 * something the visitor themselves did on this site, in this session, to
 * operate a feature of the site — it is not read across sites, it names
 * nothing about who they are, and it is discarded when their cart empties.
 *
 * The case against is real and was weighed: cart recovery is marketing in
 * intent, and a purist reading files anything serving a marketing outcome
 * under `marketing`. That reading **silently kills the [[Goal]] across the
 * EU** — the category is withheld by default under every consent plugin worth
 * having, so the merchant would buy [[Pro]], build the Optin, and watch it
 * never show, with nothing in any log. Booked as a judgement call rather than
 * as an obvious answer, and recorded here so the next person to ask finds the
 * argument rather than the conclusion.
 *
 * =============================================================================
 * IT LIVES IN PRO, WHICH IS WHERE ITS READERS LIVE.
 * =============================================================================
 * Nothing is written before its subject (ADR 0029). Both cart Conditions are
 * `tier: pro`, so free's loader has no module for either and a free install
 * would be writing to every shopper's device for nothing at all. The writer
 * belongs on the side that can read it.
 *
 * @since 0.1.0
 */
final class CartCookie
{
    /**
     * Not prefixed `wp_` and not named for the plugin's slug alone: it has to
     * be legible in a browser's storage inspector, because a merchant asked
     * "what does this plugin store" by their DPO is the person who will look.
     */
    public const NAME = 'wconvert_cart';

    /**
     * Add this module's browser record to free's privacy Data Map.
     *
     * @param array<string, mixed> $browser
     * @return array<string, mixed>
     */
    public static function privacy(array $browser): array
    {
        $browser['cart_recovery'] = [
            'key' => self::NAME,
            'expires_with_cart_session' => true,
            'contains_item_count' => true,
            'contains_cart_total' => true,
            'contains_contact_details' => false,
        ];

        return $browser;
    }

    /**
     * WooCommerce's own session default, in seconds.
     *
     * Only ever used as the FALLBACK argument to WooCommerce's own filter, so
     * a site that shortens its cart session shortens this with it. A cookie
     * outliving the cart it describes would tell the loader about a cart the
     * server has already forgotten; one expiring first is worse in the
     * direction that matters here — the returning shopper with a full cart is
     * the entire visitor this Goal exists for.
     */
    private const SESSION_FALLBACK = 172800;

    /**
     * What this request has already put on the wire, or null before it has put
     * anything.
     *
     * **The cart is recalculated more than once in a single request** — the
     * cart page does it, and a coupon change does it again — so the hooks
     * below fire repeatedly and each firing would otherwise append another
     * identical `Set-Cookie`. Harmless to a browser, which takes the last one,
     * and not harmless to a page cache that varies on `Set-Cookie`: a response
     * carrying three of them looks like three decisions.
     *
     * WooCommerce solves the same problem for its own cookies by sweeping
     * `headers_list()` afterwards (`WC_Cart_Session::dedupe_cookies()`). Not
     * writing twice is cheaper than removing the second one, and it needs no
     * knowledge of what else is on the response.
     *
     * An empty string is the CLEARED state, distinct from `null`: a request
     * that cleared the cookie and would then clear it again is the case the
     * seed-then-add flow produces.
     */
    private ?string $written = null;

    public function hooks(): void
    {
        /*
         * `woocommerce_cart_updated` fires from `WC_Cart_Session::set_session()`,
         * which WooCommerce hooks to `woocommerce_after_calculate_totals`. So
         * it fires on add, remove, quantity change and coupon change — every
         * way a shopper edits a cart that still exists afterwards.
         *
         * It is deliberately NOT `wp` or `shutdown`, which is where
         * WooCommerce refreshes its own cart cookies. Those fire on every
         * request; this one fires when the thing it describes actually
         * changed, and the cookie's lifetime carries it across the page views
         * in between.
         */
        add_action('woocommerce_cart_updated', [$this, 'refresh']);

        /*
         * AND THE ONE WAY A CART GOES THAT `woocommerce_cart_updated` DOES NOT
         * COVER — WHICH IS THE MOST IMPORTANT ONE.
         *
         * `WC_Cart::empty_cart()` clears the contents and fires
         * `woocommerce_cart_emptied`. It does NOT call `calculate_totals()`,
         * so `set_session()` never runs and `woocommerce_cart_updated` never
         * fires. Removing the last item by hand goes the other way and is
         * covered; `empty_cart()` is what a **completed checkout** calls.
         *
         * Left to the hook above, a shopper who has just paid keeps a cookie
         * saying they have three items waiting — and the Optin tells them so
         * on the order-received page. That is the lying popup ADR 0027 exists
         * to prevent, reached by buying something, and it is exactly the class
         * of bug a green test suite walks past: it was found by watching the
         * `Set-Cookie` headers on a real WordPress.
         *
         * The same callback serves both, because the question it asks —
         * "what is in the cart now" — has the same answer either way: nothing,
         * so clear.
         */
        add_action('woocommerce_cart_emptied', [$this, 'refresh']);
    }

    /**
     * Put this visitor's cart on their device, or take it off.
     *
     * **No write into WooCommerce's data** — not a `shop_coupon`, not an
     * order meta, not a session key of ours in their session (ADR 0024,
     * ADR 0025). This reads WooCommerce and writes a cookie, and that is the
     * entire traffic between the two.
     */
    public function refresh(): void
    {
        // Headers already sent means there is no Set-Cookie to add. WooCommerce
        // takes the identical posture in `maybe_set_cart_cookies()`, and it is
        // the right one: the cart is still in the visitor's session, so the
        // next request that touches it writes what this one could not. Guarded
        // here rather than left to `wc_setcookie()`, which under `WP_DEBUG`
        // raises an E_USER_NOTICE naming WConvert for a case that is normal.
        if (headers_sent() || !function_exists('WC') || !function_exists('wc_setcookie')) {
            return;
        }

        $cart = WC()->cart;

        // No cart on this request — an admin screen, a REST call, a cron run.
        // Nothing to say, so nothing is said: clearing here would delete a
        // live shopper's cookie from a request that never saw their cart.
        if ($cart === null) {
            return;
        }

        $value = self::valueFor((int) $cart->get_cart_contents_count(), (float) $cart->get_total('edit'));

        // Already said, on this request. Saying it again is a second
        // `Set-Cookie` with the same content.
        if ($this->written === ($value ?? '')) {
            return;
        }

        $this->written = $value ?? '';

        if ($value === null) {
            self::clear();

            return;
        }

        wc_setcookie(
            self::NAME,
            $value,
            time() + self::lifetime(),
            is_ssl(),
            // Explicitly NOT HttpOnly. The whole purpose is that the loader
            // can read it, and a cookie the browser hides from scripts would
            // be a cookie with no reader at all.
            false
        );
    }

    /**
     * What the cookie says about a cart of this size and value — or **null for
     * a cart with nothing in it**, which is the instruction to clear.
     *
     * Pure, and separated from the reads above for the reason
     * {@see \WConvert\Template\PolicyLink} is: the shape of what goes on the
     * device is the part worth pinning in a test, and the unit suite has no
     * WooCommerce to stand up.
     *
     * The total is formatted with explicit separators rather than through
     * `number_format`'s locale-sensitive defaults or WooCommerce's own price
     * formatting: the reader is `Number()` in a browser, which wants
     * `"45.00"` and cannot parse `"1.234,56"` or `"£45.00"`. Two decimals for
     * every currency, including the zero-decimal ones — a trailing `.00` costs
     * three bytes and one format means one parser.
     */
    public static function valueFor(int $count, float $total): ?string
    {
        if ($count < 1) {
            return null;
        }

        // A negative total is not a cart worth anything, and a rule reading
        // `>= 0` against one would hold for every threshold a merchant could
        // set. Floored rather than refused: the cart still HAS items, so
        // `cart_has_items` must still be true.
        return $count . ':' . number_format(max($total, 0.0), 2, '.', '');
    }

    /**
     * Take it off the device.
     *
     * Only where there is one to take off, which mirrors WooCommerce's own
     * `maybe_set_cart_cookies()`: a `Set-Cookie` header on every request for
     * every visitor who has never had a cart is bytes spent to delete
     * something that was never there — and it defeats a page cache that
     * varies on `Set-Cookie`.
     */
    private static function clear(): void
    {
        if (!isset($_COOKIE[self::NAME])) {
            return;
        }

        wc_setcookie(self::NAME, '', time() - YEAR_IN_SECONDS, is_ssl(), false);
    }

    /**
     * How long the cookie lives, taken from WooCommerce's own session filter.
     *
     * Read through `wc_session_expiration` rather than hard-coded, so the two
     * cannot drift: `WC_Session_Handler` derives its own session length from
     * exactly this filter with exactly this default, and a site that shortened
     * one and not the other would have a cookie describing a cart its server
     * had already dropped.
     */
    private static function lifetime(): int
    {
        /** @var mixed $seconds */
        $seconds = apply_filters('wc_session_expiration', self::SESSION_FALLBACK);

        return is_numeric($seconds) && (int) $seconds > 0 ? (int) $seconds : self::SESSION_FALLBACK;
    }
}

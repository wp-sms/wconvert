<?php

namespace WConvert\Tests\Unit\Pro\WooCommerce;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WC_Cart;
use WConvert\Pro\Module\CartRecovery\CartCookie;

/**
 * =============================================================================
 * WRITTEN ON UPDATE. VALUE-ONLY. NEVER INTO WOOCOMMERCE'S OWN DATA.
 * =============================================================================
 * The whole of WConvert's coupling to WooCommerce is this cookie, and each of
 * those three claims is a decision somebody could quietly undo:
 *
 * - **On update**, because a [[Condition]] is evaluated in the browser at the
 *   instant a [[Trigger]] fires, so the answer has to already be on the device
 *   (CONTEXT.md, Condition). A writer hooked somewhere else would either miss
 *   changes or run on every request.
 * - **Value-only** — a count and a total, never contents. The cap is what
 *   makes cart-*contents* Conditions a later, additive decision rather than
 *   one this cookie settled by accident.
 * - **No write into WooCommerce's data**, which
 *   {@see \WConvert\Tests\Unit\Pro\WooCommerce\NoWriteIntoWooCommerceTest}
 *   asserts over the source, because no assertion about output can see a rule
 *   that is currently being kept.
 */
#[CoversClass(CartCookie::class)]
final class CartCookieTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestCookies'] = [];
        $GLOBALS['wconvertTestActions'] = [];
        $GLOBALS['wconvertTestFilters'] = [];
        $GLOBALS['wconvertTestCart'] = null;
        $GLOBALS['wconvertTestCartCount'] = 0;
        $GLOBALS['wconvertTestCartTotal'] = 0.0;

        unset($_COOKIE[CartCookie::NAME]);
    }

    protected function tearDown(): void
    {
        unset($_COOKIE[CartCookie::NAME], $GLOBALS['wconvertTestCart']);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function written(): array
    {
        /** @var list<array<string, mixed>> $cookies */
        $cookies = $GLOBALS['wconvertTestCookies'];

        return $cookies;
    }

    private static function withCart(int $count, float $total): void
    {
        $GLOBALS['wconvertTestCartCount'] = $count;
        $GLOBALS['wconvertTestCartTotal'] = $total;
        $GLOBALS['wconvertTestCart'] = new WC_Cart();
    }

    // ========================================================================
    // THE SHAPE.
    // ========================================================================

    /**
     * Two numbers, one separator, and nothing that could identify a shopper or
     * say what they are shopping for.
     */
    public function testTheCookieIsACountAndATotalAndNothingElse(): void
    {
        $this->assertSame('3:45.00', CartCookie::valueFor(3, 45.0));
        $this->assertSame('1:9.99', CartCookie::valueFor(1, 9.99));
    }

    /**
     * **Two decimals for every currency**, formatted with explicit separators.
     * The reader is `Number()` in a browser: it wants `"1234.50"` and cannot
     * parse `"1,234.50"` or `"1.234,50"`, and a server whose locale decided
     * which of those it got would produce a rule that holds in one country and
     * not another.
     */
    public function testTheTotalIsFormattedForABrowserAndNotForAHuman(): void
    {
        $this->assertSame('2:1234.50', CartCookie::valueFor(2, 1234.5));
        $this->assertSame('2:1234.00', CartCookie::valueFor(2, 1234.0));
    }

    /** An empty cart says nothing — the instruction to clear, not a value. */
    public function testAnEmptyCartHasNoValueToWrite(): void
    {
        $this->assertNull(CartCookie::valueFor(0, 0.0));
        $this->assertNull(CartCookie::valueFor(-1, 10.0));
    }

    /**
     * A cart with items and no value still HAS items, so `cart_has_items` must
     * still hold. The total is floored rather than the cookie refused: a
     * negative would make `cart_value_min` true for every threshold a merchant
     * could set.
     */
    public function testAFullyDiscountedCartStillCountsAsAFullOne(): void
    {
        $this->assertSame('3:0.00', CartCookie::valueFor(3, 0.0));
        $this->assertSame('3:0.00', CartCookie::valueFor(3, -12.0));
    }

    // ========================================================================
    // WHEN IT IS WRITTEN.
    // ========================================================================

    /**
     * **Two hooks, and no others.** `woocommerce_cart_updated` covers every
     * way a shopper edits a cart that still exists afterwards;
     * `woocommerce_cart_emptied` covers the one way it does not.
     *
     * Not `wp` or `shutdown`, which is where WooCommerce refreshes its own
     * cart cookies: those fire on every request, and this writes when the
     * thing it describes actually changed.
     */
    public function testItWritesWhenTheCartChangesAndAtNoOtherMoment(): void
    {
        (new CartCookie())->hooks();

        $this->assertSame(
            ['woocommerce_cart_updated', 'woocommerce_cart_emptied'],
            array_keys($GLOBALS['wconvertTestActions'])
        );
    }

    /**
     * ====================================================================
     * A COMPLETED CHECKOUT TAKES THE COOKIE WITH IT.
     * ====================================================================
     * **`WC_Cart::empty_cart()` does not fire `woocommerce_cart_updated`.** It
     * clears the contents and fires `woocommerce_cart_emptied`, and never
     * calls `calculate_totals()` — so `set_session()` never runs. Removing the
     * last item by hand goes the other way and is covered; `empty_cart()` is
     * what a completed checkout calls.
     *
     * Missed, the shopper who has just paid keeps a cookie saying three items
     * are waiting, and the Optin tells them so on the order-received page —
     * ADR 0027's lying popup, reached by buying something. Found by watching
     * the real `Set-Cookie` headers on a real WordPress, which is the kind of
     * thing a green suite walks straight past.
     */
    public function testAFinishedCheckoutTakesTheCookieOffTheDevice(): void
    {
        $_COOKIE[CartCookie::NAME] = '3:135.00';
        self::withCart(0, 0.0);

        (new CartCookie())->hooks();
        do_action('woocommerce_cart_emptied', true);

        $this->assertCount(1, self::written());
        $this->assertSame('', self::written()[0]['value']);
        $this->assertLessThan(time(), self::written()[0]['expire']);
    }

    public function testAChangedCartLandsOnTheDevice(): void
    {
        self::withCart(2, 30.0);

        (new CartCookie())->hooks();
        do_action('woocommerce_cart_updated');

        $this->assertCount(1, self::written());
        $this->assertSame(CartCookie::NAME, self::written()[0]['name']);
        $this->assertSame('2:30.00', self::written()[0]['value']);
    }

    /**
     * **Not HttpOnly**, and that is the whole point: the loader reads it. A
     * cookie the browser hid from scripts would be a cookie with no reader.
     */
    public function testTheLoaderCanActuallyReadIt(): void
    {
        self::withCart(1, 5.0);

        (new CartCookie())->hooks();
        do_action('woocommerce_cart_updated');

        $this->assertFalse(self::written()[0]['httponly']);
    }

    /**
     * **It outlives the page view**, or the shopper who comes back tomorrow
     * with a full cart — the entire visitor this [[Goal]] exists for — would
     * arrive with nothing on their device.
     */
    public function testItOutlivesThePageViewByAsLongAsTheCartDoes(): void
    {
        self::withCart(1, 5.0);

        (new CartCookie())->hooks();
        do_action('woocommerce_cart_updated');

        $this->assertGreaterThan(time() + 3600, self::written()[0]['expire']);
    }

    /**
     * **The lifetime is WooCommerce's, taken through WooCommerce's own
     * filter**, so a site that shortens its cart session shortens this with
     * it. A cookie outliving the cart it describes would tell the loader about
     * a cart the server has already forgotten.
     */
    public function testTheLifetimeFollowsTheStoresOwnSessionSetting(): void
    {
        add_filter('wc_session_expiration', static fn (): int => 600);
        self::withCart(1, 5.0);

        (new CartCookie())->hooks();
        do_action('woocommerce_cart_updated');

        $this->assertLessThanOrEqual(time() + 600, self::written()[0]['expire']);
        $this->assertGreaterThan(time() + 500, self::written()[0]['expire']);
    }

    /** A filter answering nonsense falls back rather than expiring instantly. */
    public function testANonsenseSessionSettingFallsBackRatherThanExpiringAtOnce(): void
    {
        add_filter('wc_session_expiration', static fn (): string => 'soon');
        self::withCart(1, 5.0);

        (new CartCookie())->hooks();
        do_action('woocommerce_cart_updated');

        $this->assertGreaterThan(time() + 3600, self::written()[0]['expire']);
    }

    // ========================================================================
    // AND WHEN IT IS TAKEN AWAY.
    // ========================================================================

    /**
     * An emptied cart clears the cookie rather than writing a zero, so the
     * device stops holding a record of a cart that no longer exists.
     */
    public function testEmptyingTheCartTakesTheCookieOffTheDevice(): void
    {
        $_COOKIE[CartCookie::NAME] = '3:45.00';
        self::withCart(0, 0.0);

        (new CartCookie())->hooks();
        do_action('woocommerce_cart_updated');

        $this->assertCount(1, self::written());
        $this->assertSame('', self::written()[0]['value']);
        $this->assertLessThan(time(), self::written()[0]['expire']);
    }

    /**
     * **A visitor who never had a cart is never sent a header.** Deleting
     * something that was never there spends bytes on every request and defeats
     * a page cache that varies on `Set-Cookie` — which is WooCommerce's own
     * posture in `maybe_set_cart_cookies()`.
     */
    public function testAVisitorWithNoCartAndNoCookieIsLeftAlone(): void
    {
        self::withCart(0, 0.0);

        (new CartCookie())->hooks();
        do_action('woocommerce_cart_updated');

        $this->assertSame([], self::written());
    }

    /**
     * **One `Set-Cookie` per request, however often the cart is recalculated.**
     * The cart page recalculates, and a coupon change recalculates again, so
     * these hooks fire repeatedly — and a response carrying three identical
     * headers looks like three decisions to a page cache that varies on
     * `Set-Cookie`. WooCommerce sweeps `headers_list()` afterwards for its own
     * cookies; not writing twice is cheaper and needs to know nothing about
     * what else is on the response.
     */
    public function testRecalculatingTheSameCartTwiceWritesOneHeader(): void
    {
        self::withCart(2, 30.0);

        (new CartCookie())->hooks();
        do_action('woocommerce_cart_updated');
        do_action('woocommerce_cart_updated');

        $this->assertCount(1, self::written());
    }

    /** And a cart that genuinely changed is written again. */
    public function testACartThatChangedIsWrittenAgain(): void
    {
        self::withCart(2, 30.0);

        (new CartCookie())->hooks();
        do_action('woocommerce_cart_updated');

        self::withCart(3, 45.0);
        do_action('woocommerce_cart_updated');

        $this->assertSame(['2:30.00', '3:45.00'], array_column(self::written(), 'value'));
    }

    /** The same holds for clearing: emptied twice is one header. */
    public function testEmptyingTwiceTakesItOffOnce(): void
    {
        $_COOKIE[CartCookie::NAME] = '3:45.00';
        self::withCart(0, 0.0);

        (new CartCookie())->hooks();
        do_action('woocommerce_cart_emptied', true);
        do_action('woocommerce_cart_updated');

        $this->assertCount(1, self::written());
    }

    /**
     * **A request with no cart says nothing at all.** An admin screen, a cron
     * run or a REST call never loaded one, and clearing there would delete a
     * live shopper's cookie from a request that never saw their cart.
     */
    public function testARequestThatNeverLoadedACartClearsNothing(): void
    {
        $_COOKIE[CartCookie::NAME] = '3:45.00';
        $GLOBALS['wconvertTestCart'] = null;

        (new CartCookie())->hooks();
        do_action('woocommerce_cart_updated');

        $this->assertSame([], self::written());
    }
}

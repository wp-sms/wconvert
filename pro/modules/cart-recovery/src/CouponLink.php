<?php
namespace WConvert\Pro\Module\CartRecovery;

use WConvert\Optin\PublishedOptin;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\Degradation;
use WConvert\Template\TemplateTree;

defined('ABSPATH') || exit;

/**
 * `?coupon=CODE`: a campaign's coupon link lands the visitor with the code in
 * their WooCommerce cart (ADR 0152).
 *
 * The one exception to ADR 0025's "no write into WooCommerce" for coupons, and
 * it is narrow on purpose. It applies an EXISTING coupon to the visitor's OWN
 * cart, and only a code that a published campaign is showing right now. It
 * never creates, edits or prices a coupon. So the link can be shared anywhere
 * and still gives a visitor nothing they could not type at checkout from the
 * campaign itself.
 *
 * Why not `CartAddition`'s POST and session token: a link is a URL that lands
 * from an email, a post or a chat, with no page of ours before it to hand out
 * a token. "Only codes we advertise" is the guard instead.
 *
 * A code we do not advertise leaves the request alone, parameter and all, so a
 * store's own coupon-URL plugin still gets it.
 */
final class CouponLink
{
    /** A code waiting for the cart to have something in it. */
    public const PENDING = 'wconvert_pending_coupon';

    private const PARAM = 'coupon';

    public function __construct(
        private readonly PublishedSet $published,
        private readonly Degradation $degradation,
    ) {
    }

    public function hooks(): void
    {
        // After WooCommerce has loaded the cart and session, and beside the
        // analytics session cleanup that runs here too.
        add_action('wp_loaded', [$this, 'arrive'], 40);
        add_action('woocommerce_add_to_cart', [$this, 'applyPending'], 20);
    }

    /**
     * What to do with a code that arrived on a link.
     *
     * Pure, because there are no WooCommerce stubs: every WooCommerce answer
     * is asked by the caller and handed in.
     *
     * `held` is a code that is already in the cart: nothing to do but take
     * the parameter off the address.
     *
     * @param array<string, true> $shown Lower-cased codes published campaigns show now.
     * @return 'skip'|'held'|'pending'|'apply'
     */
    public static function decide(string $code, array $shown, bool $exists, bool $consent, bool $applied, bool $cartEmpty): string
    {
        if ($code === '' || !isset($shown[mb_strtolower($code)]) || !$exists || !$consent) {
            return 'skip';
        }

        return $applied ? 'held' : ($cartEmpty ? 'pending' : 'apply');
    }

    /**
     * Every code a published, servable campaign shows at this instant.
     *
     * Lower-cased, multibyte-safe, as WooCommerce matches codes. A campaign outside its
     * schedule shows nothing, and neither does a hidden code block.
     *
     * @param iterable<array<string, mixed>> $set
     * @param array<string, true> $servable As {@see PublishedOptin::servableIdsIn()} answers.
     * @return array<string, true>
     */
    public static function shownCodes(iterable $set, array $servable, int $nowMs): array
    {
        $codes = [];

        foreach ($set as $entry) {
            $payload = $entry['payload'] ?? null;

            if (!is_array($payload) || !isset($servable[(string) ($entry['id'] ?? '')])) {
                continue;
            }

            if ((isset($payload['starts_at']) && $nowMs < $payload['starts_at']) || (isset($payload['ends_at']) && $nowMs >= $payload['ends_at'])) {
                continue;
            }

            TemplateTree::rewrittenIn($payload, static function (array $node) use (&$codes): array {
                if (($node['type'] ?? null) === 'code' && empty($node['hidden']) && is_string($node['text'] ?? null) && trim($node['text']) !== '') {
                    $codes[mb_strtolower(trim($node['text']))] = true;
                }

                return $node;
            });
        }

        return $codes;
    }

    public function arrive(): void
    {
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- a shareable link that only applies a code a published campaign already shows; see the class docblock.
        $raw = $_GET[self::PARAM] ?? null;

        if (!is_string($raw) || is_admin() || wp_doing_ajax() || (defined('REST_REQUEST') && REST_REQUEST) || !function_exists('WC')) {
            return;
        }

        $code = wc_format_coupon_code(sanitize_text_field(wp_unslash($raw)));

        try {
            if (!WC()->cart && function_exists('wc_load_cart')) {
                wc_load_cart();
            }

            if (!WC()->cart || !WC()->session) {
                return;
            }

            $action = self::decide(
                $code,
                $this->shown(),
                (bool) wc_get_coupon_id_by_code($code),
                self::consent(),
                WC()->cart->has_discount($code),
                WC()->cart->is_empty()
            );

            if ($action === 'skip') {
                return;
            }

            if ($action === 'pending') {
                // The visitor has no cart yet, so the session needs its cookie
                // to still be theirs on the add-to-cart that follows.
                WC()->session->set_customer_session_cookie(true);
                WC()->session->set(self::PENDING, $code);
                WC()->session->save_data();
            } elseif ($action === 'apply') {
                WC()->cart->apply_coupon($code);
            }
        } catch (\Throwable) {
            // A link that could not be applied is an ordinary page view.
            return;
        }

        // The address the visitor keeps, shares and bookmarks is the page
        // without the code, and a cache must not keep the one with it.
        nocache_headers();
        wp_safe_redirect(remove_query_arg(self::PARAM));
        exit;
    }

    /** The first thing in the cart: a code that waited for it is applied now. */
    public function applyPending(): void
    {
        try {
            if (!WC()->session || !WC()->cart) {
                return;
            }

            $code = WC()->session->get(self::PENDING);

            if ($code === null) {
                return;
            }

            WC()->session->__unset(self::PENDING);

            // Asked again: the campaign may have ended, or consent been
            // withdrawn, between the link and the cart.
            if (is_string($code) && self::decide($code, $this->shown(), (bool) wc_get_coupon_id_by_code($code), self::consent(), WC()->cart->has_discount($code), false) === 'apply') {
                WC()->cart->apply_coupon($code);
            }
        } catch (\Throwable) {
            // The product is in the cart either way; the code is optional.
            return;
        }
    }

    /** @return array<string, true> */
    private function shown(): array
    {
        $set = $this->published->all();

        return self::shownCodes($set, PublishedOptin::servableIdsIn($set, $this->degradation), time() * 1000);
    }

    /** `CartAddition`'s rule: functional consent where a consent plugin is asked. */
    private static function consent(): bool
    {
        return !function_exists('wp_has_consent') || wp_has_consent('functional');
    }
}

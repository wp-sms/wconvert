<?php
namespace WConvert\Pro\Module\CartRecovery;

use WConvert\Goal\Goal;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\Degradation;
use WConvert\Rest\RateLimit;
use WConvert\Stats\{StatDay, StatKind, StatsRepository};

defined('ABSPATH') || exit;

/** Quantity-one additions, with fresh session protection and short-lived replay claims. */
final class CartAddition
{
    private const PREFIX = 'wconvert_cart_claim_';

    public function __construct(private readonly PublishedSet $published, private readonly Degradation $degradation,
        private readonly RateLimit $limit, private readonly CommerceContext $context, private readonly StatsRepository $stats) {}

    public function hooks(): void
    {
        add_action('wc_ajax_wconvert_cart_begin', [$this, 'begin']);
        add_action('wc_ajax_wconvert_cart_add', [$this, 'serve']);
    }

    /** Extension-driven simple products must keep their own product-page form. */
    public static function supported(\WC_Product $product): bool
    {
        global $wp_filter;
        if (get_class($product) !== 'WC_Product_Simple' || !$product->supports('ajax_add_to_cart') || has_filter('woocommerce_add_cart_item_data')) return false;
        foreach ($wp_filter['woocommerce_add_to_cart_validation']->callbacks ?? [] as $callbacks) {
            foreach ($callbacks as $callback) if ($callback['function'] !== 'wc_protected_product_add_to_cart') return false;
        }
        return true;
    }

    /** @return array<string, mixed>|null */
    private function campaign(string $id, string $revision): ?array
    {
        foreach ($this->published->all() as $entry) {
            if ($entry['id'] !== $id || ($entry['goal'] ?? '') !== Goal::IncreaseBasketValue->value) continue;
            $payload = $entry['payload'];
            if ($this->degradation->suspendedIn($payload) !== null || !hash_equals(CommerceContext::revision($payload), $revision)) return null;
            $node = CommerceContext::products($payload);
            return ($node['action'] ?? '') === 'add_to_cart' ? $node : null;
        }
        return null;
    }

    private function guard(): void
    {
        nocache_headers(); header('Cache-Control: private, no-store, max-age=0'); header('Vary: Cookie, Origin');
        $source = wp_parse_url((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
        $site = wp_parse_url(home_url());
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !is_array($source) || !is_array($site)
            || ($source['scheme'] ?? '') !== ($site['scheme'] ?? '') || ($source['host'] ?? '') !== ($site['host'] ?? '')
            || ($source['port'] ?? null) !== ($site['port'] ?? null)
            || (isset($_SERVER['HTTP_SEC_FETCH_SITE']) && $_SERVER['HTTP_SEC_FETCH_SITE'] !== 'same-origin')
            || (function_exists('wp_has_consent') && !wp_has_consent('functional'))) wp_send_json(['state' => 'rejected'], 403);
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 4096 || strlen((string) wp_json_encode($_POST)) > 4096) wp_send_json(['state' => 'rejected'], 413);
        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        if ($ip === '' || !$this->limit->allows('cart-add:' . $ip, time())) wp_send_json(['state' => 'rejected'], 429);
        if (!WC()->session || !WC()->cart) wp_send_json(['state' => 'rejected'], 503);
    }

    private static function field(string $key): string
    {
        return is_string($_POST[$key] ?? null) ? wp_unslash($_POST[$key]) : '';
    }

    public function begin(): void
    {
        $this->guard();
        $id = self::field('id'); $revision = self::field('revision'); $mount = self::field('mount');
        if (!preg_match('/^[a-f0-9-]{36}$/D', $mount) || $this->campaign($id, $revision) === null) wp_send_json(['state' => 'rejected'], 409);
        WC()->session->set_customer_session_cookie(true);
        // This read creates no cart mutation or conversion; capability never enters cached HTML.
        wp_send_json(['token' => AdditionToken::issue((string) WC()->session->get_customer_id(), $id, $revision, $mount, time(), wp_salt('nonce'))]);
    }

    public function serve(): void
    {
        $this->guard();
        $id = self::field('id'); $revision = self::field('revision'); $operation = self::field('operation');
        $session = (string) WC()->session->get_customer_id();
        $token = AdditionToken::read(self::field('token'), $session, $id, $revision, time(), wp_salt('nonce'));
        if ($token === null || !preg_match('/^[a-f0-9-]{36}$/D', $operation)) wp_send_json(['state' => 'rejected'], 403);
        $node = $this->campaign($id, $revision);
        if ($node === null) wp_send_json(['state' => 'rejected'], 409);
        $productId = absint(self::field('product'));
        $key = self::key( $session . '|' . $id . '|' . $token['mount'] . '|' . $operation);
        $receipt = get_option($key);
        if (is_array($receipt)) wp_send_json(($receipt['product'] ?? 0) === $productId ? $receipt : ['state' => 'rejected'], 200);
        $lock = self::key( 'lock|' . $session);
        if (!$this->claim($lock, ['state' => 'unknown'], time() + AdditionToken::WINDOW)) wp_send_json(['state' => 'rejected'], 409);
        try {
            $result = $this->add($node, $productId, $key, $id, $session, $token);
        } catch (\Throwable) {
            // A Woo hook may throw AFTER changing the cart. Never invite an automatic retry.
            $result = ['state' => 'unknown'];
        } finally {
            delete_option($lock);
        }
        // wp_send_json exits, so it must run after releasing the lock.
        wp_send_json($result);
    }

    /** @param array<string, mixed> $node
     * @param array{mount: string, expires: int} $token
     * @return array<string, mixed> */
    private function add(array $node, int $productId, string $key, string $id, string $session, array $token): array
    {
        $unknown = ['state' => 'unknown', 'product' => $productId];
        if (!$this->claim($key, $unknown, $token['expires'])) return $unknown;
        $cards = $this->context->recommendations($node, $this->context->cart(), CommerceContext::viewedProduct(self::field('page_product')))['cards'];
        $card = array_column($cards, null, 'id')[$productId] ?? null;
        $product = wc_get_product($productId);
        if (!$card || !hash_equals($card['price_key'], self::field('price_key')) || empty($card['can_add']) || !$product || !self::supported($product)) {
            $result = ['state' => 'rejected', 'product' => $productId];
        } else {
            $item = apply_filters('woocommerce_add_to_cart_validation', true, $productId, 1) ? WC()->cart->add_to_cart($productId, 1) : false;
            if (!$item) {
                $result = ['state' => 'rejected', 'product' => $productId];
            } else {
                WC()->cart->calculate_totals();
                WC()->cart->set_session();
                WC()->session->save_data();
                $result = ['state' => 'added', 'product' => $productId];
                // Claim BEFORE counting. A storage failure may undercount but never double-count.
                try {
                    $this->stats->increment($id, StatKind::CartAddition, StatDay::today());
                    $headline = self::key( 'headline|' . $session . '|' . $id . '|' . $token['mount']);
                    if ($this->claim($headline, ['state' => 'counted'], $token['expires'])) $this->stats->increment($id, StatKind::Conversion, StatDay::today());
                    do_action('wconvert_cart_addition_accepted', $id);
                    \WConvert\Stats\ProductStats::start($id);
                    $this->stats->increment($id, StatKind::CartAddition, StatDay::today(), 'product:' . $productId);
                } catch (\Throwable) { /* Reporting must not turn a successful cart action into a retry. */ }
            }
        }
        update_option($key, $result, false);
        return $result;
    }

    private static function key(string $value): string
    {
        return self::PREFIX . hash_hmac('sha256', $value, wp_salt('auth'));
    }

    /** @param array<string, mixed> $value */
    private function claim(string $key, array $value, int $expires): bool
    {
        if (!add_option($key, $value, '', false)) return false;
        wp_schedule_single_event($expires + 60, 'wconvert_cart_claim_expired', [$key]);
        return true;
    }
}

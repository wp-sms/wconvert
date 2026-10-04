<?php
namespace WConvert\Pro\Module\CartRecovery;

use WConvert\Optin\PublishedSet;
use WConvert\Rules\Degradation;
use WConvert\Rules\DisplayPlan;
use WConvert\Template\CaptureJourney;
use WConvert\Rules\RuleValue;
use WConvert\Rest\Routes;

defined('ABSPATH') || exit;

/** Read-only WooCommerce AJAX transport preserves guest AND authenticated Woo sessions. */
final class CommerceContext
{
    public function __construct(private readonly PublishedSet $published, private readonly Degradation $degradation, private readonly \WConvert\Rest\RateLimit $rateLimit) {}

    public function hooks(): void
    {
        add_filter('wconvert_commerce', '__return_true');
        add_action('wc_ajax_wconvert_cart_context', [$this, 'serve']);
        add_filter('wconvert_payload_entries', [$this, 'annotate']);
        add_filter('wconvert_payload_attributes', [$this, 'attributes'], 10, 2);
        add_filter('wconvert_publish_issues', [$this, 'publishIssues'], 10, 2);
        add_filter('wconvert_playbook_prefill', [$this, 'prefill'], 10, 2);
        add_action('rest_api_init', function (): void {
            register_rest_route(Routes::NAMESPACE, '/commerce/objects', [
                'methods' => 'GET', 'permission_callback' => [Routes::class, 'canManage'],
                'callback' => [$this, 'objects'],
            ]);
        });
    }

    /** @param array<string, mixed> $payload */
    public static function revision(array $payload): string
    {
        return hash('sha256', (string) wp_json_encode([$payload['display_rules'] ?? [], $payload['required_rules'] ?? [], $payload['template'] ?? []]));
    }

    /** @param array<string, mixed> $payload
     * @return array<string, mixed>|null */
    public static function products(array $payload): ?array
    {
        foreach ($payload['template']['tree']['steps'] ?? [] as $step) {
            foreach (CaptureJourney::nodes($step['content'] ?? []) as $node) {
                if (($node['type'] ?? '') === 'products' && !($node['hidden'] ?? false)) return $node;
            }
        }
        return null;
    }

    /** @param array<string, mixed> $payload */
    public static function needed(array $payload): bool
    {
        if (self::products($payload) !== null) return true;
        foreach (DisplayPlan::rules($payload['display_rules'] ?? []) as $rule) {
            if (in_array($rule['type'], CartRules::TYPES, true)) return true;
        }
        return false;
    }

    /** @param list<array<string, mixed>> $entries
     * @return list<array<string, mixed>> */
    public function annotate(array $entries): array
    {
        $published = [];
        foreach ($this->published->all() as $entry) $published[$entry['id']] = $entry['payload'];
        foreach ($entries as &$entry) {
            if (!self::needed($entry) || !isset($published[$entry['id']])) continue;
            $entry['commerce_revision'] = self::revision($published[$entry['id']]);
            $stamp = static function (array $node) use (&$stamp, $entry): array {
                if (($node['type'] ?? '') === 'products') $node['context_key'] = $entry['id'];
                foreach (['children', 'start', 'end'] as $key) if (isset($node[$key])) $node[$key] = array_map($stamp, $node[$key]);
                return $node;
            };
            foreach ($entry['template']['tree']['steps'] ?? [] as $i => $screen) $entry['template']['tree']['steps'][$i]['content'] = $stamp($screen['content']);
            foreach ($entry['display_rules']['audience']['groups'] ?? [] as $i => $group) {
                foreach ($group['rules'] as $j => $rule) {
                    if (str_starts_with($rule['type'], 'cart_')) $entry['display_rules']['audience']['groups'][$i]['rules'][$j]['context_key'] = $entry['id'] . ':' . $rule['id'];
                }
            }
            foreach ($entry['required_rules'] ?? [] as $i => $rule) {
                if (str_starts_with($rule['type'], 'cart_')) $entry['required_rules'][$i]['context_key'] = $entry['id'] . ':required-' . $i;
            }
            if (self::products($entry) !== null) {
                $entry['required_rules'][] = ['type' => 'cart_has_items', 'context_key' => $entry['id'] . ':products'];
            }
        }
        unset($entry);
        return $entries;
    }

    /** @param array<string, mixed> $attributes
     * @param list<array<string, mixed>> $entries
     * @return array<string, mixed> */
    public function attributes(array $attributes, array $entries): array
    {
        if (array_filter($entries, [self::class, 'needed']) === []) return $attributes;
        $attributes['data-commerce-runtime'] = WCONVERT_PRO_URL . 'modules/cart-recovery/public/commerce.js?v=' . \WConvert\Assets\BuiltAsset::version(WCONVERT_PRO_DIR . 'modules/cart-recovery/public/commerce.js');
        $attributes['data-commerce-labels'] = wp_json_encode([__('No further suggestions for this basket.', 'wconvert'), __('Product suggestions are unavailable right now.', 'wconvert')]);
        $attributes['data-commerce'] = \WC_AJAX::get_endpoint('wconvert_cart_context');
        return $attributes;
    }

    /** @param list<string> $issues
     * @param array<string, mixed> $config
     * @return list<string> */
    public function publishIssues(array $issues, array $config): array
    {
        foreach (DisplayPlan::rules($config['display_rules'] ?? []) as $rule) {
            if (!in_array($rule['type'], CartRules::TYPES, true)) continue;
            if (!CartRules::valid($rule)) { $issues[] = __('Complete the cart rule with valid values.', 'wconvert'); continue; }
            if (isset($rule['ids']) && count($this->existing($rule)) !== count($rule['ids'])) $issues[] = __('A selected cart product or category is unavailable. Review your selection.', 'wconvert');
            if ($rule['type'] === 'cart_amount' && ($rule['range']['currency'] !== get_woocommerce_currency() || $rule['range']['decimals'] !== wc_get_price_decimals())) $issues[] = __('The store currency changed. Review the cart amount rule.', 'wconvert');
        }
        $products = self::products($config);
        if ($products !== null) {
            $ids = $products['product_ids'] ?? [];
            if (!RuleValue::ids($ids) || count($ids) > 6 || count($this->existing(['type' => 'recommendation', 'ids' => $ids])) !== count($ids)) $issues[] = __('Choose up to six available catalog products for the recommendations.', 'wconvert');
        }
        return $issues;
    }

    /** Resolve site-owned defaults only when preparing a new draft.
     * @param array<string, mixed> $config
     * @return array<string, mixed> */
    public function prefill(array $config, string $playbookId): array
    {
        if ($playbookId !== 'recommend-accessory') return $config;
        $checkout = wc_get_page_id('checkout');
        // Checkout endpoints retain this queried page ID, including order-received.
        if ($checkout > 0) $config['targeting']['exclude'][] = ['type' => 'post', 'value' => (string) $checkout];
        return $config;
    }

    /** @param array<string, mixed> $rule
     * @return list<int> */
    private function existing(array $rule): array
    {
        return array_values(array_filter($rule['ids'], static function (int $id) use ($rule): bool {
            if ($rule['type'] === 'cart_categories') return is_array(term_exists($id, 'product_cat'));
            $product = wc_get_product($id);
            return $product && $product->get_status() === 'publish' && ($rule['type'] !== 'recommendation' || $product->is_type(['simple', 'variable']));
        }));
    }

    /** Narrow cart facts stay server-side.
     * @return array{quantity: int, total: float, amount: int, currency: string, decimals: int, products: list<int>, categories: list<int>, ancestors: list<int>}|null */
    private function cart(): ?array
    {
        if (!WC()->cart) return null;
        $items = WC()->cart->get_cart();
        if (count($items) > 250) return null;
        $currency = get_woocommerce_currency();
        $decimals = wc_get_price_decimals();
        $result = ['quantity' => 0, 'total' => (float) WC()->cart->get_total('edit'), 'amount' => 0, 'currency' => $currency, 'decimals' => $decimals, 'products' => [], 'categories' => [], 'ancestors' => []];
        $amount = 0.0;
        foreach ($items as $line) {
            $quantity = $line['quantity'];
            if (!is_numeric($quantity) || (float) (int) $quantity !== (float) $quantity || $quantity < 0) return null;
            $result['quantity'] += (int) $quantity;
            $lineTotal = $line['line_total'] ?? null;
            if (!is_numeric($lineTotal) || !is_finite((float) $lineTotal) || (float) $lineTotal < 0) return null;
            $amount += (float) $lineTotal;
            $parent = (int) $line['product_id'];
            $result['products'][] = $parent;
            if (!empty($line['variation_id'])) $result['products'][] = (int) $line['variation_id'];
            $categories = wp_get_object_terms($parent, 'product_cat', ['fields' => 'ids']);
            if ($categories instanceof \WP_Error) return null;
            foreach ($categories as $id) {
                $result['categories'][] = (int) $id;
                array_push($result['ancestors'], (int) $id, ...array_map('intval', get_ancestors($id, 'product_cat', 'taxonomy')));
            }
        }
        $result['amount'] = (int) round($amount * (10 ** $decimals));
        foreach (['products', 'categories', 'ancestors'] as $key) $result[$key] = array_values(array_unique($result[$key]));
        return $result;
    }

    public function serve(): void
    {
        nocache_headers();
        header('Cache-Control: private, no-store, max-age=0');
        header('Vary: Cookie');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || (isset($_SERVER['HTTP_SEC_FETCH_SITE']) && !in_array($_SERVER['HTTP_SEC_FETCH_SITE'], ['same-origin', 'none'], true))) wp_send_json_error(null, 403);
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $site = wp_parse_url(home_url());
        $source = is_string($origin) ? wp_parse_url($origin) : false;
        if ($origin !== '' && (!is_array($source) || !is_array($site) || ($source['scheme'] ?? '') !== ($site['scheme'] ?? '') || ($source['host'] ?? '') !== ($site['host'] ?? '') || ($source['port'] ?? null) !== ($site['port'] ?? null))) wp_send_json_error(null, 403);
        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        if ($ip === '' || !$this->rateLimit->allows('commerce:' . $ip, time())) wp_send_json_error(null, 429);
        if (function_exists('wp_has_consent') && !wp_has_consent('functional')) wp_send_json_error(null, 403);
        $raw = isset($_POST['campaigns']) && is_string($_POST['campaigns']) ? wp_unslash($_POST['campaigns']) : '';
        if (strlen($raw) > 4096) wp_send_json_error(null, 413);
        $requested = json_decode($raw, true);
        if (!is_array($requested) || count($requested) < 1 || count($requested) > 20) wp_send_json_error(null, 400);
        $cart = $this->cart();
        $answer = [];
        foreach ($this->published->all() as $entry) {
            $id = $entry['id'];
            if (!isset($requested[$id]) || !is_string($requested[$id])) continue;
            $payload = $entry['payload'];
            if (!hash_equals(self::revision($payload), $requested[$id]) || $this->degradation->suspendedIn($payload) !== null || !self::needed($payload)) continue;
            $rules = [];
            foreach (DisplayPlan::rules($payload['display_rules'] ?? []) as $rule) {
                if (str_starts_with($rule['type'], 'cart_')) $rules[$id . ':' . $rule['id']] = CartRules::matches($rule, $cart, isset($rule['ids']) ? $this->existing($rule) : null);
            }
            foreach ($payload['required_rules'] ?? [] as $i => $rule) {
                if (str_starts_with($rule['type'], 'cart_')) $rules[$id . ':required-' . $i] = CartRules::matches($rule, $cart);
            }
            $node = self::products($payload);
            $cards = $node !== null && $cart !== null && $cart['quantity'] > 0 ? $this->cards($node, $cart['products']) : [];
            if ($node !== null) $rules[$id . ':products'] = $cart !== null && $cart['quantity'] > 0 && $cards !== [];
            $answer[$id] = ['rules' => $rules, 'cards' => $cards, 'known' => $cart !== null];
        }
        wp_send_json($answer);
    }

    /** @param array<string, mixed> $node
     * @param list<int> $inCart
     * @return list<array<string, mixed>> */
    private function cards(array $node, array $inCart): array
    {
        $cards = [];
        foreach (array_slice($node['product_ids'] ?? [], 0, 6) as $id) {
            $product = wc_get_product($id);
            if (!$product || !$product->is_type(['simple', 'variable']) || (($node['exclude_cart'] ?? true) && in_array($id, $inCart, true)) || !$product->is_visible() || !$product->is_purchasable() || !$product->is_in_stock() || get_post_field('post_password', $id) !== '') continue;
            $cards[] = ['id' => $id, 'name' => $product->get_name(), 'url' => $product->get_permalink(), 'image' => wp_get_attachment_image_url($product->get_image_id(), 'woocommerce_thumbnail') ?: '',
                'price' => html_entity_decode(wp_strip_all_tags($product->get_price_html()), ENT_QUOTES, 'UTF-8'),
                'label' => $product->is_type('variable') ? __('Choose options', 'wconvert') : __('View product', 'wconvert')];
            if (count($cards) === 3) break;
        }
        return $cards;
    }

    public function objects(\WP_REST_Request $request): \WP_REST_Response
    {
        $kind = $request->get_param('kind');
        $query = sanitize_text_field((string) $request->get_param('search'));
        $ids = array_slice(array_filter(array_map('absint', explode(',', (string) $request->get_param('ids')))), 0, 20);
        $items = [];
        if ($kind === 'category') {
            $terms = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => false, 'number' => 20, 'search' => $ids ? '' : $query, 'include' => $ids]);
            if (is_array($terms)) foreach ($terms as $term) $items[] = ['id' => $term->term_id, 'name' => $term->name];
        } elseif ($kind !== 'currency') {
            $posts = get_posts(['post_type' => $kind === 'recommendation' ? ['product'] : ['product', 'product_variation'], 'post_status' => 'publish', 'posts_per_page' => 20, 's' => $ids ? '' : $query, 'post__in' => $ids]);
            foreach ($posts as $post) {
                $product = wc_get_product($post->ID);
                if ($product && ($kind !== 'recommendation' || $product->is_type(['simple', 'variable']))) $items[] = ['id' => $post->ID, 'name' => $product->get_name()];
            }
        }
        return new \WP_REST_Response(['items' => $items, 'currency' => get_woocommerce_currency(), 'decimals' => wc_get_price_decimals()]);
    }
}

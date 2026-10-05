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
            register_rest_route(Routes::NAMESPACE, '/commerce/preview', [
                'methods' => 'POST', 'permission_callback' => [Routes::class, 'canManage'],
                'callback' => [$this, 'preview'],
            ]);
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
        if (self::products($payload) !== null || QuizProducts::used($payload)) return true;
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
            if ((self::products($entry)['action'] ?? '') === 'add_to_cart') $entry['server_conversion'] = true;
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
                $entry['required_rules'][] = ['type' => 'products_ready', 'context_key' => $entry['id'] . ':products'];
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
        $attributes['data-commerce-labels'] = wp_json_encode([__('No further suggestions right now.', 'wconvert'), __('Product suggestions are unavailable right now.', 'wconvert')]);
        if (is_singular('product') && self::publicProduct((int) get_queried_object_id())) {
            $id = (int) get_queried_object_id();
            $attributes['data-commerce-product'] = $id . ':' . wp_hash('wconvert-product:' . $id);
        }
        $attributes['data-commerce-quiz'] = \WC_AJAX::get_endpoint('wconvert_quiz_products');
        $attributes['data-commerce-activity'] = \WC_AJAX::get_endpoint('wconvert_product_activity');
        $attributes['data-commerce-begin'] = \WC_AJAX::get_endpoint('wconvert_cart_begin');
        $attributes['data-commerce-add'] = \WC_AJAX::get_endpoint('wconvert_cart_add');
        $attributes['data-commerce-cart'] = wc_get_cart_url();
        $attributes['data-commerce-add-labels'] = wp_json_encode([__('Adding…', 'wconvert'), __('Added to your basket.', 'wconvert'), __('Not added. Open the product to try again.', 'wconvert'), __('Check your basket before trying again.', 'wconvert'), __('View basket', 'wconvert'), __('View product', 'wconvert'), __('Added', 'wconvert')]);
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
        if ($products !== null && (($products['context'] ?? 'cart') === 'product' || array_key_exists('main_product_id', $products)) && !self::publicProduct((int) ($products['main_product_id'] ?? 0))) {
            $issues[] = __('Choose an available main product for these recommendations.', 'wconvert');
        }
        if (($config['inline_placement']['position'] ?? '') === 'after_product_summary' && wp_is_block_theme()) {
            $issues[] = __('For a block theme, place the campaign block in the product template and choose Manual placement.', 'wconvert');
        }
        if ($products !== null && ($products['source'] ?? 'selected') !== 'cross_sells') {
            $ids = $products['product_ids'] ?? [];
            if (!RuleValue::ids($ids) || count($ids) > 6 || count($this->existing(['type' => 'recommendation', 'ids' => $ids])) !== count($ids)) $issues[] = __('Choose up to six available catalog products for the recommendations.', 'wconvert');
        }
        if ($products !== null && ($products['action'] ?? 'link') === 'add_to_cart') {
            $main = (int) ($products['main_product_id'] ?? 0);
            $ids = ($products['source'] ?? 'selected') === 'cross_sells'
                ? ($main > 0 ? (($mainProduct = wc_get_product($main)) ? $mainProduct->get_cross_sell_ids() : []) : []) : ($products['product_ids'] ?? []);
            $supported = array_filter(array_slice($ids, 0, 60), static function (int $id) use ($main): bool {
                $product = wc_get_product($id);
                return $id !== $main && $product && CartAddition::supported($product) && $product->get_status() === 'publish'
                    && $product->is_visible() && $product->is_purchasable() && $product->is_in_stock() && get_post_field('post_password', $id) === '';
            });
            if ($supported === []) $issues[] = __('Choose at least one available simple product that supports Add to cart. Products requiring options use their product page.', 'wconvert');
        }
        return $issues;
    }

    /** Resolve site-owned defaults only when preparing a new draft.
     * @param array<string, mixed> $config
     * @return array<string, mixed> */
    public function prefill(array $config, string $playbookId): array
    {
        if (!in_array($playbookId, ['recommend-accessory', 'add-useful-extras'], true)) return $config;
        $config = \WConvert\Template\TemplateTree::rewrittenIn($config, static function (array $node): array {
            if (($node['type'] ?? '') === 'products') { $node['context'] = 'product'; $node['main_product_id'] = 0; }
            return $node;
        });
        $config['targeting']['include'] = [['type' => 'singular', 'value' => 'product']];
        $config['inline_placement'] = wp_is_block_theme() ? null : ['position' => 'after_product_summary'];
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
    public function cart(): ?array
    {
        if (!WC()->cart) return null;
        return $this->project(WC()->cart->get_cart(), (float) WC()->cart->get_total('edit'));
    }

    /** Both live and sample baskets derive product/category membership here.
     * @param array<array<string, mixed>> $items
     * @return array{quantity: int, total: float, amount: int, currency: string, decimals: int, products: list<int>, categories: list<int>, ancestors: list<int>}|null */
    private function project(array $items, float $total): ?array
    {
        if (count($items) > 250) return null;
        $currency = get_woocommerce_currency();
        $decimals = wc_get_price_decimals();
        $result = ['quantity' => 0, 'total' => $total, 'amount' => 0, 'currency' => $currency, 'decimals' => $decimals, 'products' => [], 'categories' => [], 'ancestors' => []];
        $amount = 0.0;
        foreach ($items as $line) {
            $quantity = $line['quantity'];
            if (!is_numeric($quantity) || (float) (int) $quantity !== (float) $quantity || $quantity < 0) return null;
            if ((int) $quantity === 0) continue;
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
        $token = isset($_POST['page_product']) && is_string($_POST['page_product']) ? wp_unslash($_POST['page_product']) : '';
        $viewedProduct = self::viewedProduct($token);
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
            $cards = $node !== null ? $this->recommendations($node, $cart, $viewedProduct)['cards'] : [];
            if ($node !== null) $rules[$id . ':products'] = $cards !== [];
            if ($cards !== []) {
                \WConvert\Stats\ProductStats::start($id);
                foreach ($cards as &$card) $card['activity_token'] = ProductActivityToken::issue($id, $requested[$id], (int) $card['id'], time(), wp_salt('nonce'));
                unset($card);
            }
            $answer[$id] = ['rules' => $rules, 'cards' => $cards, 'known' => $cart !== null];
        }
        wp_send_json($answer);
    }

    /** Selected relationships only, in basket-product order then WooCommerce's saved order.
     * @param array<string, mixed> $node
     * @param array<string, mixed>|null $cart
     * @return array{cards: list<array<string, mixed>>, reason: string} */
    public function recommendations(array $node, ?array $cart, int $viewedProduct = 0): array
    {
        $reason = RecommendationContext::reason($node, $cart, $viewedProduct);
        if ($reason !== '') return ['cards' => [], 'reason' => $reason];
        if ($cart === null) return ['cards' => [], 'reason' => 'unknown'];
        $main = (int) ($node['main_product_id'] ?? 0);
        if ($main > 0 && !self::publicProduct($main)) return ['cards' => [], 'reason' => 'main_required'];
        $crossSells = ($node['source'] ?? 'selected') === 'cross_sells';
        $ids = $crossSells ? [] : array_slice($node['product_ids'] ?? [], 0, 6);
        if ($crossSells) {
            // Parent before variation; first occurrence wins. Bound reads and candidates.
            foreach (RecommendationContext::seeds($node, $cart) as $id) {
                $product = wc_get_product($id);
                if (!$product) continue;
                foreach (array_slice($product->get_cross_sell_ids(), 0, 60) as $candidate) {
                    if (!in_array($candidate, $ids, true)) $ids[] = $candidate;
                    if (count($ids) === 60) break 2;
                }
            }
        }
        $cards = [];
        foreach ($ids as $id) {
            if ($id === $main || $id === $viewedProduct) continue;
            $product = wc_get_product($id);
            if (!$product || (($node['exclude_cart'] ?? true) && in_array($id, $cart['products'], true))) continue;
            $card = self::card($product, ($node['action'] ?? 'link') === 'add_to_cart');
            if ($card === null) continue;
            $cards[] = $card;
            if (count($cards) === 3) break;
        }
        if (($node['action'] ?? 'link') === 'add_to_cart' && !array_filter($cards, static fn (array $card): bool => $card['can_add'])) return ['cards' => [], 'reason' => 'no_direct_add'];
        return ['cards' => $cards, 'reason' => $cards !== [] ? '' : ($ids !== [] ? 'unavailable' : ($crossSells ? 'no_relationships' : 'none_selected'))];
    }

    /** @return array<string, mixed>|null */
    public static function card(\WC_Product $product, bool $adding): ?array
    {
        $id = $product->get_id();
        if ($product->get_status() !== 'publish' || !$product->is_type(['simple', 'variable']) || !$product->is_visible() || !$product->is_purchasable() || !$product->is_in_stock() || get_post_field('post_password', $id) !== '') return null;
        $canAdd = $adding && CartAddition::supported($product);
        return ['id' => $id, 'name' => $product->get_name(), 'url' => $product->get_permalink(), 'image' => wp_get_attachment_image_url($product->get_image_id(), 'woocommerce_thumbnail') ?: '',
            'price' => html_entity_decode(wp_strip_all_tags($product->get_price_html()), ENT_QUOTES, 'UTF-8'),
            'price_key' => hash('sha256', $product->get_price() . '|' . get_woocommerce_currency()), 'can_add' => $canAdd,
            'label' => $canAdd ? __('Add to cart', 'wconvert') : ($product->is_type('variable') ? __('Choose options', 'wconvert') : __('View product', 'wconvert'))];
    }

    /** Authenticated, stateless draft simulation; never reads or mutates a Woo session. */
    public function preview(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
    {
        $invalid = static fn () => new \WP_Error('wconvert_invalid_sample', __('Review the sample basket and try again.', 'wconvert'), ['status' => 400]);
        if (strlen($request->get_body()) > 32768) return $invalid();
        $input = $request->get_json_params();
        if (!is_array($input)) return $invalid();
        $items = $input['items'] ?? null;
        $rules = $input['rules'] ?? null;
        $state = $input['state'] ?? 'known';
        $node = $input['products'] ?? null;
        $viewedProduct = $input['viewed_product_id'] ?? 0;
        if (!is_int($viewedProduct) || $viewedProduct < 0 || ($viewedProduct > 0 && !self::publicProduct($viewedProduct))) return $invalid();
        if (!is_array($items) || !array_is_list($items) || count($items) > 20 || !is_array($rules) || !array_is_list($rules) || count($rules) > 41 || !in_array($state, ['known', 'unknown', 'blocked'], true)) return $invalid();
        foreach (['amount', 'total'] as $key) {
            $number = $input[$key] ?? null;
            if ((!is_int($number) && !is_float($number)) || !is_finite((float) $number) || $number < 0 || $number > 1000000000) return $invalid();
        }
        if ($node !== null && (!is_array($node) || !in_array($node['source'] ?? 'selected', ['selected', 'cross_sells'], true) || !is_bool($node['exclude_cart'] ?? true)
            || !in_array($node['action'] ?? 'link', ['link', 'add_to_cart'], true)
            || !in_array($node['context'] ?? 'cart', ['cart', 'product'], true)
            || (isset($node['main_product_id']) && (!is_int($node['main_product_id']) || $node['main_product_id'] < 0))
            || (($node['product_ids'] ?? []) !== [] && (!RuleValue::ids($node['product_ids']) || count($node['product_ids']) > 6)))) return $invalid();
        $lines = []; $seen = [];
        foreach ($items as $item) {
            if (!is_array($item) || !is_int($item['id'] ?? null) || $item['id'] < 1 || in_array($item['id'], $seen, true) || !is_int($item['quantity'] ?? null) || $item['quantity'] < 1 || $item['quantity'] > 10000) return $invalid();
            $product = wc_get_product($item['id']);
            if (!$product || $product->get_status() !== 'publish') return $invalid();
            $seen[] = $item['id'];
            $variation = $product->is_type('variation');
            $lines[] = ['product_id' => $variation ? $product->get_parent_id() : $item['id'], 'variation_id' => $variation ? $item['id'] : 0,
                'quantity' => $item['quantity'], 'line_total' => $lines === [] ? $input['amount'] : 0];
        }
        $cart = $state === 'known' ? $this->project($lines, (float) $input['total']) : null;
        $matches = [];
        foreach ($rules as $rule) {
            if (!is_array($rule) || !is_string($rule['id'] ?? null) || !preg_match('/^[a-zA-Z0-9_-]{1,64}$/D', $rule['id']) || array_key_exists($rule['id'], $matches)
                || !in_array($rule['type'] ?? null, [...CartRules::TYPES, 'cart_has_items', 'cart_value_min'], true)) return $invalid();
            if (isset($rule['ids']) && !RuleValue::ids($rule['ids'])) return $invalid();
            $matches[$rule['id']] = CartRules::matches($rule, $cart, isset($rule['ids']) ? $this->existing($rule) : null);
        }
        $suggestions = $node !== null ? $this->recommendations($node, $cart, $viewedProduct) : ['cards' => [], 'reason' => ''];
        $response = new \WP_REST_Response(['rules' => (object) $matches, 'cards' => $suggestions['cards'], 'reason' => $suggestions['reason'],
            'eligible' => $node === null || $suggestions['cards'] !== [], 'state' => $state, 'currency' => get_woocommerce_currency(), 'decimals' => wc_get_price_decimals()]);
        $response->header('Cache-Control', 'private, no-store');
        return $response;
    }

    public static function viewedProduct(string $token): int
    {
        if (strlen($token) <= 100 && preg_match('/^([1-9][0-9]*):([a-f0-9]{32})$/D', $token, $parts)
            && hash_equals(wp_hash('wconvert-product:' . $parts[1]), $parts[2]) && self::publicProduct((int) $parts[1])) return (int) $parts[1];
        return 0;
    }

    /** Only public parent products may provide page context. */
    private static function publicProduct(int $id): bool
    {
        if ($id < 1) return false;
        $product = wc_get_product($id);
        return $product && $product->get_status() === 'publish' && $product->is_type(['simple', 'variable'])
            && $product->is_visible() && get_post_field('post_password', $id) === '';
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

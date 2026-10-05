<?php
namespace WConvert\Pro\Module\CartRecovery;

use WConvert\Template\ProductHealth as Health;
use WConvert\Template\ResultProductSource;

defined('ABSPATH') || exit;

/** Uses the storefront's card eligibility without a visitor session or statistics. */
final class ProductHealth
{
    public function __construct(private readonly CommerceContext $commerce) {}

    /** @param array<string, mixed> $node
     * @return array{state: string, message: string} */
    public function check(mixed $previous, array $node, string $kind): array
    {
        if ($kind === 'result') {
            if (isset($node['product_filter'])) {
                if (!ResultProductSource::available($node['product_filter'])) return Health::check('warning', __('A category or attribute is missing. Update this result’s filters.', 'wconvert'));
                $cards = QuizProducts::cards($node);
                if ($cards instanceof \WP_Error) return Health::check('unknown', __('Products could not be checked. Try again.', 'wconvert'));
                if (ResultProductSource::missingPins($node['product_filter'], array_column($cards, 'id'))) return Health::check('warning', __('A pinned product is unavailable or does not match. Review this result’s pins.', 'wconvert'));
                return Health::check($cards ? 'ok' : 'warning', $cards ? __('Matching products are available.', 'wconvert') : __('No available products match. Review this result’s filters.', 'wconvert'));
            }
            return $this->selected(array_values(array_slice($node['product_ids'] ?? [], 0, 6)));
        }
        $main = (int) ($node['main_product_id'] ?? 0);
        if ($main > 0 || array_key_exists('main_product_id', $node) || ($node['context'] ?? 'cart') === 'product') {
            if ($main < 1) return Health::check('warning', __('Choose a main product in the editor.', 'wconvert'));
            $product = wc_get_product($main);
            if (!$product || !CommerceContext::publicProduct($main) || !$product->is_in_stock()) return Health::check('warning', __('The main product is unavailable. Review it in the editor.', 'wconvert'));
        }
        $crossSells = ($node['source'] ?? 'selected') === 'cross_sells';
        if ($crossSells && !$main) return Health::check('context', __('Products depend on the visitor’s basket. Check a sample visit in the editor.', 'wconvert'));
        if (!$crossSells) {
            $selected = $this->selected(array_values(array_filter(array_slice($node['product_ids'] ?? [], 0, 6), static fn (int $id): bool => $id !== $main)));
            if ($selected['state'] !== 'ok') return $selected;
        }
        $result = $this->commerce->recommendations($node, ['quantity' => 1, 'products' => $main ? [$main] : []], $main);
        if ($result['cards'] !== []) return Health::check('ok', __('Products are available. Display rules and the visitor’s basket still apply.', 'wconvert'));
        return match ($result['reason']) {
            'no_direct_add' => Health::check('warning', __('None of these products supports Add to cart here. Change products or use View product.', 'wconvert')),
            'no_relationships' => Health::check('warning', __('No cross-sells are set for the main product. Add them in WooCommerce or choose products here.', 'wconvert')),
            default => Health::check('warning', __('No recommendations are available. Review the selected products.', 'wconvert')),
        };
    }

    /** @param list<int> $ids
     * @return array{state: string, message: string} */
    private function selected(array $ids): array
    {
        $available = [];
        foreach ($ids as $id) {
            $product = wc_get_product($id);
            if ($product && CommerceContext::card($product, false) !== null) $available[] = $id;
        }
        return Health::selection($ids, $available);
    }
}

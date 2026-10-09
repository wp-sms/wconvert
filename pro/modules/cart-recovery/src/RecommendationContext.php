<?php
namespace WConvert\Pro\Module\CartRecovery;

defined('ABSPATH') || exit;

/** Public product context never relaxes an unknown basket or existing cart rules. */
final class RecommendationContext
{
    /** @param array<string, mixed> $node
     * @param array<string, mixed>|null $cart */
    public static function reason(array $node, ?array $cart, int $viewedProduct): string
    {
        if ($cart === null) return 'unknown';
        $main = $node['main_product_id'] ?? 0;
        if (array_key_exists('main_product_id', $node) && (!is_int($main) || $main < 1)) return 'main_required';
        if (($node['context'] ?? 'cart') === 'product') {
            if ($main < 1) return 'main_required';
            return $viewedProduct === $main ? '' : 'different_product';
        }
        if ($cart['quantity'] < 1) return 'empty';
        return $main > 0 && !in_array($main, $cart['products'], true) ? 'different_basket' : '';
    }

    /** @param array<string, mixed> $node
     * @param array<string, mixed> $cart
     * @return list<int> */
    public static function seeds(array $node, array $cart): array
    {
        $main = $node['main_product_id'] ?? 0;
        if (is_int($main) && $main > 0) return [$main];
        return array_values(array_filter(array_slice($cart['products'], 0, 100), 'is_int'));
    }
}

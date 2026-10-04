<?php

namespace WConvert\Pro\Module\CartRecovery;

defined('ABSPATH') || exit;

/** Bounded predicates over a cart projection. Unknown is never an empty cart. */
final class CartRules
{
    public const TYPES = ['cart_products', 'cart_categories', 'cart_quantity', 'cart_amount'];

    /** @param array<string, mixed> $rule */
    public static function valid(array $rule): bool
    {
        $type = $rule['type'] ?? '';
        if (in_array($type, ['cart_products', 'cart_categories'], true)) {
            $ids = $rule['ids'] ?? null;
            return is_array($ids) && array_is_list($ids) && count($ids) > 0 && count($ids) <= 20
                && count(array_filter($ids, static fn ($id): bool => is_int($id) && $id > 0)) === count($ids)
                && count(array_unique($ids)) === count($ids)
                && in_array($rule['operator'] ?? null, ['any', 'all', 'none'], true)
                && ($type !== 'cart_categories' || is_bool($rule['descendants'] ?? null));
        }
        if (!in_array($type, ['cart_quantity', 'cart_amount'], true)) return false;
        return \WConvert\Rules\RuleValue::range($rule['range'] ?? null, $type === 'cart_amount');
    }

    /** @param array<string, mixed> $rule
     * @param array{quantity: int, total: float, amount: int, currency: string, decimals: int, products: list<int>, categories: list<int>, ancestors: list<int>}|null $cart
     * @param list<int>|null $existing All selected IDs must still exist, including for negative rules.
     */
    public static function matches(array $rule, ?array $cart, ?array $existing = null): bool
    {
        if ($cart === null) return false;
        $type = $rule['type'] ?? '';
        if ($type === 'cart_has_items') return $cart['quantity'] > 0;
        if ($type === 'cart_value_min') return $cart['quantity'] > 0 && (is_int($rule['amount'] ?? null) || is_float($rule['amount'] ?? null)) && is_finite((float) $rule['amount']) && $cart['total'] >= $rule['amount'];
        if (!self::valid($rule)) return false;
        if (in_array($type, ['cart_products', 'cart_categories'], true)) {
            if ($existing === null || array_diff($rule['ids'], $existing) !== []) return false;
            $found = $type === 'cart_products' ? $cart['products'] : (($rule['descendants'] ?? false) ? $cart['ancestors'] : $cart['categories']);
            $count = count(array_intersect($rule['ids'], $found));
            return match ($rule['operator']) { 'any' => $count > 0, 'all' => $count === count($rule['ids']), 'none' => $count === 0, default => false };
        }
        $range = $rule['range'];
        $value = $cart['quantity'];
        $factor = 1;
        if ($type === 'cart_amount') {
            if ($cart['quantity'] < 1 || $cart['currency'] !== $range['currency'] || $cart['decimals'] !== $range['decimals']) return false;
            $value = $cart['amount'];
            $factor = 10 ** $cart['decimals'];
        }
        $min = (int) round($range['min'] * $factor);
        return match ($range['operator']) {
            'min' => $value >= $min,
            'max' => $value <= $min,
            'between' => $value >= $min && $value <= (int) round($range['max'] * $factor),
            default => false,
        };
    }
}

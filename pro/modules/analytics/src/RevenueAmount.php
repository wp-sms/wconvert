<?php
namespace WConvert\Pro\Module\Analytics;

defined('ABSPATH') || exit;

/** A read-time interpretation of WooCommerce line amounts; nothing monetary is persisted. */
final class RevenueAmount
{
    /** @param list<float> $lines
     * @param list<array{amount: float, products: float, other: float}> $refunds */
    public static function net(array $lines, array $refunds): ?float
    {
        $value = array_sum($lines);
        foreach ($refunds as $refund) {
            // An amount-only refund does not identify its merchandise share.
            if (abs($refund['amount'] - $refund['products'] - $refund['other']) > 0.000001) return null;
            $value -= $refund['products'];
        }
        return is_finite($value) && $value >= -0.000001 ? max(0.0, round($value, 6)) : null;
    }
}

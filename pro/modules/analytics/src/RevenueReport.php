<?php
namespace WConvert\Pro\Module\Analytics;

use WConvert\Stats\StatRange;
use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/** WooCommerce remains the source of truth. Never return a partial sum as a total. */
final class RevenueReport
{
    /** @return array<string, mixed> */
    public function read(StatRange $range, string $campaign = ''): array
    {
        $base = ['from' => $range->from, 'to' => $range->to, 'days' => $range->days(), 'complete' => true,
            'eligible_orders' => 0, 'linked_orders' => 0, 'currencies' => [], 'orders' => []];
        if ($range->days() === 0) return $base;
        $start = new \DateTimeImmutable($range->from, wp_timezone());
        $end = (new \DateTimeImmutable($range->to, wp_timezone()))->modify('+1 day');
        $started = microtime(true);
        $scanned = 0;
        $currencies = [];
        $orders = [];
        $eligible = 0;
        $linked = 0;
        for ($page = 1; $page <= 21; $page++) {
            $batch = wc_get_orders(['type' => 'shop_order', 'status' => array_unique(array_merge(wc_get_is_paid_statuses(), ['refunded'])),
                'date_paid' => $start->getTimestamp() . '...' . ($end->getTimestamp() - 1),
                'limit' => 100, 'page' => $page, 'orderby' => 'ID', 'order' => 'DESC', 'return' => 'objects']);
            foreach ($batch as $order) {
                if (++$scanned > 2000 || microtime(true) - $started > 8) return array_replace($base, ['complete' => false]);
                if (!$order instanceof \WC_Order || !$order->get_date_paid() || $order->get_meta('_wconvert_test_order')) continue;
                $eligible++;
                $credit = $order->get_meta(Attribution::META);
                if (!is_array($credit) || ($credit['version'] ?? null) !== 1 || !is_string($credit['arm'] ?? null)
                    || !Ulid::isOne($credit['arm']) || !is_string($credit['family'] ?? null) || !Ulid::isOne($credit['family'])
                    || ($campaign !== '' && $credit['arm'] !== $campaign)) continue;
                $linked++;
                $currency = $order->get_currency();
                $amount = self::amount($order);
                $currencies[$currency] ??= ['currency' => $currency, 'orders' => 0, 'amount' => 0.0, 'unallocated_refunds' => 0];
                $currencies[$currency]['orders']++;
                if ($amount === null) $currencies[$currency]['unallocated_refunds']++;
                else $currencies[$currency]['amount'] += $amount;
                if (count($orders) < 50 && current_user_can('edit_shop_order', $order->get_id())) $orders[] = ['id' => $order->get_id(), 'campaign' => $credit['arm'], 'currency' => $currency,
                    'amount' => $amount, 'paid' => $order->get_date_paid()->format('Y-m-d'), 'status' => wc_get_order_status_name($order->get_status()), 'refunded' => count($order->get_refunds()) > 0, 'url' => $order->get_edit_order_url()];
            }
            if (count($batch) < 100) break;
        }
        foreach ($currencies as &$row) {
            $row['amount'] = $row['unallocated_refunds'] > 0 ? null : round($row['amount'], 6);
        }
        unset($row);
        ksort($currencies);
        return array_replace($base, ['eligible_orders' => $eligible, 'linked_orders' => $linked, 'currencies' => array_values($currencies), 'orders' => $orders]);
    }

    public static function amount(\WC_Order $order): ?float
    {
        $lines = [];
        foreach ($order->get_items('line_item') as $item) $lines[] = (float) $item->get_total();
        $refunds = [];
        foreach ($order->get_refunds() as $refund) {
            $products = 0.0;
            $other = 0.0;
            foreach ($refund->get_items(['line_item', 'shipping', 'fee']) as $item) {
                if ($item->get_type() === 'line_item') $products += abs((float) $item->get_total());
                else $other += abs((float) $item->get_total());
                $other += abs((float) $item->get_total_tax());
            }
            $refunds[] = ['amount' => (float) $refund->get_amount(), 'products' => $products, 'other' => $other];
        }
        return RevenueAmount::net($lines, $refunds);
    }
}

<?php
namespace WConvert\Stats;

use WConvert\Database\Connection;

defined('ABSPATH') || exit;

/** Product dimensions share the atomic counters, but have their own bounded retention. */
final class ProductStats
{
    public const RETENTION_DAYS = 90;
    public const HOOK = 'wconvert_product_stats_prune';
    public const PREFIX = 'wconvert_product_tracking_';

    public function __construct(private readonly Connection $db) {}

    public function hooks(): void
    {
        add_action(self::HOOK, [$this, 'prune']);
    }

    /** Called only when live cards are served or a cart addition is accepted. */
    public static function start(string $id): void
    {
        if (!get_option(self::PREFIX . $id)) add_option(self::PREFIX . $id, StatDay::today(), '', false);
        if (!wp_next_scheduled(self::HOOK)) wp_schedule_single_event(time() + DAY_IN_SECONDS, self::HOOK);
    }

    public static function retainedFrom(string $today): string
    {
        return StatRange::lastDays(self::RETENTION_DAYS, $today)->from;
    }

    /** Campaign totals and journey dimensions are never pruned here. */
    public function prune(): void
    {
        try {
            $removed = $this->db->delete(Connection::TABLE_STATS,
                'DELETE FROM %i WHERE scope LIKE %s AND kind IN (%s, %s, %s) AND stat_date < %s LIMIT 5000',
                'product:%', StatKind::ProductShown->value, StatKind::ProductClick->value, StatKind::CartAddition->value, self::retainedFrom(StatDay::today()));
        } finally {
            if (!wp_next_scheduled(self::HOOK)) wp_schedule_single_event(time() + (($removed ?? 5000) >= 5000 ? HOUR_IN_SECONDS : DAY_IN_SECONDS), self::HOOK);
        }
    }

    /** @return array<string, mixed> */
    public function report(string $id, StatRange $range, string $today, ?string $since): array
    {
        $since = is_string($since) && preg_match('/^\d{4}-\d{2}-\d{2}$/D', $since) ? $since : null;
        $from = max($range->from, self::retainedFrom($today), $since ?? $range->from);
        // 101 products is an overflow sentinel. Never present a partial ranking as complete.
        $rows = $range->days() === 0 || $from > $range->to ? [] : $this->db->results(Connection::TABLE_STATS,
            'SELECT scope, SUM(CASE WHEN kind = %s THEN `count` ELSE 0 END) AS shown, SUM(CASE WHEN kind = %s THEN `count` ELSE 0 END) AS clicked, SUM(CASE WHEN kind = %s THEN `count` ELSE 0 END) AS added FROM %i WHERE optin_id = %s AND stat_date BETWEEN %s AND %s AND scope LIKE %s AND kind IN (%s, %s, %s) GROUP BY scope ORDER BY scope LIMIT 101',
            StatKind::ProductShown->value, StatKind::ProductClick->value, StatKind::CartAddition->value,
            $id, $from, $range->to, 'product:%', StatKind::ProductShown->value, StatKind::ProductClick->value, StatKind::CartAddition->value);
        $overflow = count($rows) > 100;
        $products = [];
        foreach ($overflow ? [] : $rows as $row) {
            if (!preg_match('/^product:([1-9][0-9]*)$/D', (string) $row['scope'], $match)) continue;
            $productId = (int) $match[1];
            $name = (string) apply_filters('wconvert_product_activity_name', '', $productId);
            $products[] = ['id' => $productId, 'name' => $name !== '' ? $name : sprintf(__('Unavailable product #%d', 'wconvert'), $productId),
                'shown' => (int) $row['shown'], 'clicked' => (int) $row['clicked'], 'added' => (int) $row['added']];
        }
        usort($products, static fn (array $a, array $b): int => ($b['added'] <=> $a['added']) ?: ($b['clicked'] <=> $a['clicked']) ?: ($b['shown'] <=> $a['shown']) ?: ($a['id'] <=> $b['id']));
        return ['rows' => $products, 'from' => $range->from, 'to' => $range->to, 'days' => $range->days(),
            'recorded_from' => $from <= $range->to && $range->days() > 0 ? $from : null, 'since' => $since,
            'retention_days' => self::RETENTION_DAYS, 'truncated' => $overflow,
            'available' => $since !== null || $rows !== [] || (bool) apply_filters('wconvert_product_activity_campaign', false, $id), 'collecting' => (bool) apply_filters('wconvert_commerce', false)];
    }
}

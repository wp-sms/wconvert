<?php

namespace WConvert\Pro;

defined('ABSPATH') || exit;

/**
 * Short-lived claims: a unique option that says "this happened once", taken
 * atomically by `add_option()` and swept later by one shared job.
 *
 * Revenue attribution claims a click and an order receipt; cart additions
 * claim an operation, its headline count and a per-session lock. Each claim
 * used to schedule its own expiry event, and those events all live in one
 * autoloaded `cron` option that WordPress rewrites whole on every change. A
 * busy store kept hundreds of them, and under twenty concurrent writers half
 * were lost to that read-modify-write. Their claims were never deleted, and
 * any other plugin's event scheduled in the same instant could be lost with
 * them (ADR 0141).
 *
 * So a claim schedules nothing of its own. **One sweep event exists while any
 * claim does**, and it is ranged by a MARK rather than a clock: when the sweep
 * is scheduled it records the highest `option_id` in the table, and when it
 * runs — a single event never runs early — it deletes only claims at or
 * below that mark. Every claim it removes therefore existed at least
 * {@see self::AGE} ago, which outlasts every claim's window: a click token is
 * two minutes, an attribution and an addition token thirty, plus a minute.
 *
 * The mark assumes `option_id` is never reused. MySQL 8 and MariaDB 10.2.4+
 * persist the auto-increment counter; MySQL 5.7 could hand out a lower id after
 * a restart that followed deleting the newest rows, and a claim taken then
 * could be swept before its hour.
 */
final class Claims
{
    public const HOOK = 'wconvert_claims_sweep';

    /** The highest `option_id` when the pending sweep was scheduled. */
    public const MARK = 'wconvert_claims_mark';

    public const AGE = HOUR_IN_SECONDS;

    /** The names, exactly; the SQL narrows by prefix and length (84 and 85) first. */
    private const PATTERN = '/^wconvert_(order|cart)_claim_[a-f0-9]{64}$/D';

    private const BATCH = 500;

    /** Twenty batches is 10,000 claims an hour before the sweep falls behind. */
    private const BATCHES = 20;

    public static function hooks(): void
    {
        add_action(self::HOOK, [self::class, 'sweep']);
    }

    /**
     * Take a claim once. `false` means it was already taken — or that storage
     * failed, which every caller treats the same way: no second credit.
     */
    public static function take(string $name, mixed $value): bool
    {
        if (!add_option($name, $value, '', false)) return false;
        if (!wp_next_scheduled(self::HOOK)) self::schedule(self::AGE);
        return true;
    }

    /** Delete every claim at or below the mark; schedule the next sweep if any remain. */
    public static function sweep(): void
    {
        global $wpdb;
        $mark = (int) get_option(self::MARK, 0);
        $batches = 0;
        do {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- a range over option_id that get_option() cannot express; each deleted name is evicted from the cache below.
            $found = $wpdb->get_col($wpdb->prepare(
                "SELECT option_name FROM {$wpdb->options} WHERE (option_name LIKE %s OR option_name LIKE %s) AND LENGTH(option_name) IN (84, 85) AND option_id <= %d LIMIT %d",
                $wpdb->esc_like('wconvert_order_claim_') . '%', $wpdb->esc_like('wconvert_cart_claim_') . '%', $mark, self::BATCH
            ));
            $names = array_values(array_filter($found, static fn ($name): bool => is_string($name) && preg_match(self::PATTERN, $name) === 1));
            if ($names !== []) {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- one placeholder per name, built from the count.
                $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name IN (" . implode(', ', array_fill(0, count($names), '%s')) . ')', ...$names));
                foreach ($names as $name) wp_cache_delete($name, 'options');
            }
        } while (count($found) === self::BATCH && ++$batches < self::BATCHES);

        // Behind: finish this mark soon rather than in an hour, keeping the mark.
        if (count($found) === self::BATCH) {
            if (!wp_next_scheduled(self::HOOK)) wp_schedule_single_event(time() + 5 * MINUTE_IN_SECONDS, self::HOOK);
            return;
        }
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- an existence probe over a name prefix.
        $left = $wpdb->get_var($wpdb->prepare(
            "SELECT 1 FROM {$wpdb->options} WHERE (option_name LIKE %s OR option_name LIKE %s) AND LENGTH(option_name) IN (84, 85) LIMIT 1",
            $wpdb->esc_like('wconvert_order_claim_') . '%', $wpdb->esc_like('wconvert_cart_claim_') . '%'
        ));
        // A sweep already pending was scheduled by a claim taken during this run,
        // and its mark is its own: moving it here could sweep that claim early.
        if (wp_next_scheduled(self::HOOK)) return;
        if ($left === null) delete_option(self::MARK);
        else self::schedule(self::AGE);
    }

    /**
     * Mark, then schedule. The mark only ever moves here, when no sweep is
     * pending, so a pending sweep never runs with a mark newer than itself.
     */
    private static function schedule(int $in): void
    {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- the primary key's maximum, read once per scheduling.
        update_option(self::MARK, (int) $wpdb->get_var("SELECT MAX(option_id) FROM {$wpdb->options}"), false);
        wp_schedule_single_event(time() + $in, self::HOOK);
    }
}

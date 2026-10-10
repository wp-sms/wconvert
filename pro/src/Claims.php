<?php

namespace WConvert\Pro;

defined('ABSPATH') || exit;

/**
 * Short-lived claims: a unique option that says "this happened once", taken
 * atomically and swept later by one shared job.
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
 * So a claim schedules nothing of its own. One sweep event exists while any
 * claim does, and it is ranged by a **mark**: the highest `option_id` in the
 * table, and the time it was read. A sweep deletes claims at or below the mark
 * only once the mark is {@see self::AGE} old, whoever runs it and however many
 * times — a duplicate cron runner, an event resurrected by another request's
 * stale `cron` write, or "Run now" in a cron manager. So every claim removed
 * existed for at least an hour, which outlasts every claim's window: two
 * minutes for a click, thirty for attribution, thirty-one for a cart token.
 *
 * The mark assumes `option_id` is never reused. MySQL 8 and MariaDB 10.2.4+
 * persist the auto-increment counter; MySQL 5.7 could hand out a lower id after
 * a restart that followed deleting the newest rows, and a claim taken then
 * could be swept before its hour.
 */
final class Claims
{
    public const HOOK = 'wconvert_claims_sweep';

    /** `{id, at}`: the highest `option_id` when it was read, and when that was. */
    public const MARK = 'wconvert_claims_mark';

    public const AGE = HOUR_IN_SECONDS;

    /** The names, exactly; the SQL narrows by prefix and length first. */
    private const PATTERN = '/^wconvert_(order|cart)_claim_[a-f0-9]{64}$/D';

    private const BATCH = 500;

    /** Twenty batches is 10,000 claims an hour before the sweep falls behind. */
    private const BATCHES = 20;

    public static function hooks(): void
    {
        add_action(self::HOOK, [self::class, 'sweep']);
        // A lost sweep event is restored by the next claim; on a site that takes
        // no more, core's daily cleanup is what still gets round to the rest.
        add_action('wp_scheduled_delete', [self::class, 'sweep']);
    }

    /**
     * Take a claim once. `false` means it was already taken, or that storage
     * failed — which every caller treats the same way: no second credit.
     *
     * `INSERT IGNORE` rather than `add_option()`, because `add_option()` ends
     * in `ON DUPLICATE KEY UPDATE`: two requests that both pass its existence
     * check both "add", and both return true.
     */
    public static function take(string $name, mixed $value): bool
    {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- an atomic insert-if-absent, which add_option() is not; the cache is cleared below.
        $taken = $wpdb->query($wpdb->prepare(
            "INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, 'off')",
            $name,
            maybe_serialize($value)
        )) === 1;
        if (!$taken) return false;
        wp_cache_delete($name, 'options');
        $missing = wp_cache_get('notoptions', 'options');
        if (is_array($missing) && isset($missing[$name])) {
            unset($missing[$name]);
            wp_cache_set('notoptions', $missing, 'options');
        }
        if (!wp_next_scheduled(self::HOOK)) self::schedule();
        return true;
    }

    /** Delete every claim at or below a mark that is an hour old; keep one sweep pending while any remain. */
    public static function sweep(): void
    {
        $mark = get_option(self::MARK);
        if (!is_array($mark) || !isset($mark['id'], $mark['at'])) {
            if (self::anyAbove(0)) self::schedule();
            return;
        }
        $due = (int) $mark['at'] + self::AGE;
        if (time() < $due) {
            if (!wp_next_scheduled(self::HOOK)) wp_schedule_single_event($due, self::HOOK);
            return;
        }
        if (!self::deleteUpTo((int) $mark['id'])) {
            // Behind: finish this mark soon rather than in an hour, keeping it.
            if (!wp_next_scheduled(self::HOOK)) wp_schedule_single_event(time() + 5 * MINUTE_IN_SECONDS, self::HOOK);
            return;
        }
        if (self::anyAbove((int) $mark['id'])) {
            self::mark();
            if (!wp_next_scheduled(self::HOOK)) wp_schedule_single_event(time() + self::AGE, self::HOOK);
        } else {
            delete_option(self::MARK);
        }
    }

    /** Schedule the sweep, keeping a mark that is still waiting and taking a new one otherwise. */
    private static function schedule(): void
    {
        $mark = get_option(self::MARK);
        $at = is_array($mark) && isset($mark['at']) ? (int) $mark['at'] : self::mark();
        wp_schedule_single_event(max(time() + MINUTE_IN_SECONDS, $at + self::AGE), self::HOOK);
    }

    /** Record the mark, and return when it was taken. */
    private static function mark(): int
    {
        global $wpdb;
        $at = time();
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- the primary key's maximum, read once per mark.
        update_option(self::MARK, ['id' => (int) $wpdb->get_var("SELECT MAX(option_id) FROM {$wpdb->options}"), 'at' => $at], false);
        return $at;
    }

    /**
     * Delete claims with ids at or below `$mark`, walking `option_id` so a row
     * that only looks like a claim is stepped over rather than read again.
     * `false` when the batches ran out before the mark did.
     */
    private static function deleteUpTo(int $mark): bool
    {
        global $wpdb;
        $after = 0;
        for ($batch = 0; $batch < self::BATCHES; $batch++) {
            $rows = self::candidates($after, $mark);
            if ($rows === []) return true;
            $after = (int) $rows[count($rows) - 1]['option_id'];
            $names = self::claimsIn($rows);
            if ($names !== []) {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- one placeholder per name, built from the count.
                $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name IN (" . implode(', ', array_fill(0, count($names), '%s')) . ')', ...$names));
                foreach ($names as $name) wp_cache_delete($name, 'options');
            }
            if (count($rows) < self::BATCH) return true;
        }
        return false;
    }

    /** Whether any claim is newer than `$id`. */
    private static function anyAbove(int $id): bool
    {
        do {
            $rows = self::candidates($id, PHP_INT_MAX);
            if (self::claimsIn($rows) !== []) return true;
            if ($rows !== []) $id = (int) $rows[count($rows) - 1]['option_id'];
        } while (count($rows) === self::BATCH);
        return false;
    }

    /**
     * @param list<array{option_id: string, option_name: string}> $rows
     * @return list<string>
     */
    private static function claimsIn(array $rows): array
    {
        return array_values(array_filter(array_column($rows, 'option_name'), static fn (string $name): bool => preg_match(self::PATTERN, $name) === 1));
    }

    /**
     * Rows after `$after`, up to `$upTo`, whose names could be claims. MySQL's
     * `LIKE` ignores case, so the exact test is {@see self::PATTERN}.
     *
     * @return list<array{option_id: string, option_name: string}>
     */
    private static function candidates(int $after, int $upTo): array
    {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- a range over option_id that get_option() cannot express.
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT option_id, option_name FROM {$wpdb->options} WHERE (option_name LIKE %s OR option_name LIKE %s) AND LENGTH(option_name) IN (84, 85) AND option_id > %d AND option_id <= %d ORDER BY option_id LIMIT %d",
            $wpdb->esc_like('wconvert_order_claim_') . '%',
            $wpdb->esc_like('wconvert_cart_claim_') . '%',
            $after,
            $upTo,
            self::BATCH
        ), ARRAY_A);
        /** @var list<array{option_id: string, option_name: string}> */
        return is_array($rows) ? $rows : [];
    }
}

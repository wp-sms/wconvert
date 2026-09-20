<?php

namespace WConvert\Database;

defined('ABSPATH') || exit;

/**
 * The narrow slice of `$wpdb` WConvert is allowed to use.
 *
 * **There is still no raw `query()`, and that absence is the point.** The
 * shape of the thing is the enforcement, so the day someone needs an operation
 * this cannot express they have to widen this interface, in a diff a reviewer
 * sees.
 *
 * That day came for `delete()`, and it came for the reason the rule was
 * written to allow: the personal-data eraser and the retention pruner both
 * remove [[Lead]] rows, and both of them removing rows rather than rewriting
 * them is what let ADR 0018 keep ADR 0002 whole (an anonymising eraser is an
 * update, and a Lead has no update path). {@see self::delete()} carries the
 * guard that keeps it from becoming the `query()` this interface refuses.
 *
 * It came a second time for {@see self::upsert()}, and the shape of that
 * widening is deliberately the same: one more named operation, one more prefix
 * guard, and a docblock saying which single statement it exists to express.
 * Analytics counts by `INSERT ... ON DUPLICATE KEY UPDATE`, which neither
 * `insert()` nor `update()` can say — and saying it as two calls would
 * reintroduce exactly the read-modify-write race the counter shape exists to
 * delete (ADR 0019). Two widenings on the same pattern is a pattern; the third
 * one should be read as pressure to stop rather than as precedent.
 *
 * **It was read that way, and the third widening did not happen.** The
 * analytics screen needs `wconvert_stats` interpreted through
 * `wconvert_optins`, which is two tables and therefore two `%i` — so it reads
 * them with two statements and joins them in PHP instead. A `JOIN` would have
 * denormalised a fact about tens of Optins onto thousands of counters to save
 * an array lookup, and it would have put half of one interpretation in SQL
 * while `Goal::headlineKind()` kept the other half (ADR 0034). The count of
 * widenings is still two.
 *
 * **An Optin is still never hard-deleted**, and no widening changes that:
 * analytics interprets its conversion counts by joining `wconvert_optins` at
 * report time, so a removed row makes every count referencing it
 * uninterpretable (ADR 0002, ADR 0020).
 * `tests/unit/Optin/OptinRepositoryTest.php` holds that line from the caller's
 * side, which is where it can now be held.
 *
 * **Every `$sql` here is a `literal-string`, and the table it reads is passed
 * separately** rather than interpolated into it. That makes an injected table
 * or column name unexpressible rather than merely discouraged: static analysis
 * rejects any SQL that a variable helped build, at the call site, before it
 * reaches a database. The `%i` identifier placeholder that makes this possible
 * was introduced in WordPress 6.2, before the current 6.8 minimum.
 *
 * @since 0.1.0
 */
interface Connection
{
    public const TABLE_OPTINS = 'wconvert_optins';

    /**
     * The [[Lead]] log. It takes inserts and nothing else — a Lead has no
     * lifecycle, so `update()` has no honest call site against this table, and
     * neither has `upsert()`, whose `ON DUPLICATE KEY UPDATE` half is an update
     * by another name (ADR 0002). `tests/unit/Lead/NoLeadIsEverUpdatedTest.php`
     * reads both trees and `bin/` for either method naming this table.
     */
    public const TABLE_LEADS = 'wconvert_leads';

    /**
     * The daily counters. One row per `(optin_id, stat_date, kind)`, and the
     * only write it ever takes is {@see self::upsert()} (ADR 0019).
     */
    public const TABLE_STATS = 'wconvert_stats';

    /**
     * @param literal-string $sql SQL whose table is the `%i` placeholder.
     * @param mixed ...$params
     * @return list<array<string, string|null>>
     */
    public function results(string $table, string $sql, ...$params): array;

    /**
     * @param literal-string $sql SQL whose table is the `%i` placeholder.
     * @param mixed ...$params
     * @return array<string, string|null>|null
     */
    public function row(string $table, string $sql, ...$params): ?array;

    /**
     * @param array<string, mixed> $data
     */
    public function insert(string $table, array $data): void;

    /**
     * @param array<string, mixed> $data
     * @param array<string, mixed> $where
     */
    public function update(string $table, array $data, array $where): void;

    /**
     * Remove rows.
     *
     * Spelled as SQL rather than as `$wpdb->delete()`'s equality-only `$where`
     * array because retention pruning is a RANGE — `WHERE id < %s` — which
     * that array cannot express at all. Taking the SQL keeps one method where
     * the alternative was two, and keeps the `literal-string` discipline every
     * other read here has: an injected column name stays unexpressible.
     *
     * **It is not `query()` wearing a narrower name.** Implementations must
     * refuse SQL that does not begin `DELETE FROM %i`, so the one operation
     * this interface deliberately cannot express — an `UPDATE` against a table
     * that has no update path — cannot be smuggled through it.
     *
     * @param literal-string $sql SQL beginning `DELETE FROM %i`.
     * @param mixed ...$params
     * @return int Rows removed.
     */
    public function delete(string $table, string $sql, ...$params): int;

    /**
     * Insert a row, or increment the one already there — one statement,
     * atomic at the database.
     *
     * **This is the whole of `wconvert_stats`' write path**, and it is a
     * method rather than a pair of calls because the pair is the bug. Reading
     * a count in PHP and writing it back is a read-modify-write with no row
     * lock: two beacons arriving in the same instant both read the same number
     * and both write the same successor, and one Conversion is gone. That race
     * is exactly the one ADR 0008 accepted for Destination health *because
     * health is advisory* — a conversion count is not, and the race eats the
     * most increments on the busiest sites, which is where the numbers matter
     * most (ADR 0019).
     *
     * `INSERT ... ON DUPLICATE KEY UPDATE` says it in one statement, so the
     * database holds the row lock for the whole of it and no increment can be
     * lost. That is a claim about MySQL rather than about this codebase, so it
     * is proven against MySQL: `bin/verify-stats.php` fires two of these
     * concurrently on two connections and asserts the count is two.
     *
     * **It is not `query()` wearing a narrower name.** Implementations must
     * refuse SQL that does not begin `INSERT INTO %i`, so the `UPDATE` this
     * interface deliberately cannot express against a table with no update
     * path stays unexpressible — the `ON DUPLICATE KEY UPDATE` clause can only
     * ever touch the row the same statement tried to insert.
     *
     * @param literal-string $sql SQL beginning `INSERT INTO %i`.
     * @param mixed ...$params
     */
    public function upsert(string $table, string $sql, ...$params): void;
}

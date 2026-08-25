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
 * is why the plugin requires WordPress 6.2.
 *
 * @since 0.1.0
 */
interface Connection
{
    public const TABLE_OPTINS = 'wconvert_optins';

    /**
     * The [[Lead]] log. It takes inserts and nothing else — a Lead has no
     * lifecycle, so `update()` has no honest call site against this table
     * (ADR 0002).
     */
    public const TABLE_LEADS = 'wconvert_leads';

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
}

<?php

namespace WConvert\Database;

defined('ABSPATH') || exit;

/**
 * The narrow slice of `$wpdb` WConvert is allowed to use.
 *
 * **There is no `delete()` and no raw `query()`, and both absences are the
 * point.** An Optin is never hard-deleted — analytics interprets its
 * conversion counts by joining `wconvert_optins` at report time, so a removed
 * row makes every count referencing it uninterpretable (ADR 0002, ADR 0020).
 * A comment cannot enforce that; an interface with no way to express it can.
 *
 * The same reasoning as `wconvert_leads` having no `status` column: the shape
 * of the thing is the enforcement, so the day someone needs the forbidden
 * operation they have to widen this interface, in a diff a reviewer sees.
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
}

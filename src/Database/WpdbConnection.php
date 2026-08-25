<?php

namespace WConvert\Database;

defined('ABSPATH') || exit;

/**
 * {@see Connection} over WordPress's `$wpdb`.
 *
 * The table name is prefixed here and handed to `$wpdb->prepare()` as a `%i`
 * identifier, so it is escaped by the same machinery that escapes values and
 * never concatenated into the query text.
 *
 * @since 0.1.0
 */
final class WpdbConnection implements Connection
{
    private \wpdb $wpdb;

    public function __construct(?\wpdb $wpdb = null)
    {
        if ($wpdb === null) {
            global $wpdb;
        }

        /** @var \wpdb $wpdb */
        $this->wpdb = $wpdb;
    }

    /**
     * @param literal-string $sql
     * @param mixed ...$params
     * @return list<array<string, string|null>>
     */
    public function results(string $table, string $sql, ...$params): array
    {
        /** @var list<array<string, string|null>> $rows */
        $rows = $this->wpdb->get_results($this->prepare($table, $sql, $params), ARRAY_A) ?: [];

        return $rows;
    }

    /**
     * @param literal-string $sql
     * @param mixed ...$params
     * @return array<string, string|null>|null
     */
    public function row(string $table, string $sql, ...$params): ?array
    {
        /** @var array<string, string|null>|null $row */
        $row = $this->wpdb->get_row($this->prepare($table, $sql, $params), ARRAY_A);

        return $row;
    }

    /**
     * @param array<string, mixed> $data
     */
    public function insert(string $table, array $data): void
    {
        $this->wpdb->insert($this->wpdb->prefix . $table, $data);
    }

    /**
     * @param array<string, mixed> $data
     * @param array<string, mixed> $where
     */
    public function update(string $table, array $data, array $where): void
    {
        $this->wpdb->update($this->wpdb->prefix . $table, $data, $where);
    }

    /**
     * @param literal-string $sql
     * @param array<array-key, mixed> $params
     */
    private function prepare(string $table, string $sql, array $params): string
    {
        return $this->wpdb->prepare($sql, $this->wpdb->prefix . $table, ...array_values($params));
    }
}

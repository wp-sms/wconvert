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
     * @param literal-string $sql SQL beginning `DELETE FROM %i`.
     * @param mixed ...$params
     */
    public function delete(string $table, string $sql, ...$params): int
    {
        // The guard that keeps {@see Connection::delete()} from being a raw
        // `query()` with a narrower name. It is a programmer error rather than
        // a runtime condition — PHPStan's `literal-string` means nothing a
        // variable helped build reaches here — so it throws rather than
        // returning a count nobody would read.
        if (!str_starts_with($sql, 'DELETE FROM %i')) {
            throw new \LogicException('WConvert\\Database\\Connection::delete() runs DELETE statements and nothing else.');
        }

        return (int) $this->wpdb->query($this->prepare($table, $sql, $params));
    }

    /**
     * The table, once per `%i` it is named by.
     *
     * The grouping view names it twice — it is two aggregates over one table,
     * unioned — and passing it once would leave the second `%i` to eat the
     * first value parameter. Repeating it here rather than at the call site
     * keeps the invariant this class exists for: the table is passed
     * separately and escaped by `prepare()`, never concatenated into the query
     * text.
     *
     * @param literal-string $sql
     * @param array<array-key, mixed> $params
     */
    private function prepare(string $table, string $sql, array $params): string
    {
        $tables = array_fill(0, substr_count($sql, '%i'), $this->wpdb->prefix . $table);

        return $this->wpdb->prepare($sql, ...$tables, ...array_values($params));
    }
}

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
     * @param literal-string $sql SQL beginning `INSERT INTO %i`.
     * @param mixed ...$params
     */
    public function upsert(string $table, string $sql, ...$params): void
    {
        // The same guard {@see self::delete()} carries, for the same reason:
        // this is one named operation, not a raw `query()`. A statement that
        // does not begin `INSERT INTO %i` is a statement this method has no
        // business running, and `ON DUPLICATE KEY UPDATE` can only touch the
        // row the insert itself collided with.
        if (!str_starts_with($sql, 'INSERT INTO %i')) {
            throw new \LogicException(
                'WConvert\\Database\\Connection::upsert() runs INSERT ... ON DUPLICATE KEY UPDATE and nothing else.'
            );
        }

        $this->wpdb->query($this->prepare($table, $sql, $params));
    }

    /**
     * @param literal-string $sql
     * @param array<array-key, mixed> $params
     */
    private function prepare(string $table, string $sql, array $params): string
    {
        return $this->wpdb->prepare($sql, ...self::bindings($sql, $this->wpdb->prefix . $table, $params));
    }

    /**
     * What `$wpdb->prepare()` wants, in the order it wants it.
     *
     * **`prepare()` binds by APPEARANCE, not by kind.** It walks the query and
     * consumes one argument per placeholder in the order they occur, so a
     * query naming its table more than once cannot be served by passing the
     * table first and the values after: the second `%i` takes whatever value
     * happened to be next.
     *
     * The grouping view names the table twice — it is two aggregates over one
     * table, unioned, so that each half can use its own index (ADR 0033) — and
     * its per-Optin form interleaves them as `%i, %s, %i, %s, %d`. Front-loaded,
     * that query filtered on the table name and then selected `FROM` an Optin
     * id. It failed loudly against a real database and silently against a fake
     * that ignores SQL text, which is why the check that caught it lives in
     * `bin/verify-lead-log.php` as well as here.
     *
     * Public because it is the one thing in this class that is not delegation,
     * and it is a fact about `$wpdb` rather than about WConvert — so it is
     * worth being able to assert without a database.
     *
     * `$sql` is a plain `string` here and a `literal-string` everywhere it can
     * reach a database. Nothing is executed in this method — it counts
     * placeholders and returns an array — so the constraint would buy no
     * safety, and it would stop a test reading a statement back off
     * {@see \WConvert\Tests\Unit\Support\FakeConnection} to check it.
     *
     * @param array<array-key, mixed> $params
     * @return list<mixed>
     */
    public static function bindings(string $sql, string $prefixedTable, array $params): array
    {
        $values = array_values($params);
        $bound = [];

        // `%%` is an escaped literal percent and no placeholder at all, so it
        // is removed before the count rather than matched around.
        preg_match_all('/%[sdfi]/', str_replace('%%', '', $sql), $placeholders);

        foreach ($placeholders[0] as $placeholder) {
            $bound[] = $placeholder === '%i' ? $prefixedTable : array_shift($values);
        }

        return $bound;
    }
}

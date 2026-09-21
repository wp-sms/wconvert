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
        // ====================================================================
        // WHY EVERY QUERY IN THIS CLASS CARRIES A `phpcs:ignore`.
        // ====================================================================
        // Not a disagreement with the sniff — `WordPress.DB.PreparedSQL` is
        // structurally unable to see the preparation that is here.
        //
        // **It matches the LITERAL VARIABLE `$wpdb`**: its test is
        // `'$wpdb' === $this->tokens[$this->i]['content']`. This class holds
        // the handle as `$this->wpdb`, so the sniff sees an unrecognised
        // method call on an unrecognised object and reports every argument of
        // it — `$this`, `prepare`, `$table`, `$sql`, `$params`, five findings
        // for one call — and it cannot step one frame into
        // {@see self::prepare()} to find the `$wpdb->prepare()` that is
        // actually there. WPCS publishes no property for naming a database
        // wrapper; it has `customCacheGetFunctions` and sanitizing and
        // escaping equivalents, and no database one.
        //
        // What is true instead, and where it is enforced:
        //
        //   1. **`$sql` is `literal-string`** on all four SQL-taking methods
        //      of {@see Connection}, so PHPStan rejects any query a variable
        //      helped build AT THE CALL SITE — the only place an injection
        //      could be introduced. All 22 of them pass a literal, a
        //      concatenation of literals with a `self::*_COLUMNS` constant, or
        //      a whole class constant; the one variable that appears
        //      ({@see \WConvert\Optin\OptinRepository::summaries()}) is a
        //      ternary over two literals.
        //   2. **The table never enters the query text.** It is passed
        //      separately and bound as `%i` by {@see self::prepare()} — the
        //      same machinery that escapes the values.
        //   3. **Every value is bound.** There is no path through this class
        //      that reaches the database without `$wpdb->prepare()`.
        //
        // Restructuring cannot fix it. Inlining `$this->wpdb->prepare(...)` at
        // each call still fails, because the sniff wants the literal `$wpdb`
        // and not a property. Writing `global $wpdb;` in each method would
        // satisfy it, at the cost of the injectable constructor three tests
        // and both `bin/verify-lead-log.php` and `bin/verify-stats.php` pass a
        // handle through. And inlining `prepare()` would make four copies of
        // the {@see self::bindings()} splat — the logic whose binding-order
        // bug once made a query filter on the table name and select `FROM` an
        // Optin id.
        //
        // So it is suppressed per line, each carrying its reason, rather than
        // by an `--ignore-codes` list on the checker. ADR 0029 refuses that
        // list: a gate with an exception file is a gate that quietly grows
        // one. This is its opposite — local, visible at the line, and read in
        // place by the reviewer who asks this same question next.
        /** @var list<array<string, string|null>>|null $rows */
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- prepare() binds every value through $wpdb->prepare() and the table as %i; the sniff cannot see it. See the note above.
        $rows = $this->wpdb->get_results($this->prepare($table, $sql, $params), ARRAY_A);

        $this->assertSucceeded($rows);

        return $rows ?? [];
    }

    /**
     * @param literal-string $sql
     * @param mixed ...$params
     * @return array<string, string|null>|null
     */
    public function row(string $table, string $sql, ...$params): ?array
    {
        /** @var array<string, string|null>|null $row */
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- prepare() binds every value through $wpdb->prepare() and the table as %i; the sniff cannot see it. See the note in results().
        $row = $this->wpdb->get_row($this->prepare($table, $sql, $params), ARRAY_A);

        $this->assertSucceeded($row);

        return $row;
    }

    /**
     * @param array<string, mixed> $data
     */
    public function insert(string $table, array $data): void
    {
        $this->assertSucceeded($this->wpdb->insert($this->wpdb->prefix . $table, $data));
    }

    /**
     * @param array<string, mixed> $data
     * @param array<string, mixed> $where
     */
    public function update(string $table, array $data, array $where): void
    {
        $this->assertSucceeded($this->wpdb->update($this->wpdb->prefix . $table, $data, $where));
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

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- prepare() binds every value through $wpdb->prepare() and the table as %i; the sniff cannot see it. See the note in results().
        $deleted = $this->wpdb->query($this->prepare($table, $sql, $params));

        $this->assertSucceeded($deleted);

        return (int) $deleted;
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

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- prepare() binds every value through $wpdb->prepare() and the table as %i; the sniff cannot see it. See the note in results().
        $this->assertSucceeded($this->wpdb->query($this->prepare($table, $sql, $params)));
    }

    /**
     * `$wpdb` reports database errors through `false` and `last_error` rather
     * than exceptions. Keep that WordPress-specific contract behind this
     * adapter so callers cannot mistake a rejected write for success or an
     * errored read for an empty result.
     *
     * The exception is deliberately generic: `$wpdb->last_error` and the SQL
     * can contain captured values, and neither belongs in a public REST error
     * or an uncaught exception rendered by a debug-enabled site.
     */
    private function assertSucceeded(mixed $result): void
    {
        if ($result === false || $this->wpdb->last_error !== '') {
            throw new DatabaseException('WConvert could not complete a database operation.');
        }
    }

    /**
     * @param literal-string $sql
     * @param array<array-key, mixed> $params
     */
    private function prepare(string $table, string $sql, array $params): string
    {
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- this IS the $wpdb->prepare() the sniff asks for; it flags $sql only because the call is on a property. $sql is literal-string. See the note in results().
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

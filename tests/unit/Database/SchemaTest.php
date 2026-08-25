<?php

namespace WConvert\Tests\Unit\Database;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Database\Schema;

/**
 * The DDL, guarded on the two things about it that are decisions rather than
 * syntax.
 *
 * **The missing columns.** `wconvert_leads` has no `status` and no
 * `updated_at`, and their absence is the enforcement mechanism, not an
 * oversight (ADR 0002): a row with no mutable state cannot acquire a lifecycle
 * without a migration a reviewer will see. A comment cannot enforce that. This
 * can — and it is what turns "do not fix this" from a request into a failing
 * build.
 *
 * **The unaligned columns.** dbDelta splits each column line on whitespace, so
 * padding the type column into a neat block breaks its field-type parser —
 * WSMS's aligned DDL produced 142 false "changed type" diffs on a healthy
 * schema and forced a 324-line SchemaDoctor to undo the damage (ADR 0001). The
 * tidy-up that causes it is a one-keystroke reformat nobody would flag in
 * review, which is exactly why it is asserted here.
 *
 * **The indexes, per table, against a signed-off budget.** This file used to
 * assert that `wconvert_leads` shipped two and no more, which held that one
 * table's line and quietly exempted every table added after it — and an index
 * is schema, so an index needs a yes (CLAUDE.md, Database changes). The budget
 * below is now a MAP, and {@see self::testEveryTableInTheDdlHasASignedOffIndexBudget()}
 * fails on a table that is not in it. A new table therefore cannot be added
 * without someone writing down how many indexes it was allowed.
 */
#[CoversClass(Schema::class)]
final class SchemaTest extends TestCase
{
    private const PREFIX = 'wp_';

    /**
     * How many secondary indexes each table was signed off for.
     *
     * `KEY` lines only — a `PRIMARY KEY` is not a secondary index and is
     * counted nowhere here. Every number is a decision with a ticket behind it:
     *
     * - **`wconvert_optins`, one.** `idx_goal`, because the Optin list and the
     *   per-Goal metrics both filter on it (#2).
     * - **`wconvert_leads`, two.** `idx_email` and `idx_phone` are the identity
     *   keys, and #25 wrote the per-Optin listing and the retention prune
     *   without adding a third: the prune is a range over the primary key, the
     *   listing walks that key backwards under a LIMIT, and the grouping view
     *   is two aggregates that each use an index already here (ADR 0033). An
     *   index is paid on every capture and read by one admin on demand.
     * - **`wconvert_stats`, none.** The composite primary key IS the mechanism —
     *   it makes the upsert atomic. This used to add that the key "already
     *   serves the dashboard's only query shape: an id set, a date range,
     *   grouped by kind. A secondary index here would be paid on every beacon
     *   for a query nobody issues." #28 issued it, and it is neither: it is a
     *   date range across every Optin, which cannot use a key with `optin_id`
     *   leftmost and is a scan. The number stays zero on the ASYMMETRY rather
     *   than on the access path — ~29k rows a year, capped to one year by
     *   `StatRange::MAX_DAYS`, against an index paid on every beacon for a read
     *   one admin takes on demand (ADR 0019, ADR 0034).
     */
    private const INDEX_BUDGET = [
        'wconvert_optins' => 1,
        'wconvert_leads' => 2,
        'wconvert_stats' => 0,
    ];

    private static function ddl(): string
    {
        return Schema::sql(self::PREFIX, 'DEFAULT CHARACTER SET utf8mb4');
    }

    /**
     * Every table the DDL declares, unprefixed and in the order it declares
     * them.
     *
     * Read out of the SQL rather than listed here, so a table added to
     * {@see Schema} and to nothing else still reaches every assertion in this
     * file. That is the difference between a rule about the schema and a rule
     * about the three tables somebody remembered.
     *
     * @return list<string>
     */
    private static function tablesInDdl(): array
    {
        preg_match_all('/CREATE TABLE ' . self::PREFIX . '(\w+) \(/', self::ddl(), $matches);

        return $matches[1];
    }

    /** The DDL of one table, from its `CREATE TABLE` to its closing paren. */
    private static function bodyOf(string $table): string
    {
        $ddl = self::ddl();
        $start = strpos($ddl, "CREATE TABLE {$table} (");

        self::assertNotFalse($start, "the DDL declares {$table}");

        $body = substr($ddl, $start);

        return substr($body, 0, (int) strpos($body, "\n)"));
    }

    /**
     * Every column line of one table, with the `CREATE TABLE`, the keys and
     * the closing line dropped.
     *
     * @return list<string>
     */
    private static function columnsOf(string $table): array
    {
        $body = self::bodyOf($table);
        $body = substr($body, (int) strpos($body, "(\n") + 2);

        return array_values(array_filter(
            explode("\n", $body),
            static fn (string $line): bool => !str_starts_with($line, 'PRIMARY KEY')
                && !str_starts_with($line, 'KEY')
                && !str_starts_with($line, 'UNIQUE KEY')
        ));
    }

    /**
     * @return list<string>
     */
    private static function columnNamesOf(string $table): array
    {
        return array_map(
            static fn (string $line): string => strtok($line, ' ') ?: '',
            self::columnsOf($table)
        );
    }

    public function testTheLeadLogCarriesTheApprovedShapeAndNothingElse(): void
    {
        $this->assertSame(
            ['id', 'optin_id', 'email', 'phone', 'fields', 'created_at'],
            self::columnNamesOf(self::PREFIX . 'wconvert_leads')
        );
    }

    /**
     * The one assertion in this file that is a domain rule rather than a
     * shape. Any feature that wants to give a Lead a lifecycle is the signal
     * WConvert is drifting into being a second contact database
     * (CONTEXT.md, Lead), and these two columns are where that arrives.
     */
    public function testALeadHasNoMutableState(): void
    {
        $columns = self::columnNamesOf(self::PREFIX . 'wconvert_leads');

        $this->assertNotContains('status', $columns, 'ADR 0002: a Lead has no lifecycle to hold a status');
        $this->assertNotContains('updated_at', $columns, 'ADR 0002: a Lead is never updated, so nothing stamps one');
    }

    /**
     * The identity keys are real indexed columns because grouping the log
     * pivots on them, and WSMS's `ContactRepository::create()` hard-requires
     * one of the two (ADR 0002). Everything else the Optin captured goes in
     * one `fields` JSON.
     */
    public function testTheIdentityKeysAreIndexedAndEverythingElseIsOneJsonColumn(): void
    {
        $ddl = self::ddl();

        $this->assertStringContainsString('KEY idx_email (email)', $ddl);
        $this->assertStringContainsString('KEY idx_phone (phone)', $ddl);
        $this->assertStringContainsString('fields LONGTEXT', $ddl);
    }

    /**
     * **No table ships an index no ticket asked for.**
     *
     * The lead log's two were the original subject of this assertion — it lists
     * newest-first off the ULID primary key, and the covering indexes a bulk
     * re-push would want belong to the ticket that writes those queries (#30)
     * and to the sign-off it gets. Every table is measured the same way now,
     * because the rule was never about the lead log; it was about an index
     * being paid on every write and read on demand.
     */
    public function testNoTableShipsAnIndexNoTicketAskedFor(): void
    {
        foreach (self::INDEX_BUDGET as $table => $budget) {
            $this->assertSame(
                $budget,
                substr_count(self::bodyOf(self::PREFIX . $table), "\nKEY "),
                "{$table} ships exactly the indexes it was signed off for"
            );
        }
    }

    /**
     * **And a table nobody wrote a budget for fails.**
     *
     * This is the assertion that keeps the one above from decaying into a rule
     * about three particular tables. Adding a table to {@see Schema} without
     * adding a line to {@see self::INDEX_BUDGET} fails here — which forces the
     * question "how many indexes, and why" to be answered in a diff rather than
     * skipped by default. #26 is the ticket that made it necessary: it added
     * the first new table since the rule was written, and the rule did not
     * reach it.
     */
    public function testEveryTableInTheDdlHasASignedOffIndexBudget(): void
    {
        $this->assertSame(
            array_keys(self::INDEX_BUDGET),
            self::tablesInDdl(),
            'a table in the DDL with no entry in INDEX_BUDGET is a table whose indexes nobody signed off'
        );
    }

    /**
     * The daily counters, exactly as ADR 0019 argues them.
     *
     * **No surrogate `id`.** The composite key is the mechanism rather than
     * decoration: it is what makes `INSERT ... ON DUPLICATE KEY UPDATE` atomic,
     * and a surrogate would make the upsert collide with nothing and express
     * nothing. **No `goal`, no `had_email`, no `had_phone`, no display type** —
     * everything needed to interpret a row is read from `wconvert_optins` at
     * report time, which is never erased and only ever soft-deleted (ADR 0020).
     */
    public function testTheCountersCarryTheApprovedShapeAndNothingElse(): void
    {
        $columns = self::columnNamesOf(self::PREFIX . 'wconvert_stats');

        $this->assertSame(['optin_id', 'stat_date', 'kind', 'count'], $columns);
        $this->assertNotContains('id', $columns, 'ADR 0019: the composite key is the key; there is no surrogate');
        $this->assertNotContains('goal', $columns, 'ADR 0020: a Goal is read at report time, never frozen on a row');
        $this->assertNotContains('had_email', $columns, 'ADR 0020: interpreted at read');
        $this->assertNotContains('had_phone', $columns, 'ADR 0020: interpreted at read');
    }

    /**
     * The key itself, in the order that serves the read.
     *
     * `(optin_id, stat_date, kind)` and not any permutation of the three. A
     * leftmost prefix of a composite key is the only part of it a range scan
     * can use, and the dashboard's one query is an id set over a date range —
     * so `optin_id` first, `stat_date` second, and `kind` last because it is
     * the axis the result is grouped BY rather than filtered on.
     */
    public function testTheCountersAreKeyedForTheOneQueryTheyServe(): void
    {
        $this->assertStringContainsString(
            'PRIMARY KEY  (optin_id,stat_date,kind)',
            self::bodyOf(self::PREFIX . 'wconvert_stats')
        );
    }

    /**
     * `stat_date` is a `DATE` and `count` is `INT UNSIGNED`.
     *
     * A `DATETIME` would be the intra-day timestamp the whole shape exists to
     * not store, and it would silently make the primary key one row per second
     * rather than one row per day — the difference between ~29k rows a year and
     * ~3.65M (ADR 0019). `INT UNSIGNED` because 4.29 billion of one kind on one
     * Optin in one day is not a number to plan for, and a signed one would
     * spend a bit on a negative count that cannot happen.
     */
    public function testACounterIsADayAndAnUnsignedCount(): void
    {
        $body = self::bodyOf(self::PREFIX . 'wconvert_stats');

        $this->assertStringContainsString('stat_date DATE NOT NULL', $body);
        $this->assertStringNotContainsString('DATETIME', $body);
        $this->assertStringContainsString('count INT UNSIGNED NOT NULL', $body);
    }

    /**
     * **Never unique.** Leads are never deduplicated — one person submitting
     * two forms did two things and produces two rows (ADR 0021) — so a UNIQUE
     * index on either identity key would make the second submission fail at
     * the database. WSMS's `wsms_contacts` does declare them unique, correctly,
     * because a [[Contact]] is an entity and a Lead is an event.
     */
    public function testTheIdentityKeyIndexesAreNotUnique(): void
    {
        $this->assertStringNotContainsString('UNIQUE', self::ddl());
    }

    public function testEveryColumnLineIsUnalignedSoDbDeltaCanParseIt(): void
    {
        foreach (self::tablesInDdl() as $table) {
            foreach (self::columnsOf(self::PREFIX . $table) as $line) {
                $this->assertDoesNotMatchRegularExpression(
                    '/\s{2,}/',
                    $line,
                    sprintf('ADR 0001: dbDelta splits on whitespace, so "%s" must not be padded', $line)
                );
            }
        }
    }

    /**
     * dbDelta's own documentation requires exactly this spelling, two spaces
     * and all. It is the one place in the DDL where the padding is load-bearing.
     */
    public function testEveryPrimaryKeyKeepsItsTwoSpaces(): void
    {
        $ddl = self::ddl();

        // Counted against the number of tables rather than against a literal,
        // so the assertion follows the schema instead of having to be nudged
        // every time it grows.
        $this->assertSame(count(self::tablesInDdl()), substr_count($ddl, 'PRIMARY KEY  ('));
        $this->assertSame(
            substr_count($ddl, 'PRIMARY KEY'),
            substr_count($ddl, 'PRIMARY KEY  ('),
            'every PRIMARY KEY keeps the two spaces dbDelta documents, not just the first one'
        );
    }
}

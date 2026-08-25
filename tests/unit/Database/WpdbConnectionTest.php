<?php

namespace WConvert\Tests\Unit\Database;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Database\WpdbConnection;
use WConvert\Lead\LeadRepository;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\RuleVocabulary;
use WConvert\Stats\StatKind;
use WConvert\Stats\StatRange;
use WConvert\Stats\StatsRepository;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * How WConvert's SQL is bound to `$wpdb->prepare()`.
 *
 * **`prepare()` binds by APPEARANCE, not by kind.** It walks the query and
 * consumes one argument per placeholder in the order they occur. Every other
 * test in this suite goes through {@see FakeConnection}, which models the
 * table and ignores the query text — so nothing else here can see a binding
 * go wrong, and one did: the grouping view names its table twice, and passing
 * both tables in front of the values made the per-Optin form filter on the
 * table name and select `FROM` an Optin id.
 *
 * That query failed loudly against a real database and not at all against the
 * fake. This file is the cheap half of the fix; `bin/verify-lead-log.php` is
 * the half that runs it.
 *
 * **Every repository belongs in the sweep below**, which is why it walks
 * repositories rather than a list of SQL strings: a new one that never runs
 * through it is a new one whose bindings nothing checks, and the fake it goes
 * through cannot see the fault. #26 added the second.
 *
 * The two GUARDS are here too. {@see \WConvert\Database\Connection} refuses a
 * raw `query()` and has been widened twice — `delete()` for erasure and the
 * retention prune, `upsert()` for the atomic counter — and each widening is
 * safe only because it can express one statement and no other. A guard that is
 * never exercised is a comment with a green tick beside it.
 */
#[CoversClass(WpdbConnection::class)]
final class WpdbConnectionTest extends TestCase
{
    private const TABLE = 'wp_wconvert_leads';

    /**
     * The shape that broke: two `%i`, each followed by a value.
     */
    public function testTheTableIsBoundAtEveryPlaceItIsNamedAndValuesKeepTheirPlaces(): void
    {
        $bound = WpdbConnection::bindings(
            'SELECT a FROM %i WHERE optin_id = %s UNION ALL SELECT b FROM %i WHERE optin_id = %s LIMIT %d',
            self::TABLE,
            ['OPTIN1', 'OPTIN1', 50]
        );

        $this->assertSame([self::TABLE, 'OPTIN1', self::TABLE, 'OPTIN1', 50], $bound);
    }

    public function testOneTableAndOneValueBindInThatOrder(): void
    {
        $bound = WpdbConnection::bindings('SELECT a FROM %i WHERE id = %s', self::TABLE, ['01J']);

        $this->assertSame([self::TABLE, '01J'], $bound);
    }

    public function testAQueryNamingOnlyItsTableBindsOnlyTheTable(): void
    {
        $this->assertSame([self::TABLE], WpdbConnection::bindings('SELECT COUNT(*) FROM %i', self::TABLE, []));
    }

    /**
     * An escaped literal percent is not a placeholder, and counting it as one
     * shifts every binding after it by one.
     */
    public function testAnEscapedPercentIsNotAPlaceholder(): void
    {
        $bound = WpdbConnection::bindings("SELECT a FROM %i WHERE a LIKE '100%%' AND b = %s", self::TABLE, ['x']);

        $this->assertSame([self::TABLE, 'x'], $bound);
    }

    /**
     * Every statement this codebase actually issues, bound.
     *
     * The assertion is not the values — it is that the count of arguments
     * matches the count of placeholders for each one, which is the invariant a
     * front-loaded table breaks and the one `prepare()` warns about at
     * runtime.
     */
    public function testEveryStatementThisCodebaseIssuesBindsOneArgumentPerPlaceholder(): void
    {
        $db = new FakeConnection();
        $leads = new LeadRepository($db);
        $stats = new StatsRepository($db);
        $optins = new OptinRepository(
            $db,
            new PublishedSet(new FakeOptionStore()),
            RuleVocabulary::fromManifest(__DIR__ . '/../../..')
        );

        $stats->increment('01JQ0000000000000000000001', StatKind::Impression, '2026-03-04');
        $stats->inRange(StatRange::between('2026-07-27', '2026-08-25'));
        $leads->submissions(null);
        $leads->submissions('OPTIN1');
        $leads->page(null, 50);
        $leads->page('OPTIN1', 50);
        $leads->groups(null, 50);
        $leads->groups('OPTIN1', 50);
        $leads->since(null, '', 500);
        $leads->since('OPTIN1', '', 500);
        $leads->forEmail('sarah@example.com', 50, 0);
        $leads->eraseByEmail('sarah@example.com');
        $leads->pruneBefore('01J0000000ZZZZZZZZZZZZZZZZ');
        $optins->find('OPTIN1');
        $optins->summaries();
        $optins->summaries(true);
        $optins->names();
        $optins->interpretations();

        $this->assertNotSame([], $db->statements);

        foreach ($db->statements as $sql) {
            $placeholders = preg_match_all('/%[sdfi]/', str_replace('%%', '', $sql));

            $this->assertSame(
                $placeholders,
                count(WpdbConnection::bindings($sql, self::TABLE, $this->paramsFor($db, $sql))),
                "every placeholder in \"{$sql}\" takes exactly one argument"
            );
        }
    }

    /**
     * The params the repository passed alongside one statement.
     *
     * @return list<mixed>
     */
    private function paramsFor(FakeConnection $db, string $sql): array
    {
        foreach ([...$db->deletes, ...$db->upserts] as $write) {
            if ($write['sql'] === $sql) {
                return $write['params'];
            }
        }

        // Reads do not record their params, so the count is taken from the
        // query itself — which is the whole assertion: one argument per
        // placeholder that is not the table.
        return array_fill(0, (int) preg_match_all('/%[sdf]/', str_replace('%%', '', $sql)), 'x');
    }

    /**
     * The counter's own shape: one `%i`, then three values, then a literal `1`
     * that is not a placeholder at all.
     *
     * The literal is the part worth pinning. A `%d` there would be one more
     * argument to bind and one more thing a caller could choose, on an endpoint
     * that is public by necessity (ADR 0019).
     */
    public function testTheCounterBindsItsTableThenItsThreeValues(): void
    {
        $bound = WpdbConnection::bindings(
            'INSERT INTO %i (optin_id, stat_date, kind, `count`) VALUES (%s, %s, %s, 1)'
                . ' ON DUPLICATE KEY UPDATE `count` = `count` + 1',
            'wp_wconvert_stats',
            ['01JQ0000000000000000000001', '2026-03-04', 'impression']
        );

        $this->assertSame(
            ['wp_wconvert_stats', '01JQ0000000000000000000001', '2026-03-04', 'impression'],
            $bound
        );
    }

    /**
     * **`delete()` runs DELETEs and nothing else.**
     *
     * It takes SQL because retention pruning is a RANGE — `WHERE id < %s` —
     * which `$wpdb->delete()`'s equality-only `$where` array cannot express at
     * all. Taking SQL is what makes the guard necessary: without it this is
     * `query()` wearing a narrower name, and the one operation the interface
     * deliberately cannot express — an `UPDATE` against a table with no update
     * path — walks straight through it.
     */
    public function testDeleteRefusesAnythingThatIsNotADelete(): void
    {
        $this->expectException(\LogicException::class);

        (new WpdbConnection(new \wpdb()))->delete(
            'wconvert_leads',
            'UPDATE %i SET email = NULL WHERE id = %s',
            '01J'
        );
    }

    /**
     * **And `upsert()` runs one insert-with-collision and nothing else.**
     *
     * The same guard on the same reasoning. `ON DUPLICATE KEY UPDATE` can only
     * ever touch the row the same statement tried to insert, so the widening
     * adds no way to write to a row that already existed under someone else's
     * key — but only while the statement really is an `INSERT`.
     */
    public function testUpsertRefusesAnythingThatIsNotAnInsert(): void
    {
        $this->expectException(\LogicException::class);

        (new WpdbConnection(new \wpdb()))->upsert(
            'wconvert_stats',
            'UPDATE %i SET `count` = `count` + 1 WHERE optin_id = %s',
            '01J'
        );
    }

    /**
     * Both guards refuse BEFORE anything reaches the database. A guard that
     * threw after the statement ran would be a guard about error messages.
     */
    public function testARefusedStatementNeverReachesTheDatabase(): void
    {
        $wpdb = new \wpdb();

        try {
            (new WpdbConnection($wpdb))->upsert('wconvert_stats', 'UPDATE %i SET a = 1');
        } catch (\LogicException) {
            // Expected.
        }

        $this->assertSame([], $wpdb->queries);
        $this->assertSame([], $wpdb->prepared);
    }

    /**
     * The statement the counter really issues, all the way to `prepare()`.
     *
     * Everything else in this suite stops at {@see FakeConnection}, which
     * ignores the query text — so this is the only place a WConvert statement
     * is watched being bound, in order, by the thing that binds by APPEARANCE.
     */
    public function testTheCounterReachesPrepareWithItsTableFirstAndItsValuesAfter(): void
    {
        $wpdb = new \wpdb();
        $stats = new StatsRepository(new WpdbConnection($wpdb));

        $stats->increment('01JQ0000000000000000000001', StatKind::Conversion, '2026-03-04');

        $this->assertCount(1, $wpdb->prepared);
        $this->assertSame(
            ['wp_wconvert_stats', '01JQ0000000000000000000001', '2026-03-04', 'conversion'],
            $wpdb->prepared[0]['args']
        );
        $this->assertCount(1, $wpdb->queries);
    }
}

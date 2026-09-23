<?php

namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Database\Connection;
use WConvert\Stats\StatKind;
use WConvert\Stats\StatRange;
use WConvert\Stats\StatsRepository;
use WConvert\Tests\Unit\Support\FakeConnection;

/**
 * The one write, and the statement it issues.
 *
 * ============================================================================
 * THIS FILE CANNOT PROVE THE COUNTING, AND DOES NOT TRY.
 * ============================================================================
 * {@see FakeConnection} records the upsert and does not apply it, deliberately:
 * a fake that added up the increments itself would be the authority on what
 * `ON DUPLICATE KEY UPDATE` does, and the tests would then agree with that file
 * rather than with MySQL. The atomicity is the whole justification for the
 * table's shape, so it is proven where it can be — `bin/verify-stats.php`
 * fires two increments concurrently on two connections against a real MySQL,
 * and includes a deliberate read-modify-write control that loses one, so the
 * check is known to be able to fail.
 *
 * What is provable here is the statement: that it is ONE, that it is an upsert
 * rather than an insert-then-update, that the count is a literal `1` rather
 * than anything a caller passed, and that nothing else in this repository can
 * write to the table.
 */
#[CoversClass(StatsRepository::class)]
final class StatsRepositoryTest extends TestCase
{
    private const OPTIN = '01JQ0000000000000000000001';

    private FakeConnection $db;

    private StatsRepository $stats;

    protected function setUp(): void
    {
        $this->db = new FakeConnection();
        $this->stats = new StatsRepository($this->db);
    }

    public function testCountingAnActIsOneStatementAgainstTheCounters(): void
    {
        $this->stats->increment(self::OPTIN, StatKind::Impression, '2026-03-04');

        $this->assertCount(1, $this->db->upserts);
        $this->assertCount(1, $this->db->statements);
        $this->assertSame(Connection::TABLE_STATS, $this->db->upserts[0]['table']);
    }

    /**
     * **An upsert, not an insert and then an update.**
     *
     * Two statements would be a read-modify-write with a race between them,
     * which is exactly what the composite primary key exists to make
     * unnecessary (ADR 0019). The `%i` is the table, bound by
     * {@see \WConvert\Database\WpdbConnection}, so the name is escaped by the
     * same machinery that escapes values and never concatenated in.
     */
    public function testTheStatementIsASingleAtomicUpsert(): void
    {
        $this->stats->increment(self::OPTIN, StatKind::Conversion, '2026-03-04');

        $sql = $this->db->upserts[0]['sql'];

        $this->assertStringStartsWith('INSERT INTO %i', $sql);
        $this->assertStringContainsString('ON DUPLICATE KEY UPDATE', $sql);
        $this->assertStringContainsString('`count` = `count` + 1', $sql);
    }

    /**
     * **The increment is a literal one, and nothing reaches it from outside.**
     *
     * The endpoint is public, so a count a caller could influence is a count a
     * caller could set — and the counters can never be recomputed, so a wrong
     * number is wrong permanently (ADR 0019).
     */
    public function testTheIncrementIsAlwaysOne(): void
    {
        $this->stats->increment(self::OPTIN, StatKind::Dismiss, '2026-03-04');

        $this->assertStringContainsString('VALUES (%s, %s, %s, %s, 1)', $this->db->upserts[0]['sql']);
        $this->assertSame([self::OPTIN, '2026-03-04', 'dismiss', ''], $this->db->upserts[0]['params']);
    }

    /**
     * The date is HANDED IN. This class has no clock and no timezone, which is
     * what makes "the site's day" one question answered once at the request
     * boundary rather than a stub every test has to agree with
     * ({@see \WConvert\Stats\StatDay}).
     */
    public function testTheDayIsWhateverItWasGiven(): void
    {
        $this->stats->increment(self::OPTIN, StatKind::Impression, '2026-12-31');

        $this->assertSame('2026-12-31', $this->db->upserts[0]['params'][1]);
    }

    /**
     * The kind travels as its own string, so what lands in the column is the
     * enum's value and never a case name.
     */
    public function testEveryKindWritesItsOwnValue(): void
    {
        foreach (StatKind::cases() as $kind) {
            $this->stats->increment(self::OPTIN, $kind, '2026-03-04');
        }

        $this->assertSame(
            ['impression', 'screen_shown', 'screen_advanced', 'screen_skipped', 'screen_dismissed', 'conversion', 'dismiss', 'lead_magnet_delivered'],
            array_map(static fn (array $upsert): string => (string) $upsert['params'][2], $this->db->upserts)
        );
    }

    /**
     * **No insert, no update, no delete.** The upsert is the only write this
     * table takes, and a second write path would be a second place for the
     * count to be wrong (ADR 0019).
     */
    public function testNothingElseWritesToTheCounters(): void
    {
        $this->stats->increment(self::OPTIN, StatKind::Impression, '2026-03-04');

        $this->assertSame([], $this->db->writes);
        $this->assertSame([], $this->db->deletes);
        $this->assertSame([], $this->db->reads);
    }

    /**
     * ========================================================================
     * THE FIRST READ THIS TABLE HAS EVER TAKEN.
     * ========================================================================
     * One table and one statement. The [[Goal]] that gives these rows meaning
     * lives in `wconvert_optins` and is read separately, then applied in PHP
     * by {@see \WConvert\Stats\Dashboard} — so there is no `JOIN` here, and
     * {@see \WConvert\Database\Connection} was not widened a third time to
     * express one (ADR 0034).
     */
    public function testTheDashboardsReadIsOneStatementAgainstOneTable(): void
    {
        $this->stats->inRange(StatRange::lastDays(30, '2026-08-25'));

        $this->assertCount(1, $this->db->reads);
        $this->assertSame(Connection::TABLE_STATS, $this->db->reads[0]['table']);
        $this->assertStringNotContainsString('JOIN', $this->db->reads[0]['sql']);
        $this->assertSame(1, substr_count($this->db->reads[0]['sql'], '%i'), 'one table, named once');
    }

    /**
     * It selects the four columns the counters have and nothing wider. There
     * is nothing else on the row, but `SELECT *` would stop saying so.
     */
    public function testItProjectsTheFourColumnsAndBackticksTheOneThatIsAlsoAFunction(): void
    {
        $this->stats->inRange(StatRange::lastDays(30, '2026-08-25'));

        $sql = $this->db->reads[0]['sql'];

        $this->assertStringContainsString('SELECT optin_id, stat_date, kind, `count` FROM %i', $sql);
        $this->assertStringNotContainsString('*', $sql);
    }

    /**
     * The window's ends are BOUND, in the order they appear —
     * {@see \WConvert\Database\WpdbConnection::bindings()} binds by
     * appearance, and this statement names its table once and then two values.
     */
    public function testTheWindowIsBoundRatherThanInterpolated(): void
    {
        $this->stats->inRange(StatRange::lastDays(30, '2026-08-25'));

        $this->assertStringContainsString("WHERE scope = '' AND stat_date BETWEEN %s AND %s", $this->db->reads[0]['sql']);
        $this->assertSame(['2026-07-27', '2026-08-25'], $this->db->reads[0]['params']);
    }

    /**
     * **The read writes nothing.** Obvious, and asserted because the only
     * other method on this class is the one that writes — and the counters
     * cannot be recomputed if a read ever stopped being one (ADR 0019).
     */
    public function testTheReadIsAReadAndNothingElse(): void
    {
        $this->stats->inRange(StatRange::lastDays(30, '2026-08-25'));

        $this->assertSame([], $this->db->writes);
        $this->assertSame([], $this->db->upserts);
        $this->assertSame([], $this->db->deletes);
    }
}

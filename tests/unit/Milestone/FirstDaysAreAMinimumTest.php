<?php

namespace WConvert\Tests\Unit\Milestone;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Database\Connection;
use WConvert\Stats\StatKind;
use WConvert\Stats\StatsRepository;
use WConvert\Tests\Unit\Support\FakeConnection;

/**
 * ============================================================================
 * TWO OF THE FIVE MILESTONES ARE STORED NOWHERE, AND THAT IS THE BETTER SHAPE.
 * ============================================================================
 * First [[Impression]] and first [[Conversion]] are `MIN(stat_date)` over
 * `wconvert_stats`, which already holds a row per Optin per day per kind
 * (ADR 0019). A derived first date needs no write, cannot disagree with the
 * counters it is derived from, and **cannot move forwards by construction** —
 * which is "recorded once" obtained for free rather than enforced.
 *
 * That derivation is honest here and would not be everywhere. It rests on two
 * properties of this table specifically: retention is keep-forever with no
 * pruning, and there is **no delete ever** — an erasure request `DELETE`s
 * [[Lead]] rows and never a counter (ADR 0018, ADR 0020), and an Optin is
 * soft-deleted so its counters survive it.
 *
 * The unit suite proves **the statement issued**, against a fake that models
 * the table and ignores the SQL text. A `GROUP BY` produces a result set that
 * exists nowhere in the table, so a fake that answered it would be the
 * authority on what MySQL does; the arithmetic is proven where it can be, in
 * `bin/verify-stats.php`.
 */
#[CoversClass(StatsRepository::class)]
final class FirstDaysAreAMinimumTest extends TestCase
{
    private FakeConnection $db;

    private StatsRepository $stats;

    protected function setUp(): void
    {
        $this->db = new FakeConnection();
        $this->stats = new StatsRepository($this->db);
    }

    public function testASiteThatHasCountedNothingHasNoFirstDays(): void
    {
        $this->db->answers = [[]];

        $this->assertSame([], $this->stats->firstDays());
    }

    public function testTheEarliestDayEachKindWasEverCountedOn(): void
    {
        $this->db->answers = [[
            ['kind' => 'impression', 'first_day' => '2026-03-04'],
            ['kind' => 'conversion', 'first_day' => '2026-03-09'],
        ]];

        $this->assertSame(
            ['impression' => '2026-03-04', 'conversion' => '2026-03-09'],
            $this->stats->firstDays()
        );
    }

    /**
     * A kind this build has no case for is dropped rather than carried
     * through as a bare string — the same closure {@see StatKind} exists to
     * enforce, applied on the way OUT of storage as well as in.
     */
    public function testAKindThisBuildDoesNotKnowIsNotReported(): void
    {
        $this->db->answers = [[
            ['kind' => 'impression', 'first_day' => '2026-03-04'],
            ['kind' => 'telepathy', 'first_day' => '2026-03-01'],
        ]];

        $this->assertSame(['impression' => '2026-03-04'], $this->stats->firstDays());
    }

    /**
     * **One statement, no bindings, and no window.**
     *
     * A milestone is all-time by definition, so this read takes no date range
     * — which is what keeps it out of {@see StatsRepository::inRange()} and
     * off the dashboard's payload. A first conversion that moved when a
     * merchant changed the analytics window would not be a milestone.
     */
    public function testItIsOneAggregateOverTheWholeTableAndBindsNothing(): void
    {
        $this->db->answers = [[]];

        $this->stats->firstDays();

        $this->assertCount(1, $this->db->reads);
        $this->assertSame(Connection::TABLE_STATS, $this->db->reads[0]['table']);
        $this->assertSame([], $this->db->reads[0]['params']);
        $this->assertStringContainsString('MIN(stat_date)', $this->db->reads[0]['sql']);
        $this->assertStringContainsString('GROUP BY kind', $this->db->reads[0]['sql']);
        $this->assertStringContainsString("WHERE scope = ''", $this->db->reads[0]['sql']);
    }

    /**
     * **And it never names the [[Lead]] log**, which is the derivation
     * ADR 0018 depends on not existing. Held generally by
     * {@see \WConvert\Tests\Unit\Stats\NoCountComesFromTheLeadLogTest}; named
     * here because this is a new read and the milestone screen is a new
     * reporting path.
     */
    public function testTheMilestoneReadTouchesOnlyTheCounters(): void
    {
        $this->db->answers = [[]];

        $this->stats->firstDays();

        $this->assertSame([Connection::TABLE_STATS], array_column($this->db->reads, 'table'));
    }
}

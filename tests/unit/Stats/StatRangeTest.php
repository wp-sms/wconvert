<?php

namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Stats\StatRange;

/**
 * The window the analytics screen reads.
 *
 * ============================================================================
 * NOTHING HERE PROVES ANYTHING ABOUT TIMEZONES, AND NOTHING HERE TRIES.
 * ============================================================================
 * "Today means the merchant's today" cannot be proven in this suite:
 * `tests/bootstrap.php` answers `current_time()`, `get_date_from_gmt()` and
 * `wp_timezone()` as though the site were on UTC, deliberately and
 * consistently, so a test built on those stubs would agree with the bootstrap
 * rather than with WordPress ({@see \WConvert\Stats\StatDay}).
 *
 * That is exactly why this class takes the day as an ARGUMENT. Once
 * {@see \WConvert\Stats\StatDay::today()} has said which day it is, "twenty-
 * nine days before that day" is a question about a calendar and not about a
 * clock — the same answer in every zone — and it is provable here. The one
 * line that asks WordPress which zone the site is on is proven against a real
 * `timezone_string` in `bin/verify-stats.php`.
 */
#[CoversClass(StatRange::class)]
final class StatRangeTest extends TestCase
{
    /**
     * **A window of one day is today, not a window of none.** "Today" is what
     * a merchant clicks first, and an exclusive count would give them an empty
     * screen on the day they have numbers for.
     */
    public function testAWindowOfOneDayIsTodayItself(): void
    {
        $range = StatRange::lastDays(1, '2026-08-25');

        $this->assertSame('2026-08-25', $range->from);
        $this->assertSame('2026-08-25', $range->to);
        $this->assertSame(1, $range->days());
    }

    /** Both ends counted, so thirty days is today and the twenty-nine before it. */
    public function testAWindowCountsBothOfItsEnds(): void
    {
        $range = StatRange::lastDays(30, '2026-08-25');

        $this->assertSame('2026-07-27', $range->from);
        $this->assertSame('2026-08-25', $range->to);
        $this->assertSame(30, $range->days());
    }

    /**
     * Calendar arithmetic, not thirty-day months. February, a leap day, and a
     * year boundary in one window.
     */
    public function testItCrossesMonthsLeapDaysAndYears(): void
    {
        $this->assertSame('2028-02-29', StatRange::lastDays(2, '2028-03-01')->from);
        $this->assertSame('2025-12-30', StatRange::lastDays(3, '2026-01-01')->from);
    }

    /**
     * The cap is what keeps a scan of the counters a scan of one year
     * (ADR 0019, ADR 0034), so it is enforced here rather than trusted to the
     * route that declares it.
     */
    public function testTheWindowIsCappedAtAYear(): void
    {
        $range = StatRange::lastDays(10_000, '2026-08-25');

        $this->assertSame(StatRange::MAX_DAYS, $range->days());
    }

    /** And it cannot be zero or negative days, which is a window of no days at all. */
    public function testAWindowIsNeverEmpty(): void
    {
        $this->assertSame(1, StatRange::lastDays(0, '2026-08-25')->days());
        $this->assertSame(1, StatRange::lastDays(-5, '2026-08-25')->days());
    }

    /**
     * A range is a set of days and a set has no direction, so the only reading
     * of a backwards one is the days between its ends.
     */
    public function testABackwardsWindowIsPutBackRatherThanRefused(): void
    {
        $range = StatRange::between('2026-08-25', '2026-08-23');

        $this->assertSame('2026-08-23', $range->from);
        $this->assertSame('2026-08-25', $range->to);
    }

    /**
     * **The cap bites on the FROM end.** A merchant who asks for too much
     * wants what just happened, not what happened first.
     */
    public function testTooLongAWindowKeepsItsMostRecentDays(): void
    {
        $range = StatRange::between('2020-01-01', '2026-08-25');

        $this->assertSame('2026-08-25', $range->to);
        $this->assertSame(StatRange::MAX_DAYS, $range->days());
    }

    public function testItKnowsWhichDaysItCovers(): void
    {
        $range = StatRange::between('2026-08-23', '2026-08-25');

        $this->assertTrue($range->covers('2026-08-23'));
        $this->assertTrue($range->covers('2026-08-25'));
        $this->assertFalse($range->covers('2026-08-22'));
        $this->assertFalse($range->covers('2026-08-26'));
    }

    /**
     * Every day, in order — what the dashboard seeds its series with so a day
     * nothing happened on reports 0 rather than being absent.
     */
    public function testItListsEveryDayInOrder(): void
    {
        $this->assertSame(
            ['2026-08-23', '2026-08-24', '2026-08-25'],
            StatRange::between('2026-08-23', '2026-08-25')->eachDay()
        );
    }

    public function testTheListOfDaysIsAsLongAsTheWindow(): void
    {
        $range = StatRange::lastDays(StatRange::MAX_DAYS, '2026-08-25');

        $this->assertCount($range->days(), $range->eachDay());
        $this->assertSame($range->from, $range->eachDay()[0]);
        $this->assertSame($range->to, $range->eachDay()[$range->days() - 1]);
    }

    /**
     * A day list that crosses a DST boundary is still one entry per calendar
     * day. The arithmetic is deliberately zone-free — this is the assertion
     * that says a 23-hour day did not become two entries or none.
     */
    public function testADstBoundaryIsStillOneDayPerDay(): void
    {
        $range = StatRange::between('2026-03-28', '2026-03-30');

        $this->assertSame(['2026-03-28', '2026-03-29', '2026-03-30'], $range->eachDay());
    }
}

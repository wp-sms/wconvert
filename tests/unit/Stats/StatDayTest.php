<?php

namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Stats\StatDay;

/**
 * **`stat_date` is the site's day, not UTC's.**
 *
 * The dashboard says "Today" and that has to mean the merchant's today
 * (ADR 0019). Every assertion here is about a moment near midnight, because
 * that is the only place the two answers differ and the only place a bug
 * would live.
 *
 * ============================================================================
 * NOTHING HERE GOES THROUGH THE BOOTSTRAP'S CLOCK STUBS, DELIBERATELY.
 * ============================================================================
 * `tests/bootstrap.php` answers `current_time()`, `get_date_from_gmt()` and
 * `wp_timezone()` as though the site were on UTC — consistently with each
 * other, on purpose, because the lead log renders a group's `latest_at` beside
 * a Lead's `created_at` and two stubs disagreeing about the time would show up
 * exactly there. A test written against those stubs could not tell the site's
 * day from UTC's, and would pass just as happily against code that got this
 * wrong.
 *
 * So {@see StatDay::of()} takes the zone as an argument and these are real
 * zones from PHP's own database. The one line that ASKS WordPress which zone
 * the site is on is proven where a real `timezone_string` can be set —
 * `bin/verify-stats.php`.
 */
#[CoversClass(StatDay::class)]
final class StatDayTest extends TestCase
{
    /** 23:10 on the 3rd, UTC. Tomorrow in Tokyo, still the 3rd in Honolulu. */
    private const LATE_ON_THE_THIRD = '2026-03-03 23:10:00';

    private static function moment(string $utc): \DateTimeImmutable
    {
        return new \DateTimeImmutable($utc, new \DateTimeZone('UTC'));
    }

    /**
     * The whole rule, and both merchants are right about their own day.
     */
    public function testAMomentNearMidnightLandsOnTheMerchantsDayRatherThanUtcs(): void
    {
        $moment = self::moment(self::LATE_ON_THE_THIRD);

        $this->assertSame('2026-03-04', StatDay::of($moment, new \DateTimeZone('Asia/Tokyo')));
        $this->assertSame('2026-03-03', StatDay::of($moment, new \DateTimeZone('Pacific/Honolulu')));
        $this->assertSame('2026-03-03', StatDay::of($moment, new \DateTimeZone('UTC')));
    }

    /**
     * The other side of midnight, so the test cannot pass by only ever
     * shifting forwards.
     */
    public function testAMomentJustAfterUtcMidnightIsStillYesterdayInTheAmericas(): void
    {
        $moment = self::moment('2026-03-04 00:30:00');

        $this->assertSame('2026-03-03', StatDay::of($moment, new \DateTimeZone('America/New_York')));
        $this->assertSame('2026-03-04', StatDay::of($moment, new \DateTimeZone('Asia/Tokyo')));
    }

    /**
     * A bare offset, which is what a site that never picked a named zone has.
     *
     * WordPress stores those as `gmt_offset` and `wp_timezone()` hands back a
     * `+05:30`-shaped zone rather than a named one. It has no DST history and
     * no name, and the arithmetic must not care.
     */
    public function testABareOffsetIsAsGoodAsANamedZone(): void
    {
        $this->assertSame(
            '2026-03-04',
            StatDay::of(self::moment(self::LATE_ON_THE_THIRD), new \DateTimeZone('+05:30'))
        );
    }

    /**
     * A zone crossing into DST on the day in question.
     *
     * The date is what is being asked for and DST moves the clock rather than
     * the calendar, so the answer is the same either side of the transition —
     * which is worth pinning, because "add the offset" is the implementation
     * that gets this wrong and it is the implementation somebody would reach
     * for first.
     */
    public function testTheDayIsRightAcrossADaylightSavingTransition(): void
    {
        $london = new \DateTimeZone('Europe/London');

        // BST began at 01:00 UTC on 29 March 2026.
        $this->assertSame('2026-03-29', StatDay::of(self::moment('2026-03-29 00:30:00'), $london));
        $this->assertSame('2026-03-29', StatDay::of(self::moment('2026-03-29 01:30:00'), $london));
        $this->assertSame('2026-03-29', StatDay::of(self::moment('2026-03-29 22:30:00'), $london));
        $this->assertSame('2026-03-30', StatDay::of(self::moment('2026-03-29 23:30:00'), $london));
    }

    /** A MySQL `DATE`, which is what the column is. */
    public function testItReadsAsAMysqlDate(): void
    {
        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}$/',
            StatDay::of(self::moment(self::LATE_ON_THE_THIRD), new \DateTimeZone('Asia/Tokyo'))
        );
    }
}

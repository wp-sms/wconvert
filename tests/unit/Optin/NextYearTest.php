<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\NextYear;

#[CoversClass(NextYear::class)]
final class NextYearTest extends TestCase
{
    /**
     * 02:30 on 29 March 2026 does not exist in Berlin (the clocks jump at
     * 02:00), and 28 March 2027 is the jump the next year. A wall time is
     * shifted as digits, so it is still the 02:30 the merchant typed rather
     * than an instant resolved and moved an hour.
     */
    public function testTheWallClockSurvivesADaylightSavingChange(): void
    {
        self::assertSame('2027-03-29 02:30', NextYear::wall('2026-03-29 02:30'));
        self::assertSame('2027-10-25 02:30', NextYear::wall('2026-10-25 02:30'));
    }

    public function testTheTwentyNinthOfFebruaryBecomesTheTwentyEighth(): void
    {
        self::assertSame('2029-02-28', NextYear::day('2028-02-29'));
        self::assertSame('2029-02-28 09:00', NextYear::wall('2028-02-29 09:00'));
        self::assertSame('2027-12-31', NextYear::day('2026-12-31'));
    }

    public function testWhatIsNotADateIsNull(): void
    {
        self::assertNull(NextYear::wall(null));
        self::assertNull(NextYear::wall('2026-11-20'));
        self::assertNull(NextYear::day('2026-02-30'));
    }

    public function testTheYearInANameMovesOrIsAppended(): void
    {
        self::assertSame('Black Friday 2027', NextYear::name('Black Friday 2026', 2026));
        self::assertSame('Black Friday 2027', NextYear::name('Black Friday', 2026));
        self::assertSame('black-friday-2027', NextYear::name('black-friday-2026', 2026, '-'));
        self::assertSame('launch-2027', NextYear::name('launch', 2026, '-'));
        self::assertSame('BF popup', NextYear::name('BF popup', 2026, null));
        self::assertSame('Sale 120260 2027', NextYear::name('Sale 120260', 2026), 'a year inside a longer number is not the year');
    }
}

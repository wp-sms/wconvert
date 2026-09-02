<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\InvalidSchedule;
use WConvert\Optin\Schedule;

#[CoversClass(Schedule::class)]
final class ScheduleTest extends TestCase
{
    /** 09:00 on the 27th, authored on a site five and a half hours ahead of UTC. */
    public function testAnAuthoredWallTimeResolvesThroughAHalfHourOffsetZone(): void
    {
        $schedule = Schedule::fromArray(['starts_at' => '2026-11-27 09:00']);

        $this->assertSame(
            strtotime('2026-11-27T03:30:00+00:00') * 1000,
            $schedule->resolve(new \DateTimeZone('+05:30'))['starts_at']
        );
    }

    /**
     * A window whose two ends sit either side of a daylight-saving transition.
     */
    public function testTheOffsetIsTheOneInForceAtEachEndRatherThanOneReadOnce(): void
    {
        // BST begins at 01:00 UTC on 29 March 2026 and ends at 01:00 UTC on 25 October.
        $window = Schedule::fromArray(['starts_at' => '2026-03-01 09:00', 'ends_at' => '2026-06-01 09:00'])
            ->resolve(new \DateTimeZone('Europe/London'));

        $this->assertSame(strtotime('2026-03-01T09:00:00+00:00') * 1000, $window['starts_at']);
        $this->assertSame(strtotime('2026-06-01T08:00:00+00:00') * 1000, $window['ends_at']);
    }

    /** An end earlier than its start is refused by the normaliser. */
    public function testAnEndBeforeItsStartIsRefused(): void
    {
        $this->expectException(InvalidSchedule::class);

        Schedule::fromArray(['starts_at' => '2026-11-30 09:00', 'ends_at' => '2026-11-27 09:00']);
    }

    /** Both absent is the ordinary case: an Optin with no schedule at all. */
    public function testBothAbsentIsAnEmptySchedule(): void
    {
        $schedule = Schedule::fromArray([]);

        $this->assertTrue($schedule->isEmpty());
        $this->assertSame([], $schedule->toArray());
        $this->assertSame([], $schedule->resolve(new \DateTimeZone('UTC')));
    }

    /**
     * *From Friday, forever* and *from now until Friday* are both things
     * merchants mean, so one boundary on its own is valid.
     *
     * @return iterable<string, array{array<string, mixed>, array<string, string>}>
     */
    public static function oneSidedSchedules(): iterable
    {
        yield 'a start with no end' => [
            ['starts_at' => '2026-11-27 09:00'],
            ['starts_at' => '2026-11-27 09:00'],
        ];

        yield 'an end with no start' => [
            ['ends_at' => '2026-11-30 23:59'],
            ['ends_at' => '2026-11-30 23:59'],
        ];
    }

    /**
     * @param array<string, mixed> $config
     * @param array<string, string> $expected
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('oneSidedSchedules')]
    public function testOneBoundaryOnItsOwnIsValid(array $config, array $expected): void
    {
        $this->assertSame($expected, Schedule::fromArray($config)->toArray());
    }

    /**
     * The control is an `<input type="datetime-local">`, whose value carries a
     * `T`. Anything else is dropped to null rather than refused, exactly as
     * {@see \WConvert\Optin\Frequency} drops a nonsensical count.
     *
     * @return iterable<string, array{mixed, ?string}>
     */
    public static function authoredValues(): iterable
    {
        yield 'the control\'s own value' => ['2026-11-27T09:00', '2026-11-27 09:00'];
        yield 'as it is stored' => ['2026-11-27 09:00', '2026-11-27 09:00'];
        yield 'with seconds it does not keep' => ['2026-11-27T09:00:45', '2026-11-27 09:00'];
        yield 'not a moment' => ['whenever', null];
        // PHP's own parser ROLLS OVER rather than refusing, so a 13th month
        // becomes January of the next year — a date nobody authored.
        yield 'a month that does not exist' => ['2026-13-27T09:00', null];
        yield 'an hour that does not exist' => ['2026-11-27T29:00', null];
        yield 'a date with no time' => ['2026-11-27', null];
        yield 'not a string' => [1764234000, null];
        yield 'empty' => ['', null];
    }

    /**
     * @param mixed $value
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('authoredValues')]
    public function testAnAuthoredValueIsCanonicalisedOrDropped($value, ?string $expected): void
    {
        $this->assertSame($expected, Schedule::fromArray(['starts_at' => $value])->startsAt);
    }

    /**
     * The reader's door is TOTAL. A rebuild walks every published row, and one
     * hand-edited blob must not fatal the option every page view reads.
     */
    public function testAStoredScheduleThatCannotBeIsReadAsNoScheduleRatherThanAFatal(): void
    {
        $window = Schedule::windowIn(
            ['starts_at' => '2026-11-30 09:00', 'ends_at' => '2026-11-27 09:00'],
            new \DateTimeZone('UTC')
        );

        $this->assertSame([], $window);
    }

    /** The ordinary case, read the way the projection reads it. */
    public function testTheReadersDoorResolvesThroughTheSiteZone(): void
    {
        $window = Schedule::windowIn(['starts_at' => '2026-11-27 09:00'], new \DateTimeZone('Asia/Kolkata'));

        $this->assertSame(['starts_at' => strtotime('2026-11-27T03:30:00+00:00') * 1000], $window);
    }
}

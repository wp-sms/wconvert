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
     * ========================================================================
     * A HALF-HOUR ZONE THAT ALSO OBSERVES DST — WHERE BOTH BUGS LIVE AT ONCE.
     * ========================================================================
     * `+05:30` above is a bare offset with no history, which is what a site
     * that never picked a named zone has. This is the harder case and the one
     * the ticket names: Adelaide is +09:30 in winter and +10:30 in summer, so
     * an implementation that reads one offset and adds it is wrong by an hour
     * for half the year AND an implementation that rounds to whole hours is
     * wrong by thirty minutes all year. Only a zone with both properties fails
     * for both reasons.
     */
    public function testAHalfHourZoneThatObservesDaylightSavingIsRightOnBothSides(): void
    {
        $adelaide = new \DateTimeZone('Australia/Adelaide');

        // ACST (+09:30) in July; ACDT (+10:30) in January.
        $winter = Schedule::fromArray(['starts_at' => '2026-07-01 09:00'])->resolve($adelaide);
        $summer = Schedule::fromArray(['starts_at' => '2026-01-01 09:00'])->resolve($adelaide);

        $this->assertSame(strtotime('2026-06-30T23:30:00+00:00') * 1000, $winter['starts_at']);
        $this->assertSame(strtotime('2025-12-31T22:30:00+00:00') * 1000, $summer['starts_at']);
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
     * `T` and may carry seconds. One spelling is stored, because the
     * projection re-parses it on every rebuild and two spellings is two
     * parses.
     *
     * @return iterable<string, array{mixed, string}>
     */
    public static function authoredValues(): iterable
    {
        yield 'the control\'s own value' => ['2026-11-27T09:00', '2026-11-27 09:00'];
        yield 'as it is stored' => ['2026-11-27 09:00', '2026-11-27 09:00'];
        yield 'with seconds it does not keep' => ['2026-11-27T09:00:45', '2026-11-27 09:00'];
    }

    /**
     * @param mixed $value
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('authoredValues')]
    public function testAnAuthoredValueIsCanonicalised($value, string $expected): void
    {
        $this->assertSame($expected, Schedule::fromArray(['starts_at' => $value])->startsAt);
    }

    /**
     * ========================================================================
     * ABSENT IS A SCHEDULE. SUPPLIED-AND-UNREADABLE IS A REFUSAL.
     * ========================================================================
     * {@see \WConvert\Optin\Frequency} drops a nonsensical count to null, and
     * this deliberately does not follow it: a `maxImpressions` of 0 and no cap
     * at all are the same answer to the engine, but a dropped `ends_at` is a
     * sale that never finishes — which is the *"it keeps popping up"*
     * complaint the whole feature exists to answer. It is the same harm the
     * backwards refusal is for, arrived at from an unreadable value rather
     * than an impossible pair, so it gets the same answer.
     *
     * @return iterable<string, array{mixed}>
     */
    public static function unreadableValues(): iterable
    {
        yield 'not a moment' => ['whenever'];
        yield 'a date with no time' => ['2026-11-27'];
        yield 'not a string' => [1764234000];
        // PHP's own parser ROLLS OVER rather than refusing, so a 13th month
        // becomes January of the next year — a date nobody authored.
        yield 'a month that does not exist' => ['2026-13-27T09:00'];
        yield 'an hour that does not exist' => ['2026-11-27T29:00'];
    }

    /**
     * @param mixed $value
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('unreadableValues')]
    public function testABoundaryThatWasSuppliedAndCannotBeReadIsRefused($value): void
    {
        $this->expectException(InvalidSchedule::class);

        Schedule::fromArray(['ends_at' => $value]);
    }

    /**
     * An EMPTY box is the merchant saying "no boundary", which is a thing they
     * mean — so it is absent rather than unreadable.
     *
     * @return iterable<string, array{array<string, mixed>}>
     */
    public static function absentBoundaries(): iterable
    {
        yield 'no key at all' => [[]];
        yield 'an emptied box' => [['starts_at' => '', 'ends_at' => '']];
        yield 'a null' => [['starts_at' => null, 'ends_at' => null]];
    }

    /**
     * @param array<string, mixed> $config
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('absentBoundaries')]
    public function testAnAbsentBoundaryIsNoBoundaryRatherThanARefusal(array $config): void
    {
        $this->assertTrue(Schedule::fromArray($config)->isEmpty());
    }

    /**
     * ========================================================================
     * THE READER'S DOOR IS TOTAL, AND IT FAILS SHUT.
     * ========================================================================
     * A rebuild walks every published row, so one hand-edited blob must not
     * fatal the option every page view reads. What it ships for an impossible
     * pair is the pair itself: the loader's window is half-open
     * (`starts_at <= now < ends_at`), so a window that ends before it starts
     * contains no instant and the Optin never shows.
     *
     * That direction is the point. Shipping NO window would read as *never
     * scheduled* and show a finished sale forever, which is the failure this
     * feature exists to prevent — and it is the same fail-shut rule
     * `decide.ts` gives a rule that cannot answer.
     */
    public function testAStoredScheduleThatCannotBeFailsShutRatherThanOpen(): void
    {
        $window = Schedule::windowIn(
            ['starts_at' => '2026-11-30 09:00', 'ends_at' => '2026-11-27 09:00'],
            new \DateTimeZone('UTC')
        );

        $this->assertSame(
            [
                'starts_at' => strtotime('2026-11-30T09:00:00+00:00') * 1000,
                'ends_at' => strtotime('2026-11-27T09:00:00+00:00') * 1000,
            ],
            $window
        );

        // The loader's own test, spelled here so the claim above is not just
        // prose: no instant is inside it.
        $this->assertLessThan($window['starts_at'], $window['ends_at']);
    }

    /** And a stored boundary that cannot be read at all simply is not one. */
    public function testAStoredBoundaryThatCannotBeReadIsNotShipped(): void
    {
        $this->assertSame(
            ['starts_at' => strtotime('2026-11-27T09:00:00+00:00') * 1000],
            Schedule::windowIn(['starts_at' => '2026-11-27 09:00', 'ends_at' => 'whenever'], new \DateTimeZone('UTC'))
        );
    }

    /** The ordinary case, read the way the projection reads it. */
    public function testTheReadersDoorResolvesThroughTheSiteZone(): void
    {
        $window = Schedule::windowIn(['starts_at' => '2026-11-27 09:00'], new \DateTimeZone('Asia/Kolkata'));

        $this->assertSame(['starts_at' => strtotime('2026-11-27T03:30:00+00:00') * 1000], $window);
    }
}

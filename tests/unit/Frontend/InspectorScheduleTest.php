<?php

namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Frontend\InspectorSchedules;

/**
 * How long until a scheduled Optin starts — **the magnitude, minted in PHP**.
 *
 * ============================================================================
 * WHY THE SERVER SAYS "3 DAYS" AND THE BROWSER SAYS WHICH SIDE.
 * ============================================================================
 * The inspector panel is composed from the loader's own module set, which has
 * no dependencies at all (ADR 0004), so it carries no `@wordpress/i18n` and
 * cannot spell *"3 days"*: that needs plural rules and a formatter. Every
 * merchant word is therefore minted here (ADR 0048), and `human_time_diff()`
 * already says this one, translated, in core.
 *
 * **Direction is not this class's business.** `human_time_diff()` is an
 * absolute magnitude, and both boundaries are minted whenever they EXIST —
 * which side of one the visitor is on is `explain.ts`'s answer, taken on the
 * same clock reading as the verdict it explains. Splitting it that way is what
 * makes it impossible for the two halves to disagree about the direction,
 * which is the only thing they could have disagreed about.
 */
#[CoversClass(InspectorSchedules::class)]
final class InspectorScheduleTest extends TestCase
{
    private const NOW = 1764244800; // 2026-11-27 12:00 UTC.

    /**
     * @param array<string, mixed> $payload
     * @return list<array<string, mixed>>
     */
    private static function set(array $payload, string $id = '01JQ0000000000000000000001'): array
    {
        return [['id' => $id, 'targeting' => [], 'payload' => $payload]];
    }

    public function testAnOptinWithNoScheduleIsNotInTheMap(): void
    {
        $this->assertSame([], InspectorSchedules::forSet(self::set([]), self::NOW));
    }

    public function testBothBoundariesAreMintedWhereverTheyExist(): void
    {
        $schedules = InspectorSchedules::forSet(
            self::set([
                'starts_at' => (self::NOW + 3 * 86400) * 1000,
                'ends_at' => (self::NOW + 10 * 86400) * 1000,
            ]),
            self::NOW
        );

        $this->assertSame(
            ['01JQ0000000000000000000001' => ['starts' => '3 days', 'ends' => '1 week']],
            $schedules
        );
    }

    /**
     * A boundary in the PAST still gets a word, because the diff is a
     * magnitude: *"its schedule ended 4 hours ago"* is the sentence it fills.
     */
    public function testABoundaryAlreadyPassedIsStillMinted(): void
    {
        $schedules = InspectorSchedules::forSet(
            self::set(['ends_at' => (self::NOW - 4 * 3600) * 1000]),
            self::NOW
        );

        $this->assertSame(
            ['01JQ0000000000000000000001' => ['starts' => null, 'ends' => '4 hours']],
            $schedules
        );
    }

    /** One boundary on its own leaves the other null rather than absent. */
    public function testOneSidedSchedulesKeepBothKeys(): void
    {
        $schedules = InspectorSchedules::forSet(
            self::set(['starts_at' => (self::NOW + 86400) * 1000]),
            self::NOW
        );

        $this->assertSame(
            ['01JQ0000000000000000000001' => ['starts' => '1 day', 'ends' => null]],
            $schedules
        );
    }
}

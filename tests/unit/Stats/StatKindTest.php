<?php

namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Stats\StatKind;

/**
 * **`kind` is a closed set of four, with no filter and no registry.**
 *
 * The bounded row count is `wconvert_stats`' entire justification, and an open
 * registry means unbounded `kind` cardinality on exactly that table (ADR 0019).
 * So the assertion is not only "these four exist" — it is "these four and no
 * more, and there is no way to add a fifth at runtime".
 */
#[CoversClass(StatKind::class)]
final class StatKindTest extends TestCase
{
    public function testItIsExactlyTheseFour(): void
    {
        $this->assertSame(
            ['impression', 'screen_shown', 'screen_advanced', 'screen_skipped', 'screen_dismissed', 'conversion', 'capture', 'result_click', 'dismiss', 'lead_magnet_delivered'],
            array_map(static fn (StatKind $kind): string => $kind->value, StatKind::cases())
        );
    }

    /**
     * An unknown kind is rejected in PHP rather than stored and sorted out
     * later. There is no later: the counters cannot be recomputed, so a row
     * written under a kind nothing reads is a row that is wrong forever
     * (ADR 0019).
     */
    public function testAnUnknownKindIsNotOne(): void
    {
        $this->assertNull(StatKind::tryFrom('scrolled_past'));
        $this->assertNull(StatKind::fromBeacon('scrolled_past'));
    }

    /**
     * Case matters and whitespace is not trimmed. A lenient read here is how
     * `Impression` and `impression` become two rows for one act, which is the
     * cardinality problem arriving through the back door.
     */
    public function testTheSpellingIsExact(): void
    {
        $this->assertNull(StatKind::fromBeacon('Impression'));
        $this->assertNull(StatKind::fromBeacon(' impression'));
        $this->assertNull(StatKind::fromBeacon(''));
    }

    /**
     * The three a browser may assert.
     */
    public function testABrowserMayReportWhatABrowserCanSee(): void
    {
        $this->assertSame(StatKind::Impression, StatKind::fromBeacon('impression'));
        $this->assertSame(StatKind::Conversion, StatKind::fromBeacon('conversion'));
        $this->assertSame(StatKind::Dismiss, StatKind::fromBeacon('dismiss'));
    }

    /**
     * **And the fourth, which it may not.**
     *
     * `lead_magnet_delivered` records an act that happens after the Conversion,
     * from a different process, and that can fail on its own — PHP writes it
     * once per [[Lead]] on first successful delivery (ADR 0020). A browser
     * cannot have watched an email send, and the endpoint that would take its
     * word for it is public and unauthenticated by necessity. Accepting it
     * there would make `conversions − lead_magnet_delivered` — the delivery
     * failure count — a number anybody could set.
     */
    public function testABrowserMayNotAssertADeliveryItCannotHaveSeen(): void
    {
        $this->assertNull(StatKind::fromBeacon('lead_magnet_delivered'));
        $this->assertSame(StatKind::LeadMagnetDelivered, StatKind::tryFrom('lead_magnet_delivered'));
    }
}

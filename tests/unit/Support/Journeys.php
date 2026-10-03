<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Template\JourneySupport;

/**
 * Pro's journeys module registering itself, for a suite that is not booting
 * Pro (ADR 0116). The filter is global, so every `on()` has an `off()` in the
 * same test class's `tearDown()`.
 */
final class Journeys
{
    public static function on(): void
    {
        add_filter(JourneySupport::FILTER, static fn (): bool => true);
    }

    public static function off(): void
    {
        unset($GLOBALS['wconvertTestFilters'][JourneySupport::FILTER]);
    }
}

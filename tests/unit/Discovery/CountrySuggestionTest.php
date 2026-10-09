<?php
namespace WConvert\Tests\Unit\Discovery;
use PHPUnit\Framework\TestCase;
use WConvert\Discovery\CountrySuggestion;
final class CountrySuggestionTest extends TestCase
{
    public function testNamedTimezoneOffersACountryButNeverAnOffsetGuess(): void
    {
        self::assertSame(['code' => 'GB', 'timezone' => 'Europe/London'], CountrySuggestion::fromTimezone('Europe/London'));
        foreach (['UTC', '+04:00', 'Etc/GMT-4', 'invalid/timezone', ''] as $timezone) self::assertNull(CountrySuggestion::fromTimezone($timezone));
    }
}

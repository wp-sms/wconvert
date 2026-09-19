<?php

namespace WConvert\Tests\Unit\Admin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Admin\AdminMenu;

/** The admin receives WordPress's site zone, without browser-zone substitution. */
#[CoversClass(AdminMenu::class)]
final class AdminSettingsTest extends TestCase
{
    protected function tearDown(): void
    {
        unset($GLOBALS['wconvertTestTimezoneString'], $GLOBALS['wconvertTestSiteName']);
    }

    /** @return iterable<string, array{string}> */
    public static function timezones(): iterable
    {
        yield 'named zone with DST' => ['America/New_York'];
        yield 'named zone without DST' => ['Asia/Muscat'];
        yield 'positive offset with minutes' => ['+05:30'];
        yield 'negative offset with minutes' => ['-03:30'];
        yield 'UTC' => ['UTC'];
    }

    #[DataProvider('timezones')]
    public function testTheSiteZoneSurvivesSettingsSerialization(string $zone): void
    {
        $GLOBALS['wconvertTestTimezoneString'] = $zone;

        $json = wp_json_encode(AdminMenu::settings());

        $this->assertIsString($json);
        $settings = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame($zone, $settings['timezone']);
    }
    public function testWorkspaceIdentityUsesTheDecodedWordPressSiteTitle(): void
    {
        $GLOBALS['wconvertTestSiteName'] = 'A &amp; B';
        $this->assertSame('A & B', AdminMenu::settings()['siteName']);
    }
}

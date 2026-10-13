<?php

namespace WConvert\Tests\Unit\Admin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Admin\AdminMenu;
use WConvert\Admin\ProHints;
use WConvert\Support\ProPresence;
use WConvert\Support\Tier;

/** The contextual Pro hints: all three conditions, or none (ADR 0147). */
#[CoversClass(ProHints::class)]
final class ProHintsTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = ['install_plugins', 'activate_plugins'];
        unset($GLOBALS['wconvertTestFilters'][ProHints::FILTER]);
    }

    protected function tearDown(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = [];
        unset($GLOBALS['wconvertTestFilters'][ProHints::FILTER]);
    }

    private static function on(Tier $tier): ProPresence
    {
        return new class ($tier) implements ProPresence {
            public function __construct(private readonly Tier $tier)
            {
            }

            public function installedTier(): Tier
            {
                return $this->tier;
            }
        };
    }

    public function testShownOnAFreeInstallForSomeoneWhoCanInstallPlugins(): void
    {
        $this->assertTrue(ProHints::shown(self::on(Tier::Free)));
    }

    public function testNotShownWherePro(): void
    {
        $this->assertFalse(ProHints::shown(self::on(Tier::Pro)));
    }

    /** A multisite site admin, or a client with `manage_options`, can't install Pro. */
    public function testNotShownToSomeoneWhoCannotInstallPlugins(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = ['manage_options'];

        $this->assertFalse(ProHints::shown(self::on(Tier::Free)));
    }

    public function testAFilterTurnsThemOff(): void
    {
        add_filter(ProHints::FILTER, static fn (): bool => false);

        $this->assertFalse(ProHints::shown(self::on(Tier::Free)));
    }

    public function testProInstalledButInactiveIsReportedFromThePluginList(): void
    {
        $this->assertTrue(ProHints::proInstalledInactive(self::on(Tier::Free), [ProHints::PRO_PLUGIN => ['Name' => 'WConvert Pro']]));
        $this->assertFalse(ProHints::proInstalledInactive(self::on(Tier::Free), ['wconvert/wconvert.php' => []]));
        $this->assertFalse(ProHints::proInstalledInactive(self::on(Tier::Pro), [ProHints::PRO_PLUGIN => []]));
    }

    public function testActivateItIsOnlyOfferedToSomeoneWhoCanActivatePlugins(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = ['install_plugins'];

        $this->assertFalse(ProHints::proInstalledInactive(self::on(Tier::Free), [ProHints::PRO_PLUGIN => []]));
    }

    public function testTheAdminReceivesBothAsBooleans(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = ['install_plugins'];
        $settings = AdminMenu::settings();

        $this->assertIsBool($settings['proHints']);
        $this->assertIsBool($settings['proInstalledInactive']);
    }
}

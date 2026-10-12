<?php

namespace WConvert\Tests\Unit\Pro\License;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\License\RefreshCron;
use WConvert\Pro\License\SdkConfig;
use WConvert\Pro\License\Uninstall;

/**
 * Deleting Pro frees the seat it holds, then forgets the licence.
 *
 * Through the SDK's own activate() and uninstall(), with the store answered
 * in-process: the order is the point — the key that releases the seat is the
 * key the delete removes, so releasing after deleting would release nothing.
 */
#[CoversClass(Uninstall::class)]
final class UninstallTest extends TestCase
{
    use FakesNexus;

    protected function setUp(): void
    {
        $this->fakeNexus();
    }

    protected function tearDown(): void
    {
        $this->stopFakingNexus();
    }

    public function testDeletingProReleasesThisSitesSeatAndRemovesTheLicence(): void
    {
        $this->activateLicenceHere('WCV-KEY-TO-RELEASE');
        $this->assertIsArray(get_option(SdkConfig::OPTION_KEY), 'the licence was not stored, so nothing below is proven');

        $result = Uninstall::run();

        $released = $this->nexusCallsTo('/api/v1/license/deactivate');
        $this->assertCount(1, $released, 'the seat was not released');
        $this->assertSame('WCV-KEY-TO-RELEASE', $released[0]['license_key'] ?? null);
        $this->assertTrue($result['removed_remotely']);
        $this->assertFalse(get_option(SdkConfig::OPTION_KEY), 'the licence outlived the delete');
    }

    public function testAnUnreachableStoreDoesNotStopTheDelete(): void
    {
        $this->activateLicenceHere();
        $this->nexusDown = true;

        $result = Uninstall::run();

        $this->assertFalse($result['removed_remotely']);
        $this->assertFalse(get_option(SdkConfig::OPTION_KEY), 'a store that did not answer kept the licence on a deleted plugin');
    }

    public function testTheDailyCheckIsUnscheduled(): void
    {
        $GLOBALS['wconvertTestSchedule'][RefreshCron::HOOK] = time();

        Uninstall::run();

        $this->assertFalse(wp_next_scheduled(RefreshCron::HOOK));
    }

    public function testASdkThatCannotBeBuiltStillLeavesNoLicenceBehind(): void
    {
        update_option(SdkConfig::OPTION_KEY, ['license' => ['license_key' => 'x']]);

        $result = Uninstall::run(static function (): never {
            throw new \RuntimeException('sodium is missing');
        });

        $this->assertSame('unknown', $result['error_code']);
        $this->assertFalse(get_option(SdkConfig::OPTION_KEY));
    }
}

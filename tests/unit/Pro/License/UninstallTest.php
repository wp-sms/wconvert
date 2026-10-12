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
        $this->activateLicenseHere('WCV-KEY-TO-RELEASE');
        $this->assertIsArray(get_option(SdkConfig::OPTION_KEY), 'the licence was not stored, so nothing below is proven');

        $result = Uninstall::run()[1];

        $released = $this->nexusCallsTo('/api/v1/license/deactivate');
        $this->assertCount(1, $released, 'the seat was not released');
        $this->assertSame('WCV-KEY-TO-RELEASE', $released[0]['license_key'] ?? null);
        $this->assertTrue($result['removed_remotely']);
        $this->assertFalse(get_option(SdkConfig::OPTION_KEY), 'the licence outlived the delete');
    }

    public function testAnUnreachableStoreDoesNotStopTheDelete(): void
    {
        $this->activateLicenseHere();
        $this->nexusDown = true;

        $result = Uninstall::run()[1];

        $this->assertFalse($result['removed_remotely']);
        $this->assertFalse(get_option(SdkConfig::OPTION_KEY), 'a store that did not answer kept the licence on a deleted plugin');
    }

    /** Activated on two sites of a network: both seats go, each from its own site. */
    public function testEverySiteOfANetworkReleasesItsOwnSeat(): void
    {
        $this->activateLicenseHere('WCV-SITE-ONE');
        switch_to_blog(2);
        $this->activateLicenseHere('WCV-SITE-TWO');
        restore_current_blog();

        try {
            $GLOBALS['wconvertTestMultisite'] = true;
            $results = Uninstall::run();
        } finally {
            $GLOBALS['wconvertTestMultisite'] = false;
            $GLOBALS['wconvertTestBlogTables'] = [];
        }

        $this->assertSame([1, 2], array_keys($results));
        $this->assertSame(['WCV-SITE-ONE', 'WCV-SITE-TWO'], array_column($this->nexusCallsTo('/api/v1/license/deactivate'), 'license_key'));
    }

    /** A large network cannot time the delete out: past the budget, sites are only cleaned locally. */
    public function testAReleaseThatWouldOverrunTheBudgetIsSkipped(): void
    {
        $this->activateLicenseHere();
        $times = [0.0, (float) Uninstall::BUDGET_SECONDS];

        $result = Uninstall::run(clock: static function () use (&$times): float {
            return array_shift($times) ?? (float) Uninstall::BUDGET_SECONDS;
        })[1];

        $this->assertFalse($result['released']);
        $this->assertSame([], $this->nexusCallsTo('/api/v1/license/deactivate'));
        $this->assertFalse(get_option(SdkConfig::OPTION_KEY), 'a skipped release still has to forget the licence');
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
        })[1];

        $this->assertSame('unknown', $result['error_code']);
        $this->assertFalse(get_option(SdkConfig::OPTION_KEY));
    }
}

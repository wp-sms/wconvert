<?php

namespace WConvert\Tests\Unit\Pro\Boot;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\Bootstrap;

/**
 * Pro refuses network activation, as free does.
 *
 * Each site holds its own licence and seat (ADR 0143), and the SDK caches one
 * update answer per network (veronalabs/wp-premium-sdk#33), so a network-active
 * Pro would offer every subsite the update one subsite's licence earned.
 */
#[CoversClass(Bootstrap::class)]
final class NetworkActivationTest extends TestCase
{
    protected function tearDown(): void
    {
        $GLOBALS['wconvertTestMultisite'] = false;
    }

    public function testNetworkActivationIsRefusedWithTheReason(): void
    {
        $GLOBALS['wconvertTestMultisite'] = true;

        $this->expectException(\WConvertTestDied::class);
        $this->expectExceptionMessage('Activate it on each site instead');

        Bootstrap::activate(true);
    }

    public function testActivatingOnOneSiteOfANetworkWorks(): void
    {
        $GLOBALS['wconvertTestMultisite'] = true;

        Bootstrap::activate(false);

        $this->addToAssertionCount(1);
    }

    public function testASingleSiteIsNeverRefused(): void
    {
        Bootstrap::activate(true);

        $this->addToAssertionCount(1);
    }
}

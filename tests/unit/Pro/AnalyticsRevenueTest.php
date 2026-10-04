<?php
namespace WConvert\Tests\Unit\Pro;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\Module\Analytics\RevenueAmount;
final class AnalyticsRevenueTest extends TestCase
{
    public function testRevenueExcludesTaxAndShippingAndSubtractsOnlyAllocatedProductRefunds(): void
    {
        self::assertSame(80.0, RevenueAmount::net([100.0], [['amount' => 25.0, 'products' => 20.0, 'other' => 5.0]]));
        self::assertNull(RevenueAmount::net([100.0], [['amount' => 25.0, 'products' => 0.0, 'other' => 0.0]]));
        self::assertSame(0.0, RevenueAmount::net([100.0], [['amount' => 100.0, 'products' => 100.0, 'other' => 0.0]]));
    }
    public function testClickTokensHaveBoundedTimeAndExpectedFormat(): void
    {
        $event = '95a64e61-7c5e-4187-b770-1a9be0c4854e';
        self::assertTrue(\WConvert\Pro\Module\Analytics\Attribution::clickToken($event, 1000, 1000));
        self::assertFalse(\WConvert\Pro\Module\Analytics\Attribution::clickToken($event, 1000, 1121));
        self::assertFalse(\WConvert\Pro\Module\Analytics\Attribution::clickToken($event, 1121, 1000));
        self::assertFalse(\WConvert\Pro\Module\Analytics\Attribution::clickToken('invalid', 1000, 1000));
    }
    public function testAttributionExpiresAndRejectsFutureOrMalformedEvidence(): void
    {
        $value = ['version' => 1, 'at' => 1000, 'arm' => '01JQ0000000000000000000001', 'family' => '01JQ0000000000000000000001', 'receipt' => str_repeat('a', 32)];
        self::assertTrue(\WConvert\Pro\Module\Analytics\Attribution::eligible($value, 2799));
        self::assertFalse(\WConvert\Pro\Module\Analytics\Attribution::eligible($value, 2800));
        self::assertFalse(\WConvert\Pro\Module\Analytics\Attribution::eligible($value, 999));
        self::assertFalse(\WConvert\Pro\Module\Analytics\Attribution::eligible([], 1000));
    }
}

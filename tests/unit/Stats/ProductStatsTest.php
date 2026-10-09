<?php
namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\TestCase;
use WConvert\Stats\{ProductStats, StatRange};
use WConvert\Tests\Unit\Support\FakeConnection;

final class ProductStatsTest extends TestCase
{
    protected function tearDown(): void { unset($GLOBALS['wconvertTestFilters']['wconvert_product_activity_name']); }

    public function testAggregatesKeepProductIdentityAndSortByActualAdditions(): void
    {
        $db = new FakeConnection();
        $db->answers[] = [
            ['scope' => 'product:21', 'shown' => '8', 'clicked' => '4', 'added' => '0'],
            ['scope' => 'product:22', 'shown' => '6', 'clicked' => '0', 'added' => '2'],
        ];
        $GLOBALS['wconvertTestFilters']['wconvert_product_activity_name'][] = static fn ($name, $id) => $id === 22 ? 'Renamed filter' : '';
        $report = (new ProductStats($db))->report('campaign', StatRange::lastDays(30, '2026-10-05'), '2026-10-05', '2026-10-03');
        self::assertSame('2026-10-03', $report['recorded_from']);
        self::assertSame(['id' => 22, 'name' => 'Renamed filter', 'shown' => 6, 'clicked' => 0, 'added' => 2], $report['rows'][0]);
        self::assertSame('Unavailable product #21', $report['rows'][1]['name']);
        self::assertContains('product:%', $db->reads[0]['params']);
        self::assertStringContainsString('optin_id = %s AND stat_date BETWEEN', $db->reads[0]['sql']);
    }
    public function testAnOverflowSuppressesTheEntireTable(): void
    {
        $db = new FakeConnection();
        $db->answers[] = array_fill(0, 101, ['scope' => 'product:1', 'shown' => '1', 'clicked' => '0', 'added' => '0']);
        $report = (new ProductStats($db))->report('campaign', StatRange::lastDays(30, '2026-10-05'), '2026-10-05', '2026-09-01');
        self::assertTrue($report['truncated']); self::assertSame([], $report['rows']);
    }
    public function testEarlierUninstrumentedDatesDoNotBecomeZeroActivity(): void
    {
        $db = new FakeConnection();
        $report = (new ProductStats($db))->report('campaign', StatRange::calendarMonth('2026-08', '2026-10-05'), '2026-10-05', '2026-10-05');
        self::assertNull($report['recorded_from']); self::assertSame([], $db->reads); self::assertTrue($report['available']);
    }
    public function testRetentionUsesTheSiteCalendarAndDoesNotReadExpiredDays(): void
    {
        $db = new FakeConnection();
        $report = (new ProductStats($db))->report('campaign', StatRange::lastDays(366, '2026-10-05'), '2026-10-05', '2026-01-01');
        self::assertSame('2026-07-08', $report['recorded_from']);
        self::assertContains('2026-07-08', $db->reads[0]['params']);
    }
    public function testAnEmptyMonthDoesNotReadAnyRows(): void
    {
        $db = new FakeConnection();
        $report = (new ProductStats($db))->report('campaign', StatRange::calendarMonth('2026-10', '2026-10-01'), '2026-10-01', '2026-09-01');
        self::assertSame(0, $report['days']); self::assertNull($report['recorded_from']); self::assertSame([], $db->reads);
    }
}

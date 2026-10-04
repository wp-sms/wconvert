<?php
namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\TestCase;
use WConvert\Stats\Insights;

final class InsightsTest extends TestCase
{
    public function testFewerAppearancesExplainsTheSameRateWithoutInventingACause(): void
    {
        $report = ['from' => '2026-09-01', 'to' => '2026-09-30', 'days' => 30, 'complete_days' => true,
            'goals' => [['goal' => 'email', 'result_label' => 'Submissions', 'optins' => [['id' => 'a', 'name' => 'Newsletter', 'status' => 'published', 'impressions' => 1000, 'conversions' => 30]]]],
            'previous' => ['from' => '2026-08-02', 'to' => '2026-08-31', 'days' => 30, 'goals' => [['optins' => [['id' => 'a', 'impressions' => 2000, 'conversions' => 60]]]]]];
        $cards = Insights::forReport($report);
        self::assertCount(1, $cards);
        self::assertSame('lower_exposure', $cards[0]['rule_id']);
        self::assertSame(30, $cards[0]['facts']['current']['results']);
        self::assertSame(0.03, $cards[0]['facts']['current']['rate']);
        self::assertStringContainsString('unknown', $cards[0]['limitation']);
    }
    public function testRateDeclineIsShownEvenWhenMoreTrafficBringsMoreResults(): void
    {
        $report = ['from' => '2026-09-01', 'to' => '2026-09-30', 'days' => 30, 'complete_days' => true,
            'goals' => [['goal' => 'email', 'result_label' => 'Submissions', 'optins' => [['id' => 'a', 'name' => 'Newsletter', 'status' => 'published', 'impressions' => 4000, 'conversions' => 80]]]],
            'previous' => ['days' => 30, 'goals' => [['optins' => [['id' => 'a', 'impressions' => 1000, 'conversions' => 60]]]]]];
        self::assertSame('lower_rate', Insights::forReport($report)[0]['rule_id']);
        $report['goals'][0]['optins'][0]['status'] = 'historical';
        self::assertSame([], Insights::forReport($report));
        $report['goals'][0]['optins'][0]['status'] = 'paused';
        self::assertSame([], Insights::forReport($report));
    }

    public function testSparseAndIncompleteWindowsDoNotProduceOptimizationAdvice(): void
    {
        $report = ['from' => '2026-09-01', 'to' => '2026-09-30', 'days' => 30, 'complete_days' => true,
            'goals' => [['goal' => 'email', 'result_label' => 'Submissions', 'optins' => [['id' => 'a', 'name' => 'Newsletter', 'status' => 'published', 'impressions' => 10, 'conversions' => 0]]]],
            'previous' => ['days' => 30, 'goals' => [['optins' => [['id' => 'a', 'impressions' => 2000, 'conversions' => 60]]]]]];
        self::assertSame([], Insights::forReport($report));
        $report['goals'][0]['optins'][0]['impressions'] = 0;
        self::assertSame('no_appearances', Insights::forReport($report)[0]['rule_id']);
        $report['complete_days'] = false;
        self::assertSame([], Insights::forReport($report));
    }
}

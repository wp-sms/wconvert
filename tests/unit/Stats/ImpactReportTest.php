<?php

namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\TestCase;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rules\RuleVocabulary;
use WConvert\Stats\Dashboard;
use WConvert\Stats\StatRange;
use WConvert\Stats\StatsRepository;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;

final class ImpactReportTest extends TestCase
{
    public function testComparisonReadsOneInterpretationAndTwoBoundedWindows(): void
    {
        $db = new FakeConnection();
        $db->answers = [
            [['id' => 'email', 'goal' => 'grow_email_list', 'was_published' => '1']],
            [['optin_id' => 'email', 'stat_date' => '2026-09-13', 'kind' => 'conversion', 'count' => '12']],
            [['optin_id' => 'email', 'stat_date' => '2026-09-06', 'kind' => 'conversion', 'count' => '6']],
        ];
        $options = new FakeOptionStore();
        $dashboard = new Dashboard(new StatsRepository($db), new OptinRepository(
            $db, new PublishedSet($options), RuleVocabulary::fromManifest(__DIR__ . '/../../..'), new MilestoneStore($options)
        ));
        $report = $dashboard->compare(StatRange::completeDays(7, '2026-09-14'));
        self::assertCount(3, $db->reads);
        self::assertSame(['2026-09-07', '2026-09-13'], $db->reads[1]['params']);
        self::assertSame(['2026-08-31', '2026-09-06'], $db->reads[2]['params']);
        self::assertSame(12, $report['impact'][0]['count']);
        self::assertSame(6, $report['previous']['impact'][0]['count']);
        self::assertSame([], $db->writes);
    }

    public function testComparisonUsesAdjacentCompleteCalendarDaysAcrossLeapDay(): void
    {
        $range = StatRange::completeDays(7, '2024-03-02');
        self::assertSame(['2024-02-24', '2024-03-01'], [$range->from, $range->to]);
        self::assertSame(['2024-02-17', '2024-02-23'], [$range->previous()->from, $range->previous()->to]);
        self::assertSame(7, $range->previous()->days());
    }

    public function testPublishedHistoryRemainsInspectableWhileNeverPublishedDraftsAreExcluded(): void
    {
        $report = Dashboard::of(StatRange::lastDays(7, '2026-09-13'), [], [
            ['id' => 'draft', 'goal' => 'grow_email_list', 'was_published' => '0'],
            ['id' => 'paused', 'goal' => 'grow_email_list', 'was_published' => '1'],
            ['id' => 'deleted', 'goal' => 'grow_email_list', 'was_published' => '1', 'deleted_at' => '2026-09-14'],
        ]);
        $rows = array_column($report['goals'][0]['optins'], null, 'id');
        self::assertArrayNotHasKey('draft', $rows);
        self::assertSame('paused', $rows['paused']['status']);
        self::assertSame('historical', $rows['deleted']['status']);
    }

    public function testImpactCountsCapturesOnceAndKeepsHandoffsAndClicksSeparate(): void
    {
        $optins = [
            ['id' => 'email', 'goal' => 'grow_email_list', 'was_published' => '1'],
            ['id' => 'magnet', 'goal' => 'deliver_lead_magnet', 'was_published' => '1'],
            ['id' => 'offer', 'goal' => 'promote_offer', 'was_published' => '1'],
        ];
        $rows = [];
        foreach (['email' => 12, 'magnet' => 8, 'offer' => 7] as $id => $count) {
            $rows[] = ['optin_id' => $id, 'stat_date' => '2026-09-13', 'kind' => 'conversion', 'count' => $count];
        }
        $rows[] = ['optin_id' => 'magnet', 'stat_date' => '2026-09-13', 'kind' => 'lead_magnet_delivered', 'count' => 10];
        $report = Dashboard::of(StatRange::lastDays(7, '2026-09-13'), $rows, $optins);
        $impact = array_column($report['impact'], 'count', 'id');
        self::assertSame(20, $impact['leads']);
        self::assertSame(7, $impact['offers']);
        self::assertArrayNotHasKey('conversion_rate', $report);
    }
}

<?php

namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\TestCase;
use WConvert\Stats\StatRange;
use WConvert\Stats\MonthlyTargets;
use WConvert\Stats\Dashboard;
use WConvert\Stats\StatsRepository;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Milestone\MilestoneStore;
use WConvert\Rules\RuleVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;

final class MonthlyTargetsTest extends TestCase
{
    public function testMonthProgressEndsYesterdayAndFirstDayHasNoCompletedDays(): void
    {
        $range = StatRange::calendarMonth('2026-09', '2026-09-14');
        self::assertSame(['2026-09-01', '2026-09-13', 13], [$range->from, $range->to, $range->days()]);
        $first = StatRange::calendarMonth('2026-09', '2026-09-01');
        self::assertSame(0, $first->days());
        self::assertSame([], $first->eachDay());
        self::assertFalse($first->covers('2026-09-01'));
    }

    public function testTargetsSaveByMonthAndProgressReusesHistoricalCaptureCounters(): void
    {
        $db = new FakeConnection();
        $options = new FakeOptionStore();
        $targets = new MonthlyTargets($options, new Dashboard(new StatsRepository($db), new OptinRepository(
            $db, new PublishedSet($options), RuleVocabulary::fromManifest(__DIR__ . '/../../..'), new MilestoneStore($options)
        )));
        $targets->save('2026-09', ['leads' => 100], '2026-09-14');
        $db->answers = [
            [
                ['optin_id' => 'retired', 'stat_date' => '2026-09-13', 'kind' => 'conversion', 'count' => '34'],
                ['optin_id' => 'retired', 'stat_date' => '2026-09-14', 'kind' => 'conversion', 'count' => '20'],
            ],
            [['id' => 'retired', 'goal' => 'collect_enquiries', 'was_published' => '1', 'deleted_at' => '2026-09-14']],
        ];
        $report = $targets->read('2026-09-14');
        self::assertSame('2026-09', $report['month']);
        self::assertSame('2026-09-13', $report['through']);
        self::assertSame(34, $report['metrics'][0]['actual']);
        self::assertSame(100, $report['metrics'][0]['target']);
        self::assertSame([], $db->writes);
        $next = $targets->read('2026-10-01');
        self::assertNull($next['through']);
        self::assertNull($next['metrics'][0]['target']);
        self::assertEquals((object) ['leads' => 100], $next['previous_targets']);
    }

    public function testInvalidAndStaleWritesLeaveTargetsUntouchedAndRemovalKeepsPriorMonth(): void
    {
        $db = new FakeConnection();
        $options = new FakeOptionStore();
        $targets = new MonthlyTargets($options, new Dashboard(new StatsRepository($db), new OptinRepository(
            $db, new PublishedSet($options), RuleVocabulary::fromManifest(__DIR__ . '/../../..'), new MilestoneStore($options)
        )));
        $targets->save('2026-08', ['leads' => 80], '2026-08-31');
        $targets->save('2026-09', ['leads' => 100], '2026-09-14');
        foreach ([['leads' => 0], ['leads' => -1], ['leads' => 1.5], ['leads' => '10'], ['revenue' => 100], ['leads' => 100000001]] as $invalid) {
            try { $targets->save('2026-09', $invalid, '2026-09-14'); self::fail('Invalid target accepted'); }
            catch (\InvalidArgumentException) { self::assertSame(100, $targets->read('2026-09-14')['metrics'][0]['target']); }
        }
        try { $targets->save('2026-09', ['leads' => 200], '2026-10-01'); self::fail('Stale month accepted'); }
        catch (\DomainException) { self::assertSame(100, $targets->read('2026-09-14')['metrics'][0]['target']); }
        $targets->save('2026-09', [], '2026-09-14');
        self::assertNull($targets->read('2026-09-14')['metrics'][0]['target']);
        self::assertEquals((object) ['leads' => 80], $targets->read('2026-09-14')['previous_targets']);
        self::assertSame([], $db->writes);
    }

    public function testCompletedMonthsKeepTheirCalendarBoundariesAcrossLeapDayAndYearChange(): void
    {
        $february = StatRange::calendarMonth('2024-02', '2024-03-01');
        self::assertSame(['2024-02-01', '2024-02-29', 29], [$february->from, $february->to, $february->days()]);
        $december = StatRange::calendarMonth('2025-12', '2026-01-01');
        self::assertSame('2025-12-31', $december->to);
        $this->expectException(\InvalidArgumentException::class);
        StatRange::calendarMonth('2026-10', '2026-09-14');
    }

    public function testFailedOptionWriteCannotReportASuccessfulSave(): void
    {
        $db = new FakeConnection();
        $options = $this->createMock(\WConvert\Storage\OptionStore::class);
        $options->method('get')->willReturn([]);
        $options->expects(self::once())->method('set');
        $targets = new MonthlyTargets($options, new Dashboard(new StatsRepository($db), new OptinRepository(
            $db, new PublishedSet($options), RuleVocabulary::fromManifest(__DIR__ . '/../../..'), new MilestoneStore($options)
        )));
        $this->expectException(\RuntimeException::class);
        $targets->save('2026-09', ['leads' => 100], '2026-09-14');
    }

    public function testFirstDayReportHasZeroActualsAndDoesNotReadTheCounterTable(): void
    {
        $db = new FakeConnection();
        $options = new FakeOptionStore();
        $dashboard = new Dashboard(new StatsRepository($db), new OptinRepository(
            $db, new PublishedSet($options), RuleVocabulary::fromManifest(__DIR__ . '/../../..'), new MilestoneStore($options)
        ));
        $report = $dashboard->compare(StatRange::calendarMonth('2026-10', '2026-10-01'));
        self::assertSame(0, $report['days']);
        self::assertSame(0, $report['impact'][0]['count']);
        self::assertArrayNotHasKey('previous', $report);
        self::assertCount(1, $db->reads);
        self::assertStringNotContainsString('wconvert_stats', $db->reads[0]['table']);
    }
}

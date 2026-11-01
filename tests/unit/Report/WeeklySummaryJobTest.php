<?php

namespace WConvert\Tests\Unit\Report;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Report\SummaryMailer;
use WConvert\Report\WeeklySummary;
use WConvert\Report\WeeklySummaryJob;
use WConvert\Report\WeeklySummarySettings;
use WConvert\Rules\RuleVocabulary;
use WConvert\Stats\Dashboard;
use WConvert\Stats\StatsRepository;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;

#[CoversClass(WeeklySummaryJob::class)]
final class WeeklySummaryJobTest extends TestCase
{
    private FakeConnection $db;

    private FakeOptionStore $options;

    /** @var list<array{to: list<string>, subject: string, html: string, text: string}> */
    public array $sent = [];

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestTimezoneString'] = 'UTC';
        $GLOBALS['wconvertTestSchedule'] = [];
        $this->db = new FakeConnection();
        $this->options = new FakeOptionStore();
        $this->options->set('admin_email', 'owner@example.com');
        $this->sent = [];
    }

    public function testMondayNineInTheSiteZoneIsTheNextSend(): void
    {
        $utc = new \DateTimeZone('UTC');
        $at = static fn (string $when): int => (new \DateTimeImmutable($when, $utc))->getTimestamp();

        $this->assertSame($at('2026-11-02 09:00'), WeeklySummaryJob::nextSend($at('2026-11-01 10:00'), $utc), 'Sunday: tomorrow.');
        $this->assertSame($at('2026-11-02 09:00'), WeeklySummaryJob::nextSend($at('2026-11-02 08:00'), $utc), 'Monday before nine: today.');
        $this->assertSame($at('2026-11-09 09:00'), WeeklySummaryJob::nextSend($at('2026-11-02 09:30'), $utc), 'Monday after nine: next week.');

        $tehran = new \DateTimeZone('Asia/Tehran');
        $this->assertSame(
            (new \DateTimeImmutable('2026-11-02 09:00', $tehran))->getTimestamp(),
            WeeklySummaryJob::nextSend($at('2026-11-01 10:00'), $tehran)
        );
    }

    public function testScheduleRegistersOneWeeklyEvent(): void
    {
        WeeklySummaryJob::schedule();
        $first = $GLOBALS['wconvertTestSchedule'][WeeklySummaryJob::HOOK];
        WeeklySummaryJob::schedule();

        $this->assertSame($first, $GLOBALS['wconvertTestSchedule'][WeeklySummaryJob::HOOK]);
    }

    public function testSwitchedOffSendsNothing(): void
    {
        (new WeeklySummarySettings($this->options))->save(false, []);

        $this->assertSame(WeeklySummaryJob::OFF, $this->job()->run());
        $this->assertSame([], $this->sent);
    }

    public function testNothingIsSentBeforeTheFirstPublish(): void
    {
        $this->assertSame(WeeklySummary::SKIP_NOT_PUBLISHED, $this->job()->run());
        $this->assertSame([], $this->sent);
    }

    public function testAWeekWithNothingShownSendsNothing(): void
    {
        (new MilestoneStore($this->options))->recordFirstPublish('2026-09-01');

        $this->assertSame(WeeklySummary::SKIP_NOTHING_SHOWN, $this->job()->run());
        $this->assertSame([], $this->sent);
    }

    public function testAWeekWithViewsIsSentToTheAdminEmail(): void
    {
        (new MilestoneStore($this->options))->recordFirstPublish('2026-09-01');
        $yesterday = gmdate('Y-m-d', time() - 86400);
        $this->db->answers = [
            [['id' => 'email', 'goal' => 'grow_email_list', 'was_published' => '1']],
            [
                ['optin_id' => 'email', 'stat_date' => $yesterday, 'kind' => 'impression', 'count' => '200'],
                ['optin_id' => 'email', 'stat_date' => $yesterday, 'kind' => 'conversion', 'count' => '7'],
            ],
            [],
        ];

        $this->assertSame(WeeklySummaryJob::SENT, $this->job()->run());
        $this->assertCount(1, $this->sent);
        $this->assertSame(['owner@example.com'], $this->sent[0]['to']);
        $this->assertStringStartsWith('7 submissions last week', $this->sent[0]['subject']);
        $this->assertStringContainsString('<table role="presentation"', $this->sent[0]['html']);
        $this->assertStringContainsString('Submissions: 7', $this->sent[0]['text']);
    }

    public function testATestSendGoesOutEvenWithNothingToReport(): void
    {
        $this->assertTrue($this->job()->sendTest(['me@example.com']));
        $this->assertSame(['me@example.com'], $this->sent[0]['to']);
        $this->assertStringStartsWith('Test: ', $this->sent[0]['subject']);
    }

    private function job(): WeeklySummaryJob
    {
        $mailer = new class ($this) implements SummaryMailer {
            public function __construct(private readonly WeeklySummaryJobTest $test)
            {
            }

            public function send(array $to, string $subject, string $html, string $text): bool
            {
                $this->test->sent[] = ['to' => $to, 'subject' => $subject, 'html' => $html, 'text' => $text];

                return true;
            }
        };

        return new WeeklySummaryJob(
            new Dashboard(new StatsRepository($this->db), new OptinRepository(
                $this->db, new PublishedSet($this->options), RuleVocabulary::fromManifest(__DIR__ . '/../../..'), new MilestoneStore($this->options)
            )),
            new MilestoneStore($this->options),
            new WeeklySummarySettings($this->options),
            $mailer
        );
    }
}

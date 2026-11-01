<?php

namespace WConvert\Tests\Unit\Report;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Report\SummaryTemplate;
use WConvert\Report\WeeklySummary;

/**
 * What the weekly summary says, and when it says nothing (ADR 0176).
 */
#[CoversClass(WeeklySummary::class)]
#[CoversClass(SummaryTemplate::class)]
final class WeeklySummaryTest extends TestCase
{
    private const ADMIN = 'https://example.test/wp-admin/admin.php?page=wconvert';

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestTimezoneString'] = 'UTC';
    }

    public function testNothingIsSentBeforeTheFirstPublish(): void
    {
        $this->assertSame(WeeklySummary::SKIP_NOT_PUBLISHED, WeeklySummary::skipReason($this->week(), null));
    }

    public function testNothingIsSentForAWeekWhenNothingWasShown(): void
    {
        $quiet = $this->report(shown: 0, results: 0, rows: [$this->row('A', 'Welcome discount', 0, 0)]);

        $this->assertSame(WeeklySummary::SKIP_NOTHING_SHOWN, WeeklySummary::skipReason($quiet, '2026-09-01'));
    }

    public function testAPublishedWeekWithViewsIsSent(): void
    {
        $this->assertNull(WeeklySummary::skipReason($this->week(), '2026-09-01'));
    }

    public function testAWeekLeadsWithSubmissionsAndComparesWithTheWeekBefore(): void
    {
        $m = WeeklySummary::compose($this->week(), '2026-09-01', 'My site', self::ADMIN);

        $this->assertSame('96 submissions last week (+19%) · My site', $m['subject']);
        $this->assertSame('Weekly summary · 26 Oct – 1 Nov', $m['eyebrow']);
        $this->assertSame('96 submissions last week', $m['headline']);
        $this->assertSame('19% more than the week before, across 3 published campaigns.', $m['lede']);
        $this->assertSame([
            ['label' => 'Shown', 'value' => '4,812', 'change' => '+12% vs last week', 'tone' => 'up'],
            ['label' => 'Submissions', 'value' => '96', 'change' => '+19% vs last week', 'tone' => 'up'],
            ['label' => 'Submission rate', 'value' => '2.0%', 'change' => '+0.1 pts vs last week', 'tone' => 'up'],
        ], $m['tiles']);
        $this->assertSame(['eyebrow' => 'Best campaign', 'title' => 'Welcome discount', 'body' => '61 submissions from 2,540 times shown (2.4%)'], $m['best']);
        $this->assertSame(['eyebrow' => 'Worth a look', 'title' => 'Spring sale bar', 'body' => 'Shown less often. Fewer results, with a similar rate. Check display rules and site traffic.'], $m['insight']);
        $this->assertSame([
            ['label' => 'Open WConvert', 'url' => self::ADMIN . '#analytics?days=7'],
            ['label' => 'View leads', 'url' => self::ADMIN . '#leads'],
        ], $m['actions']);
        $this->assertSame(self::ADMIN . '#settings?group=reports', $m['footer']['url']);
    }

    public function testAFallingWeekSaysFewer(): void
    {
        $report = $this->week();
        $report['previous'] = $this->report(shown: 5000, results: 101, rows: []);

        $m = WeeklySummary::compose($report, '2026-09-01', 'My site', self::ADMIN);

        $this->assertSame('5% fewer than the week before, across 3 published campaigns.', $m['lede']);
        $this->assertSame('−5% vs last week', $m['tiles'][1]['change']);
        $this->assertSame('down', $m['tiles'][1]['tone']);
        $this->assertStringContainsString('(−5%)', $m['subject']);
    }

    public function testTheFirstWeekHasNoComparisonAndSaysWhenItWentLive(): void
    {
        $report = $this->report(shown: 418, results: 12, rows: [$this->row('A', 'Welcome discount', 12, 418)]);

        $m = WeeklySummary::compose($report, '2026-10-27', 'My site', self::ADMIN);

        $this->assertSame('Your first week: 12 submissions · My site', $m['subject']);
        $this->assertSame('12 submissions in your first week', $m['headline']);
        $this->assertSame('Welcome discount went live on Tuesday. Next Monday’s summary compares with this week.', $m['lede']);
        $this->assertSame(['First week', 'First week', 'First week'], array_column($m['tiles'], 'change'));
        $this->assertNull($m['best'], 'One campaign has no "best".');
        $this->assertNull($m['insight']);
    }

    public function testAnOfferOnlySiteCountsClicksAndOffersNoLeadsButton(): void
    {
        $report = $this->report(shown: 1000, results: 40, rows: [$this->row('A', 'Sale bar', 40, 1000)], group: 'offers', goal: 'promote_offer');

        $m = WeeklySummary::compose($report, '2026-09-01', 'My site', self::ADMIN);

        $this->assertSame('40 offer link clicks last week', $m['headline']);
        $this->assertSame(['Shown', 'Offer link clicks', 'Click rate'], array_column($m['tiles'], 'label'));
        $this->assertSame(['Open WConvert'], array_column($m['actions'], 'label'));
    }

    public function testAMessageOnlySiteReportsViewsAlone(): void
    {
        $report = $this->report(shown: 418, results: 0, rows: [$this->row('A', 'Free shipping', 0, 418)], group: null, goal: 'show_message');

        $m = WeeklySummary::compose($report, '2026-09-01', 'My site', self::ADMIN);

        $this->assertSame('Shown 418 times last week', $m['headline']);
        $this->assertCount(1, $m['tiles']);
        $this->assertNull($m['best']);
    }

    public function testATestSendSaysSoInTheSubject(): void
    {
        $m = WeeklySummary::compose($this->week(), '2026-09-01', 'My site', self::ADMIN, true);

        $this->assertStringStartsWith('Test: 96 submissions', $m['subject']);
    }

    public function testTheEmailEscapesCampaignNamesAndCarriesATextPart(): void
    {
        $report = $this->week();
        $report['goals'][0]['optins'][0]['name'] = '<b>Bold</b> & co';
        $m = WeeklySummary::compose($report, '2026-09-01', 'My site', self::ADMIN);

        $html = SummaryTemplate::html($m);
        $text = SummaryTemplate::text($m);

        $this->assertStringContainsString('&lt;b&gt;Bold&lt;/b&gt; &amp; co', $html);
        $this->assertStringNotContainsString('<b>Bold</b>', $html);
        $this->assertStringNotContainsString('<img', $html, 'No images: it must read the same with images blocked.');
        $this->assertStringContainsString('prefers-color-scheme:dark', $html);
        $this->assertStringContainsString('Open WConvert: ' . self::ADMIN . '#analytics?days=7', $text);
        $this->assertStringContainsString('Turn off weekly summaries: ' . self::ADMIN . '#settings?group=reports', $text);
    }

    /** @return array<string, mixed> */
    private function week(): array
    {
        $report = $this->report(shown: 4812, results: 96, rows: [
            $this->row('A', 'Welcome discount', 61, 2540),
            $this->row('B', 'Spring sale bar', 20, 1500),
            $this->row('C', 'Exit offer', 15, 772),
        ]);
        $report['previous'] = $this->report(shown: 4296, results: 81, rows: []);
        $report['insights'] = [[
            'name' => 'Spring sale bar',
            'title' => 'Shown less often',
            'note' => 'Fewer results, with a similar rate. Check display rules and site traffic.',
        ]];

        return $report;
    }

    /**
     * A {@see \WConvert\Stats\Dashboard} payload with one Goal card.
     *
     * @param list<array<string, mixed>> $rows
     * @return array<string, mixed>
     */
    private function report(int $shown, int $results, array $rows, ?string $group = 'leads', string $goal = 'grow_email_list'): array
    {
        $labels = ['leads' => 'Submissions', 'offers' => 'Offer link clicks', 'carts' => 'Cart return clicks', 'additions' => 'Basket additions'];
        $impact = [];

        foreach ($labels as $id => $label) {
            $impact[] = ['id' => $id, 'label' => $label, 'count' => $id === $group ? $results : 0, 'goals' => $id === $group ? [$goal] : []];
        }

        $impact[] = ['id' => 'impressions', 'label' => 'Shown', 'count' => $shown, 'goals' => [$goal]];

        return [
            'from' => '2026-10-26',
            'to' => '2026-11-01',
            'days' => 7,
            'goals' => [['goal' => $goal, 'impressions' => $shown, 'conversions' => $results, 'optins' => $rows]],
            'impact' => $impact,
        ];
    }

    /** @return array<string, mixed> */
    private function row(string $id, string $name, int $conversions, int $impressions): array
    {
        return ['id' => $id, 'name' => $name, 'parent_id' => null, 'status' => 'published', 'conversions' => $conversions, 'impressions' => $impressions];
    }
}

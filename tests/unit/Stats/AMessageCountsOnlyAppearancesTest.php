<?php

namespace WConvert\Tests\Unit\Stats;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Goal\Goal;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Rest\BeaconController;
use WConvert\Rest\RateLimit;
use WConvert\Rules\RuleVocabulary;
use WConvert\Stats\Dashboard;
use WConvert\Stats\Insights;
use WConvert\Stats\StatRange;
use WConvert\Stats\StatsRepository;
use WConvert\Template\ConvertingAct;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeTransientStore;
use WConvert\Tests\Unit\Support\InstalledRules;
use WConvert\Tests\Unit\Support\JourneyFixture;
use WP_REST_Request;

/**
 * **Show a message counts appearances and nothing else** (ADR 0163): no
 * conversion beacon, no rate, no "rate fell" insight, and its Playbooks start
 * without the design's counted link.
 */
#[CoversClass(BeaconController::class)]
#[CoversClass(Dashboard::class)]
#[CoversClass(Insights::class)]
#[CoversClass(Prefill::class)]
final class AMessageCountsOnlyAppearancesTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';

    private const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        . ' (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

    public function testAConversionBeaconForAMessageIsNotCounted(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];
        $_SERVER['REMOTE_ADDR'] = '198.51.100.7';
        $stats = new FakeConnection();
        $published = new PublishedSet(new FakeOptionStore());
        $optins = new OptinRepository(new FakeConnection(), $published, RuleVocabulary::fromManifest(self::PLUGIN_DIR), new MilestoneStore(new FakeOptionStore()));
        $optin = $optins->create('Free shipping', 'show_message', [
            'display_rules' => \WConvert\Tests\Unit\Support\DisplayFixture::plan([['type' => 'page_load']]),
            'template' => ['tree' => JourneyFixture::tree(['steps' => [['type' => 'stack', 'children' => [['type' => 'heading', 'text' => 'Free shipping']]]]]), 'tokens' => []],
        ]);
        $optins->publish($optin->id);

        $request = new WP_REST_Request('POST', '/wconvert/v1/beacon');
        $request->set_header('user-agent', self::CHROME);
        $request->set_body((string) json_encode(['events' => [
            ['optin_id' => $optin->id, 'kind' => 'impression'],
            ['optin_id' => $optin->id, 'kind' => 'conversion'],
        ]]));
        (new BeaconController($published, new StatsRepository($stats), new RateLimit(new FakeTransientStore()), InstalledRules::free()))->record($request);

        $this->assertCount(1, $stats->upserts);
        $this->assertSame('impression', $stats->upserts[0]['params'][2]);
    }

    public function testTheDashboardReportsAppearancesWithNoRateAndNoResult(): void
    {
        $payload = Dashboard::of(
            StatRange::lastDays(3, '2026-08-25'),
            [
                ['optin_id' => 'M', 'stat_date' => '2026-08-24', 'kind' => 'impression', 'count' => '400'],
                ['optin_id' => 'O', 'stat_date' => '2026-08-24', 'kind' => 'impression', 'count' => '100'],
                ['optin_id' => 'O', 'stat_date' => '2026-08-24', 'kind' => 'conversion', 'count' => '7'],
            ],
            [
                ['id' => 'M', 'name' => 'Free shipping', 'goal' => 'show_message', 'deleted_at' => null, 'was_published' => '1'],
                ['id' => 'O', 'name' => 'Sale', 'goal' => 'promote_offer', 'deleted_at' => null, 'was_published' => '1'],
            ]
        );

        $cards = array_column($payload['goals'], null, 'goal');
        $message = $cards['show_message'];
        $this->assertSame('none', $message['action']);
        $this->assertSame(400, $message['headline']);
        $this->assertSame('Appearances', $message['headline_label']);
        $this->assertNull($message['conversion_rate']);
        $this->assertNull($message['optins'][0]['conversion_rate']);
        $this->assertSame(0.07, $cards['promote_offer']['conversion_rate']);

        $impact = array_column($payload['impact'], null, 'id');
        $this->assertSame(7, $impact['offers']['count']);
        $this->assertSame(['promote_offer'], $impact['offers']['goals']);
        $this->assertSame(500, $impact['impressions']['count']);
    }

    public function testAMessageNeverReadsAsARateThatFell(): void
    {
        $report = ['from' => '2026-09-01', 'to' => '2026-09-30', 'days' => 30, 'complete_days' => true,
            'goals' => [['goal' => 'show_message', 'action' => 'none', 'result_label' => 'Appearances', 'rate_label' => 'Not counted', 'optins' => [
                ['id' => 'a', 'name' => 'Notice', 'status' => 'published', 'published_at' => '2026-08-01 12:00:00', 'impressions' => 4000, 'conversions' => 20],
            ]]],
            'previous' => ['days' => 30, 'goals' => [['optins' => [['id' => 'a', 'impressions' => 1000, 'conversions' => 60]]]]]];

        $this->assertSame([], Insights::forReport($report));
        $report['goals'][0]['action'] = 'click';
        $this->assertSame('lower_rate', Insights::forReport($report)[0]['rule_id']);
    }

    public function testMessagePlaybooksStartWithNothingToCount(): void
    {
        $vocabulary = TemplateVocabulary::fromManifest(self::PLUGIN_DIR);
        $templates = TemplateLibrary::fromDirectory($vocabulary, self::PLUGIN_DIR);
        $playbooks = PlaybookLibrary::fromDirectory($templates, $vocabulary, RuleVocabulary::fromManifest(self::PLUGIN_DIR), self::PLUGIN_DIR);
        $prefill = new Prefill($playbooks, $templates, $vocabulary, InstalledRules::free());

        $messages = $playbooks->servicing(Goal::ShowMessage);
        $this->assertCount(2, $messages);
        foreach ($messages as $playbook) {
            $draft = $prefill->fromPlaybook($playbook->id);
            $this->assertNotNull($draft);
            $this->assertSame('show_message', $draft['goal']);
            $this->assertSame([], ConvertingAct::offeredIn($draft['config']['template']['tree']), $playbook->id);
            $this->assertArrayNotHasKey('unchecked_links', $draft['config'], $playbook->id);
            $this->assertNull(Goal::ShowMessage->outcome()->designIssue($draft['config']), $playbook->id);
        }
    }
}

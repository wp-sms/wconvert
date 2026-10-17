<?php

namespace WConvert\Tests\Unit\Agent;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Agent\Abilities;
use WConvert\Agent\Read;
use WConvert\Agent\Reply;
use WConvert\Rules\DisplayPlan;
use WConvert\Support\Tier;
use WP_Error;

/**
 * #282: agents read WConvert through WordPress Abilities (ADR 0154).
 *
 * The abilities read through the routes the admin reads, so this drives them
 * against the real controllers behind `rest_do_request()` ({@see AgentSite}).
 */
#[CoversClass(Abilities::class)]
#[CoversClass(Reply::class)]
#[CoversClass(\WConvert\Agent\CampaignReader::class)]
#[CoversClass(Read\FindCampaigns::class)]
#[CoversClass(Read\GetCampaign::class)]
#[CoversClass(Read\ListOccasions::class)]
#[CoversClass(Read\GetOccasion::class)]
#[CoversClass(Read\FindDesigns::class)]
#[CoversClass(Read\ReviewCampaign::class)]
#[CoversClass(Read\GetStats::class)]
final class ReadAbilitiesTest extends TestCase
{
    /** The abilities that change nothing. */
    private const READS = [
        'wconvert/find-campaigns', 'wconvert/get-campaign', 'wconvert/list-occasions', 'wconvert/get-occasion',
        'wconvert/find-designs', 'wconvert/list-starters', 'wconvert/review-campaign', 'wconvert/get-stats',
    ];

    private AgentSite $site;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestActions'] = [];
        $GLOBALS['wconvertTestAbilities'] = [];
        $GLOBALS['wconvertTestAbilityCategories'] = [];
        $GLOBALS['wconvertTestCapabilities'] = ['manage_options'];
        $this->site = new AgentSite();
        $this->site->occasions([['id' => 'black-friday-2026', 'name' => 'Black Friday 2026', 'start' => '2026-11-20', 'end' => '2026-12-01']]);
    }

    protected function tearDown(): void
    {
        $this->site->close();
        $GLOBALS['wconvertTestCapabilities'] = [];
        $GLOBALS['wconvertTestActions'] = [];
    }

    public function testNothingRegistersOnAWordPressWithoutTheAbilitiesApi(): void
    {
        Abilities::hooks(static fn (): array => [], static fn (string $function): bool => false);

        self::assertArrayNotHasKey('wp_abilities_api_init', $GLOBALS['wconvertTestActions']);
        self::assertArrayNotHasKey('wp_abilities_api_categories_init', $GLOBALS['wconvertTestActions']);
        self::assertArrayNotHasKey('mcp_adapter_init', $GLOBALS['wconvertTestActions']);
    }

    public function testEveryAbilityRegistersInTheCategoryForManagersOnly(): void
    {
        Abilities::hooks(fn (): array => $this->site->abilities());
        do_action('wp_abilities_api_categories_init');
        do_action('wp_abilities_api_init');

        self::assertArrayHasKey(Abilities::CATEGORY, $GLOBALS['wconvertTestAbilityCategories']);
        self::assertSame(Abilities::NAMES, array_keys($GLOBALS['wconvertTestAbilities']));
        foreach ($GLOBALS['wconvertTestAbilities'] as $name => $args) {
            self::assertSame('wconvert', $args['category'], $name);
            self::assertTrue($args['meta']['show_in_rest'], $name);
            self::assertTrue($args['meta']['mcp']['public'], $name);
            self::assertSame(in_array($name, self::READS, true), $args['meta']['annotations']['readonly'], $name);
            self::assertStringNotContainsString('"type":["', (string) wp_json_encode($args['input_schema']), $name . ' uses a union type');
            $permitted = ($args['permission_callback'])([]);
            if (in_array($name, ['wconvert/publish', 'wconvert/pause'], true)) {
                // Off by default (ADR 0154 §7); PublishAbilitiesTest turns it on.
                self::assertInstanceOf(WP_Error::class, $permitted, $name);
                self::assertTrue($args['meta']['annotations']['destructive'], $name);
            } else {
                self::assertTrue($permitted, $name);
                self::assertFalse($args['meta']['annotations']['destructive'], $name);
            }
        }
        $GLOBALS['wconvertTestCapabilities'] = ['edit_posts'];
        foreach ($GLOBALS['wconvertTestAbilities'] as $name => $args) {
            self::assertFalse(($args['permission_callback'])([]), $name . ' answered someone who cannot manage WConvert');
        }
    }

    /** No reply carries a design's tree, its tokens, its forms, or anything a visitor typed. */
    public function testNoReplyCarriesATreeOrALead(): void
    {
        $id = $this->bar();
        $replies = [
            $this->ask('wconvert/find-campaigns', []),
            $this->ask('wconvert/get-campaign', ['campaign_id' => $id]),
            $this->ask('wconvert/list-occasions', []),
            $this->ask('wconvert/get-occasion', ['occasion_id' => 'black-friday-2026']),
            $this->ask('wconvert/get-occasion', ['occasion_id' => 'black-friday-2026', 'format' => 'export']),
            $this->ask('wconvert/find-designs', ['per_page' => 50]),
            $this->ask('wconvert/review-campaign', ['campaign_id' => $id]),
        ];
        foreach ($replies as $reply) {
            $json = (string) wp_json_encode($reply);
            foreach (['"tree":', '"tokens":', '"submissions":', '"email":', '"phone":', '"lead', '@'] as $never) {
                self::assertStringNotContainsString($never, $json);
            }
        }
    }

    public function testTheGuardDropsForbiddenKeysAtAnyDepth(): void
    {
        self::assertSame(
            ['a' => ['b' => [['keep' => 1]]]],
            Reply::guard(['a' => ['b' => [['keep' => 1, 'tree' => ['steps' => []], 'email' => 'x@y.z']]], 'leads' => [1]])
        );
    }

    public function testACampaignReadsByRoleWithItsOccasionScheduleAndRevision(): void
    {
        $id = $this->bar();
        $campaign = $this->ask('wconvert/get-campaign', ['campaign_id' => $id]);

        self::assertSame('Black Friday bar', $campaign['name']);
        self::assertSame('draft', $campaign['status']);
        self::assertSame(['design_id' => 'bar-announcement', 'name' => 'Announcement bar'], [
            'design_id' => $campaign['design']['design_id'], 'name' => $campaign['design']['name'],
        ]);
        self::assertSame('30% off everything', $campaign['copy']['headline']);
        self::assertSame(['occasion_id' => 'black-friday-2026', 'name' => 'Black Friday 2026'], $campaign['occasion']);
        self::assertSame(['wall' => '2026-11-20 00:00', 'timezone' => 'UTC'], $campaign['schedule']['starts_at']);
        self::assertSame(['everywhere' => false, 'show_on' => ['/black-friday/*'], 'hide_on' => []], $campaign['pages']);
        self::assertSame(16, strlen($campaign['revision']));
        self::assertSame('https://example.test/?wconvert-preview=' . $id, $campaign['preview_url']);
    }

    /** ADR 0149 §5: a deleted occasion's link reads as none, here as on the list. */
    public function testACampaignOfADeletedOccasionBelongsToNone(): void
    {
        $id = $this->bar();
        $this->site->occasions([]);

        self::assertNull($this->ask('wconvert/get-campaign', ['campaign_id' => $id])['occasion']);
        self::assertNull($this->ask('wconvert/find-campaigns', [])['items'][0]['occasion']);
    }

    public function testAnUnknownCampaignSaysWhereToLook(): void
    {
        $missing = $this->call('wconvert/get-campaign', ['campaign_id' => '01J00000000000000000000000']);

        self::assertInstanceOf(WP_Error::class, $missing);
        self::assertStringContainsString('wconvert/find-campaigns', $missing->get_error_message());
    }

    public function testListsPage(): void
    {
        foreach (range(1, 3) as $n) $this->bar('Bar ' . $n);

        $page = $this->ask('wconvert/find-campaigns', ['page' => 2, 'per_page' => 2]);

        self::assertSame(3, $page['total']);
        self::assertSame(2, $page['page']);
        self::assertCount(1, $page['items']);
        self::assertSame(50, Reply::paged(range(1, 80), ['per_page' => 500])['per_page']);
    }

    public function testFindCampaignsFiltersByOccasionAndStatus(): void
    {
        $this->bar();
        $this->site->draft('Newsletter', 'grow_email_list', ['display_type' => 'popup', 'display_rules' => DisplayPlan::immediate()]);

        self::assertCount(1, $this->ask('wconvert/find-campaigns', ['occasion_id' => 'black-friday-2026'])['items']);
        self::assertCount(2, $this->ask('wconvert/find-campaigns', ['status' => 'draft'])['items']);
        self::assertCount(0, $this->ask('wconvert/find-campaigns', ['status' => 'published'])['items']);
    }

    public function testAnOccasionCountsItsCampaignsAndExportsWithoutATree(): void
    {
        $this->bar();

        $occasions = $this->ask('wconvert/list-occasions', []);
        self::assertSame(1, $occasions['occasions'][0]['campaign_count']);
        self::assertSame('2026-12-01', $occasions['occasions'][0]['last_day']);

        $export = $this->ask('wconvert/get-occasion', ['occasion_id' => 'black-friday-2026', 'format' => 'export']);
        self::assertSame('bar-announcement', $export['document']['campaigns'][0]['design']);
        self::assertSame('30% off everything', $export['document']['campaigns'][0]['copy']['headline']);
    }

    public function testFreeListsOnlyDesignsItCanRun(): void
    {
        $this->site->close();
        $this->site = new AgentSite(Tier::Free);

        $types = array_unique(array_column($this->ask('wconvert/find-designs', ['per_page' => 50])['items'], 'display_type'));
        sort($types);

        self::assertSame(['inline', 'popup'], $types);
        self::assertSame(0, $this->ask('wconvert/find-designs', ['display_type' => 'floating_bar'])['total']);
    }

    public function testDesignsNameTheirRolesAndWhatTheyNeed(): void
    {
        $designs = array_column($this->ask('wconvert/find-designs', ['display_type' => 'floating_bar', 'per_page' => 50])['items'], null, 'design_id');

        self::assertContains('headline', $designs['bar-countdown']['slot_roles']);
        self::assertTrue($designs['bar-countdown']['has_countdown']);
        self::assertTrue($designs['bar-countdown']['has_link_button']);
    }

    public function testReviewListsEveryRefusalWithoutPublishing(): void
    {
        $id = $this->site->draft('Empty', 'grow_email_list', ['display_type' => 'popup', 'display_rules' => DisplayPlan::immediate()]);

        $review = $this->ask('wconvert/review-campaign', ['campaign_id' => $id]);

        self::assertFalse($review['ready_to_publish']);
        self::assertSame('wconvert_optin_needs_a_design', $review['issues'][0]['code']);
        self::assertNull($this->site->optins->find($id)?->publishedAt);
    }

    /** Arms count toward their campaign; the total's clicks come from click goals only. */
    public function testStatsAddArmsAndCountClicksOnlyFromClickGoals(): void
    {
        $report = ['goals' => [
            ['goal' => 'promote_offer', 'action' => 'click', 'optins' => [
                ['id' => 'A', 'name' => 'Bar', 'parent_id' => null, 'impressions' => 100, 'conversions' => 10, 'dismissals' => 5],
                ['id' => 'A2', 'name' => 'Bar B', 'parent_id' => 'A', 'impressions' => 100, 'conversions' => 30, 'dismissals' => 5],
            ]],
            ['goal' => 'grow_email_list', 'action' => 'submit', 'optins' => [
                ['id' => 'B', 'name' => 'Teaser', 'parent_id' => null, 'impressions' => 50, 'conversions' => 20, 'dismissals' => 1],
                ['id' => 'C', 'name' => 'Elsewhere', 'parent_id' => null, 'impressions' => 9, 'conversions' => 9, 'dismissals' => 9],
            ]],
        ]];

        $counted = Read\GetStats::counted($report, ['A', 'B']);

        self::assertSame(['A', 'B'], array_column($counted['campaigns'], 'campaign_id'));
        self::assertSame(200, $counted['campaigns'][0]['shown']);
        self::assertSame(0.2, $counted['campaigns'][0]['conversion_rate']);
        self::assertSame(['shown' => 250, 'dismissed' => 11, 'clicks' => 40, 'click_rate' => 0.2], $counted['total']);
    }

    private function bar(string $name = 'Black Friday bar'): string
    {
        $config = $this->site->builder->build([
            'display_type' => 'floating_bar', 'design' => 'bar-announcement',
            'copy' => ['headline' => '30% off everything', 'cta_label' => 'Shop the sale'],
            'link' => 'https://example.test/black-friday/',
            'targeting' => ['mode' => 'selected', 'include' => [['type' => 'url', 'value' => '/black-friday/*']]],
            'starts_at' => '2026-11-20 00:00', 'ends_at' => '2026-12-02 00:00',
        ], 'black-friday-2026');
        self::assertIsArray($config);
        return $this->site->draft($name, 'promote_offer', $config);
    }

    /**
     * Run one ability as WordPress would, through its registered callback,
     * and expect a reply.
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    private function ask(string $name, array $input): array
    {
        $reply = $this->call($name, $input);
        self::assertIsArray($reply, $reply instanceof WP_Error ? $reply->get_error_message() : '');
        return $reply;
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>|WP_Error
     */
    private function call(string $name, array $input): array|WP_Error
    {
        return $this->site->call($name, $input);
    }
}

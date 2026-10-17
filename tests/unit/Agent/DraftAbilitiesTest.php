<?php

namespace WConvert\Tests\Unit\Agent;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Agent\AgentCampaignInput;
use WConvert\Agent\Draft;
use WConvert\Support\Tier;
use WP_Error;

/**
 * #283: agents make and change drafts, and never publish by doing so.
 *
 * Every refusal is asserted by its exact sentence, because the sentence is
 * the whole of what an agent has to go on (ADR 0154 §5).
 */
#[CoversClass(AgentCampaignInput::class)]
#[CoversClass(Draft\CreateCampaign::class)]
#[CoversClass(Draft\UpdateCampaign::class)]
#[CoversClass(Draft\SaveOccasion::class)]
#[CoversClass(Draft\CopyOccasion::class)]
final class DraftAbilitiesTest extends TestCase
{
    private AgentSite $site;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestAbilities'] = [];
        $GLOBALS['wconvertTestActions'] = [];
        $GLOBALS['wconvertTestCapabilities'] = ['manage_options'];
        $this->site = new AgentSite();
        $this->site->occasions([['id' => 'black-friday-2026', 'name' => 'Black Friday 2026', 'start' => '2026-11-20', 'end' => '2026-12-01']]);
    }

    protected function tearDown(): void
    {
        $this->site->close();
        $GLOBALS['wconvertTestCapabilities'] = [];
    }

    public function testCreateLeavesADraftAndSaysWhatIsFilledAndWhereToLook(): void
    {
        $created = $this->ask('wconvert/create-campaign', self::countdownBar());

        self::assertSame('draft', $created['status']);
        self::assertSame(['headline', 'cta_label'], $created['filled_roles']);
        self::assertSame([], $created['empty_roles']);
        self::assertSame('https://example.test/?wconvert-preview=' . $created['campaign_id'], $created['preview_url']);
        self::assertSame('UTC', $created['timezone']);
        // ADR 0149 §3: no dates given, so the occasion's.
        self::assertSame('2026-11-20 00:00', $created['schedule']['starts_at']['wall']);
        self::assertSame('2026-12-02 00:00', $created['schedule']['ends_at']['wall']);
        self::assertSame(['POST /optins'], $this->site->dispatched);
        self::assertSame($this->ask('wconvert/get-campaign', ['campaign_id' => $created['campaign_id']])['revision'], $created['revision']);

        $optin = $this->site->optins->find($created['campaign_id']);
        self::assertNotNull($optin);
        self::assertNull($optin->publishedAt);
        self::assertSame('black-friday-2026', $optin->config['occasion']);
        self::assertSame('/black-friday/', \WConvert\Template\OptinConfigBuilder::linkIn($optin->config));
        self::assertSame(['mode' => 'selected', 'include' => [['type' => 'url', 'value' => '/black-friday/*']]], $optin->config['targeting']);
        self::assertSame(1, $optin->config['frequency']['maxPerSession']);
    }

    /** "In my blog posts": every single post, placed after a paragraph, read back as written. */
    public function testAnInlineBannerGoesIntoBlogPosts(): void
    {
        $created = $this->ask('wconvert/create-campaign', [
            'name' => 'Blog banner', 'goal' => 'promote_offer', 'design_id' => 'inline-cta', 'copy' => ['headline' => '30% off'],
            'link' => '/black-friday/', 'pages' => ['show_on_types' => ['post']], 'inline_position' => 'after_paragraph', 'after_paragraph' => 3,
        ]);

        $optin = $this->site->optins->find($created['campaign_id']);
        self::assertNotNull($optin);
        self::assertSame(['mode' => 'selected', 'include' => [['type' => 'singular', 'value' => 'post']]], $optin->config['targeting']);
        self::assertSame(['position' => 'after_paragraph', 'paragraph' => 3, 'fallback' => 'after_content'], $optin->config['inline_placement']);
        self::assertSame(['post'], $this->ask('wconvert/get-campaign', ['campaign_id' => $created['campaign_id']])['pages']['show_on_types']);
    }

    public function testAnInlinePositionIsOnlyForInline(): void
    {
        $refused = $this->site->call('wconvert/create-campaign', ['inline_position' => 'after_content'] + self::countdownBar());

        self::assertInstanceOf(WP_Error::class, $refused);
        self::assertSame('inline_position is only for an inline campaign. Leave it out for this display type.', $refused->get_error_message());
    }

    public function testDesignsForAGoalIncludeThoseWhoseLinkTheCampaignGives(): void
    {
        $designs = array_column($this->ask('wconvert/find-designs', ['display_type' => 'popup', 'goal' => 'promote_offer', 'per_page' => 50])['items'], 'design_id');

        self::assertContains('deadline-panel', $designs);
        self::assertNotContains('bold-ask', $designs);
    }

    public function testAStarterIsPrefilledAndTheGivenWordsReplaceItsOwn(): void
    {
        $created = $this->ask('wconvert/create-campaign', [
            'name' => 'Announcement', 'goal' => 'promote_offer', 'starter_id' => 'announcement-bar',
            'copy' => ['headline' => 'Black Friday starts now'], 'link' => '/black-friday/',
        ]);

        $campaign = $this->ask('wconvert/get-campaign', ['campaign_id' => $created['campaign_id']]);
        self::assertSame('Black Friday starts now', $campaign['copy']['headline']);
        self::assertNotSame('', $campaign['copy']['cta_label'] ?? '');
        self::assertSame('/black-friday/', $campaign['link']);
    }

    /** @return array<string, array{array<string, mixed>, string}> */
    public static function refusals(): array
    {
        $bar = self::countdownBar();
        return [
            'an unknown role names the design\'s' => [['copy' => ['subtitle' => 'Hi']] + $bar, 'This design has no slot for subtitle. It takes: headline, cta_label.'],
            'markup in copy' => [['copy' => ['headline' => '<b>30% off</b>']] + $bar, 'headline is plain text only; drop the HTML.'],
            'a design the site lacks' => [['design_id' => 'no-such-design'] + $bar, 'That design is not on this site. Use a design_id from wconvert/find-designs.'],
            'a countdown with no end' => [array_diff_key($bar, ['occasion_id' => 1]), 'This design counts down to the campaign\'s end. Give ends_at ("YYYY-MM-DD HH:MM"), or an occasion_id whose dates it takes.'],
            'an offer with no link' => [array_diff_key($bar, ['link' => 1]), 'A promote_offer campaign sends visitors to the offer. Give link: a full address or a path like "/black-friday/".'],
            'a display type the design is not' => [['display_type' => 'popup'] + $bar, 'That design is a floating_bar, not a popup. Leave display_type out, or pick a popup design with wconvert/find-designs.'],
            'both a design and a starter' => [['starter_id' => 'announcement-bar'] + $bar, 'Give either a design_id (from wconvert/find-designs) or a starter_id (from wconvert/list-starters), not both.'],
            'an occasion that does not exist' => [['occasion_id' => 'cyber-monday'] + $bar, 'No occasion has that occasion_id. List them with wconvert/list-occasions, or make one with wconvert/save-occasion.'],
            'an unreadable date' => [['ends_at' => 'next Friday'] + $bar, 'ends_at must be a date and time like "2026-11-20 00:00", in the site timezone, or "" for none.'],
            'pages that are not paths' => [['pages' => ['show_on' => ['black-friday']]] + $bar, 'show_on takes paths on this site starting with "/", e.g. "/black-friday/*".'],
            // The route's own refusal, passed through unchanged.
            'a schedule that ends first' => [['starts_at' => '2026-12-02 00:00', 'ends_at' => '2026-11-20 00:00'] + $bar, 'A campaign’s schedule has to end after it starts.'],
        ];
    }

    /** @param array<string, mixed> $input */
    #[DataProvider('refusals')]
    public function testEachRefusalSaysHowToFixIt(array $input, string $message): void
    {
        $refused = $this->site->call('wconvert/create-campaign', $input);

        self::assertInstanceOf(WP_Error::class, $refused);
        self::assertSame($message, $refused->get_error_message());
        self::assertSame([], $this->site->optins->summaries());
    }

    public function testAProDesignOnFreeNamesPro(): void
    {
        $this->site->close();
        $this->site = new AgentSite(Tier::Free);
        $this->site->occasions([['id' => 'black-friday-2026', 'name' => 'Black Friday 2026', 'start' => '2026-11-20', 'end' => '2026-12-01']]);

        $refused = $this->site->call('wconvert/create-campaign', self::countdownBar());

        self::assertInstanceOf(WP_Error::class, $refused);
        self::assertSame('That design needs WConvert Pro, which this site does not have. Pick one from wconvert/find-designs, which lists only designs this site can run.', $refused->get_error_message());
    }

    /** A live campaign's edit is a draft edit: what visitors see does not move. */
    public function testUpdateChangesTheDraftAndLeavesTheLiveVersion(): void
    {
        $id = $this->ask('wconvert/create-campaign', self::countdownBar())['campaign_id'];
        $this->site->optins->publish($id);
        $revision = $this->ask('wconvert/get-campaign', ['campaign_id' => $id])['revision'];

        $updated = $this->ask('wconvert/update-campaign', ['campaign_id' => $id, 'expected_revision' => $revision, 'copy' => ['headline' => 'Last day: 30% off'], 'starts_at' => '']);

        self::assertSame('Last day: 30% off', $updated['copy']['headline']);
        self::assertTrue($updated['has_unpublished_changes']);
        self::assertSame('Saved to the draft. The published version is unchanged until it is published again; preview_url shows the draft.', $updated['next']);
        $optin = $this->site->optins->find($id);
        self::assertNotNull($optin);
        self::assertSame('Shop the sale', \WConvert\Template\SlotRoles::copyFrom($optin->publishedConfig['template']['tree'] ?? [], $this->site->templates)['cta_label']);
        self::assertSame('Ends Monday: 30% off', \WConvert\Template\SlotRoles::copyFrom($optin->publishedConfig['template']['tree'] ?? [], $this->site->templates)['headline']);
        self::assertArrayNotHasKey('starts_at', $optin->config);
        self::assertSame('2026-12-02 00:00', $optin->config['ends_at']);
    }

    /** ADR 0149 §5: the read detaches a deleted occasion, and the revision must still be the stored draft's. */
    public function testACampaignWhoseOccasionWasDeletedCanStillBeUpdated(): void
    {
        $id = $this->ask('wconvert/create-campaign', self::countdownBar())['campaign_id'];
        $this->site->occasions([]);
        $campaign = $this->ask('wconvert/get-campaign', ['campaign_id' => $id]);
        self::assertNull($campaign['occasion']);

        $updated = $this->ask('wconvert/update-campaign', ['campaign_id' => $id, 'expected_revision' => $campaign['revision'], 'name' => 'Still editable']);

        self::assertSame('Still editable', $updated['name']);
    }

    public function testUpdateRefusesAStaleRevision(): void
    {
        $id = $this->ask('wconvert/create-campaign', self::countdownBar())['campaign_id'];
        $revision = $this->ask('wconvert/get-campaign', ['campaign_id' => $id])['revision'];
        $this->ask('wconvert/update-campaign', ['campaign_id' => $id, 'expected_revision' => $revision, 'name' => 'Renamed']);

        $stale = $this->site->call('wconvert/update-campaign', ['campaign_id' => $id, 'expected_revision' => $revision, 'name' => 'Again']);

        self::assertInstanceOf(WP_Error::class, $stale);
        self::assertSame('wconvert_optin_changed', $stale->get_error_code());
        self::assertSame(409, $stale->get_error_data()['status']);
        self::assertSame('Someone changed this campaign since you read it. Read it again, then reapply your change with the new revision.', $stale->get_error_message());
        self::assertSame(16, strlen((string) $stale->get_error_data()['revision']));
        self::assertSame('Renamed', $this->site->optins->find($id)?->name);
    }

    public function testSavingAnOccasionTwiceLeavesOne(): void
    {
        $input = ['name' => 'Spring launch', 'start' => '2027-03-01', 'end' => '2027-03-14'];

        $first = $this->ask('wconvert/save-occasion', $input);
        $second = $this->ask('wconvert/save-occasion', $input);
        $byId = $this->ask('wconvert/save-occasion', ['occasion_id' => $first['occasion']['occasion_id']] + $input);

        self::assertSame('spring-launch-2027', $first['occasion']['occasion_id']);
        self::assertTrue($first['added']);
        self::assertFalse($second['added']);
        self::assertFalse($byId['added']);
        self::assertCount(2, $this->site->occasions->read()['items']);
    }

    public function testMovingAnOccasionMovesItsCampaignsDraftsOnlyWhenAsked(): void
    {
        $id = $this->ask('wconvert/create-campaign', self::countdownBar())['campaign_id'];

        $still = $this->ask('wconvert/save-occasion', ['occasion_id' => 'black-friday-2026', 'name' => 'Black Friday 2026', 'start' => '2026-11-27', 'end' => '2026-12-08']);
        self::assertSame([], $still['moved']);
        self::assertSame('2026-11-20 00:00', $this->site->optins->find($id)?->config['starts_at']);

        $moved = $this->ask('wconvert/save-occasion', ['occasion_id' => 'black-friday-2026', 'name' => 'Black Friday 2026', 'start' => '2026-12-04', 'end' => '2026-12-15', 'move_campaigns' => true]);
        self::assertSame([$id], array_column($moved['moved'], 'campaign_id'));
        self::assertSame('2026-11-27 00:00', $moved['moved'][0]['schedule']['starts_at']['wall']);
        $optin = $this->site->optins->find($id);
        self::assertNotNull($optin);
        $config = $optin->config;
        self::assertSame(['2026-11-27 00:00', '2026-12-09 00:00'], [$config['starts_at'] ?? null, $config['ends_at'] ?? null]);
    }

    public function testADeletedOccasionsIdIsRefusedWithTheFix(): void
    {
        $this->site->occasions([]);

        $refused = $this->site->call('wconvert/save-occasion', ['occasion_id' => 'black-friday-2026', 'name' => 'Black Friday 2026', 'start' => '2026-11-20', 'end' => '2026-12-01']);

        self::assertInstanceOf(WP_Error::class, $refused);
        self::assertSame('That occasion was deleted, and its id is not used again. Leave occasion_id out to add it as a new occasion.', $refused->get_error_message());
    }

    public function testCopyingAnOccasionMakesDrafts(): void
    {
        $this->ask('wconvert/create-campaign', self::countdownBar());

        $copied = $this->ask('wconvert/copy-occasion', ['occasion_id' => 'black-friday-2026']);

        self::assertSame('black-friday-2027', $copied['occasion']['occasion_id']);
        self::assertCount(1, $copied['created']);
        self::assertNull($this->site->optins->find($copied['created'][0]['campaign_id'])?->publishedAt);
    }

    /** @return array<string, mixed> */
    private static function countdownBar(): array
    {
        return [
            'name' => 'Black Friday bar', 'goal' => 'promote_offer', 'design_id' => 'bar-countdown',
            'copy' => ['headline' => 'Ends Monday: 30% off', 'cta_label' => 'Shop the sale'],
            'link' => '/black-friday/', 'occasion_id' => 'black-friday-2026',
            'pages' => ['show_on' => ['/black-friday/*']], 'frequency' => ['per_session' => 1],
        ];
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    private function ask(string $name, array $input): array
    {
        $reply = $this->site->call($name, $input);
        self::assertIsArray($reply, $reply instanceof WP_Error ? $reply->get_error_message() : '');
        return $reply;
    }
}

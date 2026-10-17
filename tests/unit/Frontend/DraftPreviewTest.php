<?php

namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Frontend\DraftPreview;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\Routes;
use WConvert\Rules\DisplayPlan;
use WConvert\Rules\RuleVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * `?wconvert-preview=<id>` shows an administrator a draft on the real site,
 * now, whatever its schedule, allowance and pages say (ADR 0151) — and shows
 * anyone else the ordinary page.
 */
#[CoversClass(DraftPreview::class)]
final class DraftPreviewTest extends TestCase
{
    private const PLUGIN_DIR = __DIR__ . '/../../..';
    private const DRAFT = '01JA0000000000000000000001';

    private FakeConnection $db;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestActions'] = [];
        $GLOBALS['wconvertTestCapabilities'] = [Routes::MANAGE_CAPABILITY];
        $GLOBALS['wconvertTestRequestKind'] = [];
        $GLOBALS['wconvertTestIsAdmin'] = false;
        $GLOBALS['wconvertTestNocache'] = false;
        $this->db = new FakeConnection();
        $this->db->rows[self::DRAFT] = [
            'id' => self::DRAFT,
            'name' => 'Black Friday',
            'goal' => 'grow_email_list',
            'parent_id' => null,
            // Finished last year, capped, on one page only, for one audience,
            // opening after a scroll. Every one of those would hide it today.
            'config' => (string) json_encode([
                'display_type' => 'popup',
                'priority' => 3,
                'starts_at' => '2025-11-20 00:00',
                'ends_at' => '2025-12-02 00:00',
                'frequency' => ['cooldownDays' => 30, 'maxImpressions' => 1],
                'targeting' => ['include' => [['type' => 'page', 'ids' => [42]]]],
                'display_rules' => [
                    'audience' => ['mode' => 'groups', 'groups' => [['id' => 'g', 'match' => 'all', 'rules' => [['id' => 'r', 'type' => 'device', 'in' => ['mobile']]]]]],
                    'opening' => ['mode' => 'automatic', 'match' => 'any', 'minimum_seconds' => 0, 'rules' => [['id' => 's', 'type' => 'scroll_depth', 'percent' => 50]]],
                ],
            ]),
            'published_config' => null,
            'published_at' => null,
            'deleted_at' => null,
        ];
        unset($_GET[DraftPreview::PARAM]);
    }

    protected function tearDown(): void
    {
        unset($_GET[DraftPreview::PARAM]);
        $GLOBALS['wconvertTestCapabilities'] = [];
    }

    private function preview(): DraftPreview
    {
        $vocabulary = RuleVocabulary::fromManifest(self::PLUGIN_DIR);

        return new DraftPreview(
            new OptinRepository($this->db, new PublishedSet(new FakeOptionStore()), $vocabulary, new MilestoneStore(new FakeOptionStore())),
            $vocabulary
        );
    }

    public function testAnyoneWhoCannotManageTheSiteGetsTheOrdinaryPage(): void
    {
        $_GET[DraftPreview::PARAM] = self::DRAFT;

        foreach ([[], ['read']] as $capabilities) {
            $GLOBALS['wconvertTestCapabilities'] = $capabilities;
            $preview = $this->preview();
            $preview->neverCache();

            $this->assertNull($preview->set());
            $this->assertFalse($GLOBALS['wconvertTestNocache']);
        }
    }

    public function testAnIdThatNamesNothingIsTheOrdinaryPage(): void
    {
        foreach (['01JA0000000000000000000099', 'not-an-id', ''] as $id) {
            $_GET[DraftPreview::PARAM] = $id;

            $this->assertNull($this->preview()->set(), $id);
        }
    }

    public function testADeletedCampaignIsTheOrdinaryPage(): void
    {
        $this->db->rows[self::DRAFT]['deleted_at'] = '2026-10-01 00:00:00';
        $_GET[DraftPreview::PARAM] = self::DRAFT;

        $this->assertNull($this->preview()->set());
    }

    public function testItIsNeverPrintedIntoAFeedARobotsFileOrAnEmbed(): void
    {
        $_GET[DraftPreview::PARAM] = self::DRAFT;

        foreach (['is_feed', 'is_robots', 'is_embed'] as $kind) {
            $GLOBALS['wconvertTestRequestKind'] = [$kind => true];

            $this->assertNull($this->preview()->set(), $kind);
        }
    }

    public function testThePreviewIsTheDraftShownNowOnEveryPage(): void
    {
        $_GET[DraftPreview::PARAM] = self::DRAFT;

        $set = $this->preview()->set();

        $this->assertIsArray($set);
        $this->assertCount(1, $set);
        $entry = $set[0];
        $this->assertSame(self::DRAFT, $entry['id']);
        // Every page: no Targeting at all.
        $this->assertSame([], $entry['targeting']);
        // Now: neither boundary travels.
        $this->assertArrayNotHasKey('starts_at', $entry['payload']);
        $this->assertArrayNotHasKey('ends_at', $entry['payload']);
        // Again after a close, a submit or a showing: no allowance to spend.
        $this->assertSame(['stopAfterDismiss' => false, 'stopAfterConversion' => false], $entry['payload']['frequency']);
        // Everyone, right away.
        $this->assertSame(DisplayPlan::immediate(), $entry['payload']['display_rules']);
        // And what it LOOKS like is the draft's own.
        $this->assertSame('popup', $entry['payload']['display_type']);
        $this->assertSame(3, $entry['payload']['priority']);
    }

    public function testACartCampaignPreviewsWithoutACart(): void
    {
        $this->db->rows[self::DRAFT]['goal'] = 'recover_cart';
        $_GET[DraftPreview::PARAM] = self::DRAFT;

        $set = $this->preview()->set();

        $this->assertIsArray($set);
        $this->assertArrayNotHasKey('required_rules', $set[0]['payload']);
    }

    public function testThePreviewIsNeverCached(): void
    {
        $_GET[DraftPreview::PARAM] = self::DRAFT;

        $this->preview()->neverCache();

        $this->assertTrue($GLOBALS['wconvertTestNocache']);
        $this->assertTrue(\constant('DONOTCACHEPAGE'));
    }

    public function testAnOrdinaryPageViewIsLeftAlone(): void
    {
        $preview = $this->preview();
        $preview->neverCache();

        $this->assertNull($preview->set());
        $this->assertFalse($GLOBALS['wconvertTestNocache']);
        $this->assertSame([], $this->db->reads);
    }
}

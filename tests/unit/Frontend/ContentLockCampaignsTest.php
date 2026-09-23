<?php
namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\TestCase;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Milestone\MilestoneStore;
use WConvert\Pro\Module\ContentLock\ContentLockCampaigns;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\InstalledRules;

final class ContentLockCampaignsTest extends TestCase
{
    public function testPickerUsesPublishedReadinessAndReturnsNoDesignOrPrivateData(): void
    {
        $set = new PublishedSet(new FakeOptionStore());
        $repo = new OptinRepository(new FakeConnection(), $set, InstalledRules::vocabulary(), new MilestoneStore(new FakeOptionStore()));
        $set->replaceWith([
            ['id' => 'ready', 'payload' => \WConvert\Tests\Unit\Support\DisplayFixture::entry(['display_type' => 'inline', 'content_lock' => ['mode' => 'hide'], 'triggers' => [['type' => 'page_load']], 'template' => ['private' => 'never return this']])],
            ['id' => 'ordinary', 'payload' => ['display_type' => 'inline']],
            ['id' => 'popup', 'payload' => ['display_type' => 'popup']],
        ]);
        $picker = new ContentLockCampaigns($set, $repo, InstalledRules::withPro());
        self::assertSame([
            ['id' => 'ready', 'name' => 'ready', 'status' => 'ready'],
            ['id' => 'ordinary', 'name' => 'ordinary', 'status' => 'disabled'],
        ], $picker->campaigns());
        $set->replaceWith([]);
        self::assertSame([], $picker->campaigns());
    }
    public function testAuthorsCanReadChoicesWithoutCampaignManagementPermission(): void
    {
        foreach ([[], ['read'], ['edit_posts'], ['edit_pages']] as $caps) {
            $GLOBALS['wconvertTestCapabilities'] = $caps;
            self::assertSame(in_array('edit_posts', $caps, true) || in_array('edit_pages', $caps, true), \WConvert\Rest\Routes::canPlaceCampaign());
            self::assertFalse(\WConvert\Rest\Routes::canManage());
        }
        $GLOBALS['wconvertTestCapabilities'] = [];
    }
    public function testPublishedLockWithMissingDependenciesIsUnavailableRatherThanDisabled(): void
    {
        $set = new PublishedSet(new FakeOptionStore());
        $repo = new OptinRepository(new FakeConnection(), $set, InstalledRules::vocabulary(), new MilestoneStore(new FakeOptionStore()));
        $set->replaceWith([['id' => 'saved', 'payload' => \WConvert\Tests\Unit\Support\DisplayFixture::entry([
            'display_type' => 'inline', 'content_lock' => ['mode' => 'hide'],
            'triggers' => [['type' => 'page_load']], 'conditions' => [['type' => 'cart_has_items']],
        ])]]);
        $picker = new ContentLockCampaigns($set, $repo, InstalledRules::withProButNoStore());
        self::assertSame('unavailable', $picker->campaigns()[0]['status']);
        self::assertNull($picker->data()['manageUrl']);
    }
}

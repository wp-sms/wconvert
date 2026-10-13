<?php

namespace WConvert\Tests\Unit\Admin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Admin\AdminMenu;
use WConvert\Admin\AdminNotices;
use WConvert\Optin\PublishedSet;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * Free's WordPress submenu: Campaigns, then Help — both the one WConvert page.
 */
#[CoversClass(AdminMenu::class)]
final class AdminMenuTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestSubmenu'] = [];
    }

    /** The automatic first item is renamed Campaigns; Help links to the same page at #help. */
    public function testTheSubmenuIsCampaignsThenHelp(): void
    {
        (new AdminMenu(new AdminNotices(new PublishedSet(new FakeOptionStore()))))->registerSubmenu();

        $this->assertSame([
            ['Campaigns', 'manage_options', 'wconvert'],
            ['Help', 'manage_options', 'admin.php?page=wconvert#help'],
        ], $GLOBALS['wconvertTestSubmenu']['wconvert']);
    }
}

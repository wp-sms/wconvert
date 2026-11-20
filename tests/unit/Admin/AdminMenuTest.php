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
        $GLOBALS['wconvertTestUserOptions'] = [];
        unset($GLOBALS['_wp_admin_css_colors']);
        $GLOBALS['wp_version'] = '7.1';
    }

    /**
     * The icon is drawn in the colour `svg-painter` will paint it, read from
     * the user's scheme, so it does not change colour once the page loads (#422).
     */
    public function testTheMenuIconIsDrawnInTheUsersSchemeColour(): void
    {
        $GLOBALS['_wp_admin_css_colors'] = [
            'modern' => (object) ['icon_colors' => ['base' => '#f3f1f1', 'focus' => '#fff', 'current' => '#fff']],
            'light' => (object) ['icon_colors' => ['base' => '#999', 'focus' => '#ccc', 'current' => '#ccc']],
        ];
        $GLOBALS['wconvertTestUserOptions']['admin_color'] = 'light';

        $this->assertSame(['#999'], $this->fills(AdminMenu::menuIcon()));
    }

    /** No scheme to read — unregistered, or a colour that is not one — falls back to WordPress's own default grey. */
    public function testTheMenuIconFallsBackToWordPressGrey(): void
    {
        $this->assertSame(['#a7aaad'], $this->fills(AdminMenu::menuIcon()));

        $GLOBALS['_wp_admin_css_colors'] = ['odd' => (object) ['icon_colors' => ['base' => 'url(x)']]];
        $GLOBALS['wconvertTestUserOptions']['admin_color'] = 'odd';
        $this->assertSame(['#a7aaad'], $this->fills(AdminMenu::menuIcon()));
    }

    /** An unset or unregistered scheme falls back as WordPress does: `modern` from 7.0, `fresh` before it. */
    public function testAnUnknownSchemeFallsBackToWordPresssDefault(): void
    {
        $GLOBALS['_wp_admin_css_colors'] = [
            'modern' => (object) ['icon_colors' => ['base' => '#f3f1f1']],
            'fresh' => (object) ['icon_colors' => ['base' => '#a7aaad']],
        ];
        $GLOBALS['wconvertTestUserOptions']['admin_color'] = 'retired';
        $this->assertSame(['#f3f1f1'], $this->fills(AdminMenu::menuIcon()));

        unset($GLOBALS['wconvertTestUserOptions']['admin_color']);
        $this->assertSame(['#f3f1f1'], $this->fills(AdminMenu::menuIcon()));

        $GLOBALS['wp_version'] = '6.9.1';
        $this->assertSame(['#a7aaad'], $this->fills(AdminMenu::menuIcon()));
    }

    /** The schemes exist only from `admin_init`, after the menu is built, so the entry is repainted there. */
    public function testTheMenuEntryIsRepaintedOnceTheSchemesExist(): void
    {
        $GLOBALS['menu'] = [10 => ['Posts', 'edit_posts', 'edit.php', '', '', '', 'dashicons-admin-post'], 26 => ['WConvert', 'manage_options', 'wconvert', '', '', '', 'grey']];
        $GLOBALS['_wp_admin_css_colors'] = ['modern' => (object) ['icon_colors' => ['base' => '#f3f1f1']]];
        $GLOBALS['wconvertTestUserOptions']['admin_color'] = 'modern';

        (new AdminMenu(new AdminNotices(new PublishedSet(new FakeOptionStore()))))->paintMenuIcon();

        $this->assertSame(['#f3f1f1'], $this->fills($GLOBALS['menu'][26][6]));
        $this->assertSame('dashicons-admin-post', $GLOBALS['menu'][10][6]);
        unset($GLOBALS['menu']);
    }

    /** @return list<string> */
    private function fills(string $dataUri): array
    {
        $this->assertStringStartsWith('data:image/svg+xml;base64,', $dataUri);
        preg_match_all('/fill="([^"]*)"/', (string) base64_decode(substr($dataUri, strlen('data:image/svg+xml;base64,')), true), $matches);

        return $matches[1];
    }

    /** The automatic first item is renamed Campaigns; the sections and Help link to the same page's hash routes (ADR 0176). */
    public function testTheSubmenuIsEverySectionThenHelp(): void
    {
        (new AdminMenu(new AdminNotices(new PublishedSet(new FakeOptionStore()))))->registerSubmenu();

        $this->assertSame([
            ['Campaigns', 'manage_options', 'wconvert'],
            ['Analytics', 'manage_options', 'admin.php?page=wconvert#analytics'],
            ['Leads', 'manage_options', 'admin.php?page=wconvert#leads'],
            ['Settings', 'manage_options', 'admin.php?page=wconvert#settings'],
            ['Help', 'manage_options', 'admin.php?page=wconvert#help'],
        ], $GLOBALS['wconvertTestSubmenu']['wconvert']);
    }
}

<?php

namespace WConvert\Tests\Unit\Pro\License;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\License\AdminSurfaces;

/**
 * The two doors to the License page: a WordPress submenu, and the header's
 * plan badge with its dot — both for somebody who can manage the licence.
 */
#[CoversClass(AdminSurfaces::class)]
final class AdminSurfacesTest extends TestCase
{
    use FakesNexus;

    /** @var list<string> */
    private array $capabilities;

    protected function setUp(): void
    {
        $this->capabilities = $GLOBALS['wconvertTestCapabilities'];
        $GLOBALS['wconvertTestSubmenu'] = [];
        $this->fakeNexus();
    }

    protected function tearDown(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = $this->capabilities;
        $this->stopFakingNexus();
    }

    /** The automatic first item is renamed Campaigns; License links to the same page at #license. */
    public function testTheSubmenuIsCampaignsThenLicense(): void
    {
        (new AdminSurfaces($this->freshSdk()))->registerSubmenu();

        $this->assertSame([
            ['Campaigns', 'manage_options', 'wconvert'],
            ['License', 'manage_options', 'admin.php?page=wconvert#license'],
        ], $GLOBALS['wconvertTestSubmenu']['wconvert']);
    }

    public function testS1WithNoLicenceTheBadgeAsksForActivation(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = ['manage_options'];

        $badge = (new AdminSurfaces($this->freshSdk()))->withPlanBadge(['exportUrl' => 'x'])['planBadge'];

        $this->assertSame(['href' => '#license', 'label' => 'Activate Pro', 'prompt' => true, 'tone' => null, 'reason' => null], $badge);
    }

    public function testM3AnExpiredLicenceGivesTheBadgeARedDotAndItsReason(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = ['manage_options'];
        $this->nexusLicense = ['status' => 'expired', 'expires_at' => '2026-09-30 00:00:00'];
        $this->activateLicenseHere();

        $badge = (new AdminSurfaces($this->freshSdk()))->withPlanBadge([])['planBadge'];

        $this->assertSame('red', $badge['tone']);
        $this->assertSame('Your license expired', $badge['reason']);
        $this->assertFalse($badge['prompt']);
        $this->assertNull($badge['label'], 'a licensed site keeps the plan\'s own name on the badge');
    }

    /** P4: without manage_options there is no badge link, dot or reason at all. */
    public function testP4SomebodyWhoCannotManageTheLicenceGetsNoBadgeData(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = [];

        $this->assertSame(['exportUrl' => 'x'], (new AdminSurfaces($this->freshSdk()))->withPlanBadge(['exportUrl' => 'x']));
    }
}

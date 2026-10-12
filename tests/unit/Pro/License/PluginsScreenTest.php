<?php

namespace WConvert\Tests\Unit\Pro\License;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\License\PluginsScreen;

/**
 * Pro's row on the Plugins screen, read from the License page's own payload.
 */
#[CoversClass(PluginsScreen::class)]
final class PluginsScreenTest extends TestCase
{
    use FakesNexus;

    /** @var list<string> */
    private array $capabilities;

    protected function setUp(): void
    {
        $this->capabilities = $GLOBALS['wconvertTestCapabilities'];
        $GLOBALS['wconvertTestCapabilities'] = ['manage_options'];
        $this->fakeNexus();
    }

    protected function tearDown(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = $this->capabilities;
        $this->stopFakingNexus();
    }

    public function testS1TheRowAsksForActivationAndLinksTheLicensePage(): void
    {
        $screen = $this->screen();

        $this->assertStringContainsString('#license', $screen->actionLinks(['deactivate' => 'x'])['license']);
        $row = $this->row($screen);
        $this->assertStringContainsString('Activate your license to get updates.', $row);
        $this->assertStringContainsString('notice-info', $row);
        $this->assertStringContainsString('admin.php?page=wconvert#license', $row);
    }

    public function testM3AnExpiredLicenceSaysUpdatesStoppedAndLinksTheRenewal(): void
    {
        $this->nexusLicense = ['status' => 'expired', 'expires_at' => '2026-09-30 00:00:00', 'renewal' => ['renew_url' => 'https://my.wconvert.io/renew/7', 'auto_renews' => false]];
        $this->activateLicenseHere();

        $row = $this->row($this->screen());

        $this->assertStringContainsString('Your license expired, so updates stopped.', $row);
        $this->assertStringContainsString('notice-error', $row);
        $this->assertStringContainsString('https://my.wconvert.io/renew/7', $row);
        $this->assertStringContainsString('target="_blank"', $row);
    }

    public function testD1AHealthyLicenceAddsNoLine(): void
    {
        $this->activateLicenseHere();

        $this->assertSame('', $this->row($this->screen()));
    }

    /** P4: without manage_options there is no link and no line. */
    public function testP4SomebodyWhoCannotManageTheLicenceSeesNeither(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = [];
        $screen = $this->screen();

        $this->assertSame(['deactivate' => 'x'], $screen->actionLinks(['deactivate' => 'x']));
        $this->assertSame('', $this->row($screen));
    }

    /** The licence is each site's: the network's Plugins screen says nothing about it. */
    public function testTheNetworkPluginsScreenGetsNoLine(): void
    {
        $GLOBALS['wconvertTestNetworkAdmin'] = true;

        try {
            $this->assertSame('', $this->row($this->screen()));
        } finally {
            $GLOBALS['wconvertTestNetworkAdmin'] = false;
        }
    }

    private function screen(): PluginsScreen
    {
        return new PluginsScreen($this->freshSdk(), 'wconvert-pro/wconvert-pro.php');
    }

    private function row(PluginsScreen $screen): string
    {
        ob_start();
        $screen->row();

        return (string) ob_get_clean();
    }
}

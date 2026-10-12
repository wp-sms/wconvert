<?php

namespace WConvert\Tests\Unit\Pro\License;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\License\PluginsScreen;
use WConvert\Pro\License\SiteHealth;

/**
 * Pro's row on the Plugins screen, and its Site Health section — both read
 * from the License page's own payload.
 */
#[CoversClass(PluginsScreen::class)]
#[CoversClass(SiteHealth::class)]
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

    public function testSiteHealthNamesTheStateAndTheStoresCodeButNeverTheKey(): void
    {
        $this->nexusLicense = ['status' => 'suspended', 'error_code' => 'license_suspended'];
        $this->activateLicenseHere('WCV-SECR-ET00-9876');

        $section = (new SiteHealth($this->freshSdk()))->addSection([])[SiteHealth::SECTION];
        $dump = (string) json_encode($section);

        $this->assertSame('disabled', $section['fields']['status']['debug']);
        $this->assertSame('license_suspended', $section['fields']['error_code']['value']);
        $this->assertStringNotContainsString('9876', $dump, 'the key, or a part of it, reached Site Health');
        $this->assertStringNotContainsString('SECR', $dump);
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

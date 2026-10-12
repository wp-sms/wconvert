<?php

namespace WConvert\Tests\Unit\Pro\License;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\License\SiteHealth;

/**
 * Tools → Site Health → Info: what support reads, and never the key.
 */
#[CoversClass(SiteHealth::class)]
final class SiteHealthTest extends TestCase
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

    /** M4: the store's code is there for support. */
    public function testItNamesTheStateAndTheStoresCodeButNeverTheKey(): void
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

    /** An expired licence's updates read as stopped, whatever version the cache last saw. */
    public function testAStoppedLicencesUpdatesReadAsStopped(): void
    {
        $this->nexusLicense = ['status' => 'expired', 'expires_at' => '2026-09-30 00:00:00'];
        $this->activateLicenseHere();

        $fields = (new SiteHealth($this->freshSdk()))->addSection([])[SiteHealth::SECTION]['fields'];

        $this->assertStringStartsWith('Stopped at', $fields['updates']['value']);
        $this->assertArrayHasKey('last_checked', $fields);
    }

    /** Site Health opens for whoever may install plugins; the section is for whoever may manage the licence. */
    public function testSomebodyWhoCannotManageTheLicenceGetsNoSection(): void
    {
        $GLOBALS['wconvertTestCapabilities'] = ['install_plugins'];

        $this->assertSame([], (new SiteHealth($this->freshSdk()))->addSection([]));
    }
}

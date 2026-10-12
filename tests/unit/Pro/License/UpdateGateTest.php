<?php

namespace WConvert\Tests\Unit\Pro\License;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\License\SdkConfig;
use WConvert\Pro\License\UpdateGate;

/**
 * An update is offered only while the licence entitles this site to one, and
 * the update caches are dropped only when that entitlement changes.
 *
 * Both halves exist because of the SDK (veronalabs/wp-premium-sdk#33, #34):
 * its injector never takes back an offer, and it flushes on four paths of the
 * dozen that change a licence.
 */
#[CoversClass(UpdateGate::class)]
final class UpdateGateTest extends TestCase
{
    use FakesNexus;

    private const BASENAME = 'wconvert-pro/wconvert-pro.php';

    /** @var array<string, mixed> */
    private array $actions;

    protected function setUp(): void
    {
        $this->actions = $GLOBALS['wconvertTestActions'];
        $this->fakeNexus();
    }

    protected function tearDown(): void
    {
        $this->stopFakingNexus();
        $GLOBALS['wconvertTestActions'] = $this->actions;
    }

    public function testAValidLicenceKeepsTheOffer(): void
    {
        $this->activateLicenceHere();

        $transient = $this->gate()->gate($this->offer());

        $this->assertArrayHasKey(self::BASENAME, $transient->response);
    }

    public function testNoLicenceMovesTheOfferToUpToDate(): void
    {
        $transient = $this->gate()->gate($this->offer());

        $this->assertArrayNotHasKey(self::BASENAME, $transient->response);
        $this->assertSame('9.9.9', $transient->no_update[self::BASENAME]->new_version);
        $this->assertArrayHasKey('another/plugin.php', $transient->response, 'another plugin\'s offer was touched');
    }

    public function testAnExpiredLicenceMovesTheOffer(): void
    {
        $this->nexusLicense = ['expires_at' => gmdate('Y-m-d H:i:s', time() - DAY_IN_SECONDS)];
        $this->activateLicenceHere();

        $this->assertArrayNotHasKey(self::BASENAME, $this->gate()->gate($this->offer())->response);
    }

    /** Rotated salts: the SDK still says active, and nothing can be downloaded (#29). */
    public function testAKeyThatNoLongerDecryptsMovesTheOffer(): void
    {
        $this->activateLicenceHere();
        $stored = get_option(SdkConfig::OPTION_KEY);
        $stored['license']['license_key'] = base64_encode(str_repeat('x', 64));
        $GLOBALS['wconvertTestOptionTable'][SdkConfig::OPTION_KEY] = $stored;

        $this->assertArrayNotHasKey(self::BASENAME, $this->gate()->gate($this->offer())->response);
    }

    public function testANonObjectTransientPassesThrough(): void
    {
        $this->assertFalse($this->gate()->gate(false));
    }

    public function testActivatingFlushesTheUpdateCaches(): void
    {
        $this->gate()->hooks();
        $GLOBALS['wconvertTestSiteTransients']['update_plugins'] = (object) ['response' => []];

        $this->activateLicenceHere();

        $this->assertFalse(get_site_transient('update_plugins'), 'activation left WordPress\'s update list stale');
    }

    public function testARefreshThatChangesNothingTheUpdaterReadsKeepsTheCaches(): void
    {
        $this->activateLicenceHere();
        $this->gate()->hooks();
        $GLOBALS['wconvertTestSiteTransients']['update_plugins'] = (object) ['response' => []];

        // A refresh: a new timestamp and the key encrypted afresh.
        $this->freshSdk()->licenseManager()->refreshStatus();

        $this->assertNotFalse(get_site_transient('update_plugins'), 'a no-op refresh dropped the update caches');
    }

    public function testARefreshThatChangesTheExpiryFlushes(): void
    {
        $this->activateLicenceHere();
        $this->gate()->hooks();
        $GLOBALS['wconvertTestSiteTransients']['update_plugins'] = (object) ['response' => []];

        $this->nexusLicense = ['expires_at' => gmdate('Y-m-d H:i:s', time() + 565 * DAY_IN_SECONDS)];
        $this->freshSdk()->licenseManager()->refreshStatus();

        $this->assertFalse(get_site_transient('update_plugins'), 'a renewal did not reach the updater');
    }

    public function testRemovingTheLicenceFlushes(): void
    {
        $this->activateLicenceHere();
        $this->gate()->hooks();
        $GLOBALS['wconvertTestSiteTransients']['update_plugins'] = (object) ['response' => []];

        delete_option(SdkConfig::OPTION_KEY);

        $this->assertFalse(get_site_transient('update_plugins'));
    }

    public function testTheEntitlementIgnoresTheTimestampAndTheCiphertext(): void
    {
        $a = ['license' => ['license_key' => 'one', 'activated_at' => 1, 'status' => 'active', 'expires_at' => 'x', 'last_success_at' => 5]];
        $b = ['license' => ['license_key' => 'two', 'activated_at' => 1, 'status' => 'active', 'expires_at' => 'x', 'last_success_at' => 9]];

        $this->assertSame(UpdateGate::entitlement($a), UpdateGate::entitlement($b));
        $this->assertNull(UpdateGate::entitlement(['account' => ['user_id' => 1]]), 'a sign-in alone is not a licence');
    }

    private function gate(): UpdateGate
    {
        $sdk = $this->freshSdk();

        return new UpdateGate($sdk->licenseManager(), $sdk->pluginUpdater(), self::BASENAME);
    }

    private function offer(): object
    {
        return (object) [
            'response' => [
                self::BASENAME => (object) ['plugin' => self::BASENAME, 'new_version' => '9.9.9'],
                'another/plugin.php' => (object) ['plugin' => 'another/plugin.php', 'new_version' => '2.0.0'],
            ],
        ];
    }
}

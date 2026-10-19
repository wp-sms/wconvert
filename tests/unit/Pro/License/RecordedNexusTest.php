<?php

namespace WConvert\Tests\Unit\Pro\License;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Http\ApiException;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Support\Request;
use WConvert\Pro\License\LicenseFacts;
use WConvert\Pro\License\LicenseState;

/**
 * =============================================================================
 * WHAT THE REAL STORE SAYS, READ THE WAY A SITE READS IT.
 * =============================================================================
 * `tests/fixtures/nexus-test-keys.json` holds my.wconvert.io's own answers for
 * the thirteen WCTEST- keys, one per licence situation, recorded on 19 October
 * 2026. Each test replays them through the SDK's activate() or refreshStatus()
 * and reads the state every surface shows, so the hand-written answers in
 * `LicenseStateTest` are checked against the shape Nexus actually sends.
 *
 * "Today" is when the answers were recorded.
 */
#[CoversClass(LicenseState::class)]
final class RecordedNexusTest extends TestCase
{
    use FakesNexus;

    private const NOW = 1792385100; // 2026-10-19 04:45:00 UTC

    protected function setUp(): void
    {
        $this->fakeNexus();
    }

    protected function tearDown(): void
    {
        $this->stopFakingNexus();
    }

    /** Key 1: bought once, so somebody renews it by hand, a year from now. */
    public function testAOneTimeOrderRenewsByHand(): void
    {
        $payload = $this->activate(1);

        $this->assertSame('manual', $payload['state']);
        $this->assertSame('single-site', $payload['plan']['slug']);
        $this->assertSame(1, $payload['plan']['max']);
        $this->assertSame(1, $payload['plan']['used']);
        $this->assertSame(365, $payload['days_left']);
        $this->assertSame('https://my.wconvert.io/account/licenses/7595', $payload['urls']['account']);
    }

    /** Key 2: its one seat is taken elsewhere, so a second site is turned away and stores nothing. */
    public function testAFullLicenceRefusesASecondSite(): void
    {
        $this->assertSame('activation_limit_reached', $this->refusedActivation(2));
    }

    /** Key 3: four days left on a licence renewed by hand is amber, with the store's renewal link. */
    public function testALicenceEndingThisWeekIsExpiring(): void
    {
        $payload = $this->activate(3);

        $this->assertSame('expiring', $payload['state']);
        $this->assertSame(5, $payload['days_left'], 'anything left of a day counts as one');
        $this->assertSame('https://my.wconvert.io/checkout/wconvert-pro?tier=single-site&renewal=1', $payload['urls']['renew']);
        $this->assertTrue($this->updatesAllowed());
    }

    /**
     * Keys 4 and 8: the store will not activate an expired key, and a site
     * that already holds one learns it on the next check — answered with a
     * 200, not an error status.
     */
    public function testAnExpiredKeyCannotBeActivatedAndAHeldOneReadsAsExpired(): void
    {
        foreach ([4, 8] as $key) {
            $this->assertSame('license_expired', $this->refusedActivation($key), "key $key");

            $this->assertSame(200, self::recorded($key)['refresh']['status'], 'Nexus refuses inside a 200');
            $payload = $this->refreshedTo($key);

            $this->assertSame('expired', $payload['state'], "key $key");
            $this->assertSame('license_expired', $payload['error_code']);
            $this->assertFalse($this->updatesAllowed());
            $this->stopFakingNexus();
            $this->fakeNexus();
        }
    }

    /**
     * Key 5: an active subscription with no card behind it. Nexus says it does
     * not renew itself (`auto_renews` false), so it reads as renewed by hand.
     */
    public function testASubscriptionWithNoCardRenewsByHand(): void
    {
        $payload = $this->activate(5);

        $this->assertSame('manual', $payload['state']);
        $this->assertSame(5, $payload['plan']['max']);
    }

    /** Key 6: the charge failed two days ago; the store's 7-day grace still runs, and so do updates. */
    public function testAFailedPaymentInItsGraceIsPaymentFailed(): void
    {
        $payload = $this->activate(6);

        $this->assertSame('payment_failed', $payload['state']);
        $this->assertSame('2026-10-24T05:29:00+00:00', $payload['renewal']['grace_ends_at']);
        $this->assertSame(-1, $payload['days_left']);
        $this->assertTrue($this->updatesAllowed());
    }

    /** Key 6 again, checked later without a domain: the grace survives the refresh. */
    public function testAFailedPaymentSurvivesARefresh(): void
    {
        $this->assertSame('payment_failed', $this->refreshedTo(6)['state']);
    }

    /**
     * Key 7: cancelled in the store, running to 18 December. Nexus sends its
     * subscription as `active`, so the site cannot tell it was cancelled and
     * reads it as renewed by hand. When Nexus sends `cancelled`, this test is
     * the one to change: the state becomes `cancelled`.
     */
    public function testACancelledSubscriptionArrivesAsActive(): void
    {
        $payload = $this->activate(7);

        $this->assertSame('active', self::recorded(7)['activate']['body']['license']['renewal']['subscription_status']);
        $this->assertSame('manual', $payload['state']);
        $this->assertSame(61, $payload['days_left']);
    }

    /** Key 9: Nexus counts an unlimited plan's seats as zero; that is no ceiling, never over it. */
    public function testAnUnlimitedPlanHasNoCeiling(): void
    {
        $payload = $this->activate(9);

        $this->assertSame('manual', $payload['state']);
        $this->assertSame('unlimited', $payload['plan']['slug']);
        $this->assertNull($payload['plan']['max']);
        $this->assertSame(1, $payload['plan']['used']);
    }

    /** Keys 10 and 11: suspended by hand or by a refund, the store says the same, and updates stop. */
    public function testASuspendedOrRefundedKeyIsDisabled(): void
    {
        foreach ([10, 11] as $key) {
            $this->assertSame('license_suspended', $this->refusedActivation($key), "key $key");

            $payload = $this->refreshedTo($key);

            $this->assertSame('disabled', $payload['state'], "key $key");
            $this->assertSame('license_suspended', $payload['error_code']);
            $this->assertFalse($this->updatesAllowed());
            $this->stopFakingNexus();
            $this->fakeNexus();
        }
    }

    /** Keys 12 and 13: one customer, two licences — each reads as its own plan. */
    public function testOneCustomersTwoLicencesAreEachTheirOwnPlan(): void
    {
        $first = $this->activate(12);
        $this->stopFakingNexus();
        $this->fakeNexus();
        $second = $this->activate(13);

        $this->assertSame([1, 5], [$first['plan']['max'], $second['plan']['max']]);
        $this->assertSame(['manual', 'manual'], [$first['state'], $second['state']]);
    }

    /** The store's error code for a key it would not activate; nothing is stored. */
    private function refusedActivation(int $key): string
    {
        $this->replay($key, 'activate', 'validate');

        try {
            $this->activateLicenseHere();
            $this->fail("key $key activated");
        } catch (ApiException $e) {
            $this->assertNull($this->freshSdk()->store()->get('license'), "key $key stored a licence");
            $this->assertSame('none', $this->state()['state']);

            return $e->getErrorCode();
        }
    }

    /**
     * A site holding a working licence (key 1), whose next check — the SDK's
     * domain-less refreshStatus() — gets the store's answer for another key.
     *
     * @return array<string, mixed>
     */
    private function refreshedTo(int $key): array
    {
        $this->activate(1);
        $this->nexusReplies['/api/v1/license/validate'] = self::recorded($key)['refresh'];

        $this->assertTrue($this->freshSdk()->licenseManager()->refreshStatus(), 'the store answered');

        return $this->state();
    }

    private function updatesAllowed(): bool
    {
        return in_array($this->state()['state'], LicenseState::NO_UPDATES, true) === false;
    }

    /**
     * Activate with the store's activate and validate answers for one key.
     *
     * @return array<string, mixed>
     */
    private function activate(int $key): array
    {
        $this->replay($key, 'activate', 'validate');
        $this->activateLicenseHere();

        return $this->state();
    }

    private function replay(int $key, string $activate, string $validate): void
    {
        $recorded = self::recorded($key);
        $this->nexusReplies = [
            '/api/v1/license/activate' => $recorded[$activate],
            '/api/v1/license/validate' => $recorded[$validate],
        ];
    }

    /** @return array<string, mixed> */
    private function state(): array
    {
        $sdk = $this->freshSdk();

        return LicenseState::payload(new LicenseFacts(
            license: $sdk->store()->get('license'),
            key: $sdk->licenseManager()->getLicenseKey(),
            now: self::NOW,
            installed: '1.0.0',
            here: Request::normaliseDomain(Request::currentDomain()),
            domainChange: $sdk->licenseManager()->domainChange(),
        ));
    }

    /** @return array<string, array{status: int, body: array<string, mixed>}> */
    private static function recorded(int $key): array
    {
        $fixture = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/fixtures/nexus-test-keys.json'), true);

        return $fixture['keys'][$key - 1];
    }
}

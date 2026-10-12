<?php

namespace WConvert\Tests\Unit\Pro\License;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\License\LicenseFacts;
use WConvert\Pro\License\LicenseState;

/**
 * =============================================================================
 * ONE ANSWER PER SITUATION, AND EVERY SURFACE READS IT.
 * =============================================================================
 * The License page, the header badge, the Plugins row and Site Health all read
 * the payload this builds, so they cannot disagree. Each test is one scenario
 * of the approved prototype (claude.ai/artifact/EovSgYnM27kRV686LKGgWP), named
 * by its id, with the stored licence written in the SDK's own shape — the shape
 * `LicenseManager::mapApiResponse()` writes — rather than an invented one.
 *
 * "Today" is 12 October 2026, noon UTC, as in the prototype.
 */
#[CoversClass(LicenseState::class)]
#[CoversClass(LicenseFacts::class)]
final class LicenseStateTest extends TestCase
{
    private const NOW = 1791806400; // 2026-10-12 12:00:00 UTC

    public function testS1NoLicenceIsNone(): void
    {
        $payload = $this->payload(license: null);

        $this->assertSame('none', $payload['state']);
        $this->assertSame([], $payload['sites']);
        $this->assertNull($payload['plan']);
        $this->assertNull($payload['key']['masked']);
    }

    public function testD1AnActiveLicenceThatRenewsItselfNamesItsPlanSitesAndKey(): void
    {
        $payload = $this->payload(self::license());

        $this->assertSame('active', $payload['state']);
        $this->assertSame(['slug' => '5-sites', 'label' => '5 sites', 'max' => 5], $payload['plan']);
        $this->assertSame('2027-03-03T00:00:00+00:00', $payload['expires_at']);
        $this->assertSame('auto', $payload['renewal']['mode']);
        $this->assertSame(['masked' => '••••AB12', 'source' => 'manual'], $payload['key']);
        $this->assertSame([
            ['domain' => 'example.com', 'here' => true, 'dev' => false, 'added' => '2026-03-03T10:00:00+00:00', 'last_seen' => '2026-10-12T09:14:00+00:00'],
            ['domain' => 'shop.example.com', 'here' => false, 'dev' => false, 'added' => '2026-04-18T10:00:00+00:00', 'last_seen' => '2026-10-11T08:00:00+00:00'],
            ['domain' => 'staging.example.com', 'here' => false, 'dev' => true, 'added' => '2026-05-02T10:00:00+00:00', 'last_seen' => null],
        ], $payload['sites']);
    }

    public function testD1AnUnlimitedPlanHasNoMaximum(): void
    {
        $payload = $this->payload(self::license(['tier_slug' => 'unlimited', 'plan_name' => 'Unlimited', 'max_activations' => 0]));

        $this->assertSame(['slug' => 'unlimited', 'label' => 'Unlimited', 'max' => null], $payload['plan']);
        $this->assertSame('active', $payload['state']);
    }

    /** The buyer is shown masked, whatever the store sent (#36: older stores sent it plain). */
    public function testD1TheBuyerIsMasked(): void
    {
        $payload = $this->payload(self::license(['buyer' => ['name' => 'Sara Karimi', 'email' => 'sara@example.com']]));

        $this->assertSame(['name' => 'S*** K***', 'email' => 's***@example.com'], $payload['buyer']);
    }

    public function testD2AManualRenewalMonthsAwayIsManual(): void
    {
        $payload = $this->payload(self::license(['renewal' => self::renewal(['auto_renews' => false, 'subscription_status' => null])]));

        $this->assertSame('manual', $payload['state']);
        $this->assertSame('manual', $payload['renewal']['mode']);
    }

    /** Within 30 days a Renew door appears, but amber waits for 14. */
    public function testD2AManualRenewal24DaysOutIsStillManual(): void
    {
        $payload = $this->payload(self::license([
            'expires_at' => '2026-11-05T12:00:00+00:00',
            'renewal' => self::renewal(['auto_renews' => false, 'subscription_status' => null]),
        ]));

        $this->assertSame('manual', $payload['state']);
        $this->assertSame(24, $payload['days_left']);
    }

    public function testD3ACancelledSubscriptionStillInItsPaidPeriodIsCancelled(): void
    {
        $payload = $this->payload(self::license([
            'expires_at' => '2026-11-20T00:00:00+00:00',
            'renewal' => self::renewal(['auto_renews' => false, 'subscription_status' => 'cancelled', 'state' => 'expired']),
        ]));

        $this->assertSame('cancelled', $payload['state']);
        $this->assertSame('cancelled', $payload['renewal']['mode']);
    }

    public function testD4ALicenceWithNoEndDateIsLifetime(): void
    {
        $payload = $this->payload(self::license(['expires_at' => '', 'renewal' => null]));

        $this->assertSame('lifetime', $payload['state']);
        $this->assertSame('lifetime', $payload['renewal']['mode']);
        $this->assertNull($payload['expires_at']);
        $this->assertNull($payload['days_left']);
    }

    public function testM1AManualLicenceWithin14DaysIsExpiringAndCarriesTheOffer(): void
    {
        $payload = $this->payload(self::license([
            'expires_at' => '2026-10-21T12:00:00+00:00',
            'renewal' => self::renewal([
                'auto_renews' => false,
                'state' => 'expiring_soon',
                'renew_url' => 'https://my.wconvert.io/checkout/renew/7?coupon=RENEW20',
                'offer' => ['code' => 'RENEW20', 'discount_type' => 'percentage', 'discount_value' => 20.0, 'expires_at' => '2026-10-21T00:00:00+00:00'],
            ]),
        ]));

        $this->assertSame('expiring', $payload['state']);
        $this->assertSame(9, $payload['days_left']);
        $this->assertSame(['code' => 'RENEW20', 'percent' => 20, 'until' => '2026-10-21T00:00:00+00:00'], $payload['renewal']['offer']);
        $this->assertSame('https://my.wconvert.io/checkout/renew/7?coupon=RENEW20', $payload['urls']['renew']);
    }

    public function testM1OneDayLeftIsStillExpiring(): void
    {
        $payload = $this->payload(self::license([
            'expires_at' => '2026-10-13T06:00:00+00:00',
            'renewal' => self::renewal(['auto_renews' => false]),
        ]));

        $this->assertSame('expiring', $payload['state']);
        $this->assertSame(1, $payload['days_left']);
    }

    /** A licence that renews itself is not "expiring" — nothing is asked of anyone. */
    public function testM1AnAutomaticRenewalWithin14DaysStaysActive(): void
    {
        $payload = $this->payload(self::license(['expires_at' => '2026-10-21T12:00:00+00:00']));

        $this->assertSame('active', $payload['state']);
    }

    public function testM3AnExpiredLicenceSaysSo(): void
    {
        $payload = $this->payload(self::license([
            'status' => 'expired',
            'error_code' => 'license_expired',
            'expires_at' => '2026-09-30T00:00:00+00:00',
            'renewal' => self::renewal(['auto_renews' => false, 'state' => 'expired', 'offer' => ['code' => 'RENEW20', 'discount_type' => 'percentage', 'discount_value' => 20, 'expires_at' => null]]),
        ]));

        $this->assertSame('expired', $payload['state']);
        $this->assertSame('license_expired', $payload['error_code']);
        $this->assertSame('RENEW20', $payload['renewal']['offer']['code']);
    }

    /** The store has not said so yet, but the date has passed. */
    public function testM3APassedEndDateIsExpiredBeforeTheStoreSaysSo(): void
    {
        $payload = $this->payload(self::license(['expires_at' => '2026-10-11T00:00:00+00:00', 'renewal' => self::renewal(['auto_renews' => false])]));

        $this->assertSame('expired', $payload['state']);
    }

    /** A fixed-amount coupon is not a percentage, and is not shown as one. */
    public function testM3AFixedAmountOfferHasNoPercent(): void
    {
        $payload = $this->payload(self::license([
            'status' => 'expired',
            'renewal' => self::renewal(['offer' => ['code' => 'TENOFF', 'discount_type' => 'fixed', 'discount_value' => 10, 'expires_at' => null]]),
        ]));

        $this->assertSame(['code' => 'TENOFF', 'percent' => null, 'until' => null], $payload['renewal']['offer']);
    }

    /** @return iterable<string, array{string, string, int}> */
    public static function trials(): iterable
    {
        yield 'on a trial' => ['2026-10-24T12:00:00+00:00', 'trial', 12];
        yield 'ending in 3 days' => ['2026-10-15T12:00:00+00:00', 'trial', 3];
        yield 'ended' => ['2026-10-10T12:00:00+00:00', 'trial_ended', -2];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('trials')]
    public function testD5ATrialAndItsEnd(string $endsAt, string $state, int $daysLeft): void
    {
        $payload = $this->payload(self::license([
            'expires_at' => $endsAt,
            'renewal' => self::renewal(['is_trial' => true, 'trial_ends_at' => $endsAt, 'auto_renews' => false, 'subscription_status' => null]),
        ]));

        $this->assertSame($state, $payload['state']);
        $this->assertSame($daysLeft, $payload['days_left']);
        $this->assertSame($endsAt, $payload['renewal']['trial_ends_at']);
    }

    /** Nexus keeps the status `active` through the grace period, and says so in the renewal block. */
    public function testM2AFailedPaymentInItsGracePeriodIsPaymentFailed(): void
    {
        $payload = $this->payload(self::license([
            'renewal' => self::renewal(['state' => 'payment_failed', 'subscription_status' => 'past_due', 'auto_renews' => false, 'grace_ends_at' => '2026-10-16T12:00:00+00:00']),
        ]));

        $this->assertSame('payment_failed', $payload['state']);
        $this->assertSame('2026-10-16T12:00:00+00:00', $payload['renewal']['grace_ends_at']);
    }

    /** @return iterable<string, array{string, string}> */
    public static function stoppedLicences(): iterable
    {
        yield 'refunded' => ['disabled', 'key_disabled'];
        yield 'suspended' => ['suspended', 'license_suspended'];
        yield 'blocked' => ['blocked', 'key_disabled'];
        yield 'cancelled' => ['cancelled', 'key_disabled'];
        yield 'revoked' => ['revoked', ''];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('stoppedLicences')]
    public function testM4ALicenceTheStoreStoppedIsDisabledWithItsCode(string $status, string $code): void
    {
        $payload = $this->payload(self::license(['status' => $status, 'error_code' => $code]));

        $this->assertSame('disabled', $payload['state']);
        $this->assertSame($code, $payload['error_code']);
    }

    public function testM5MoreCountedSitesThanThePlanAllowsIsOverLimit(): void
    {
        $payload = $this->payload(self::license(['activation_count' => 6]));

        $this->assertSame('over_limit', $payload['state']);
    }

    /** Five of five, this site among them, is full — not over. */
    public function testM5AFullPlanIsNotOverLimit(): void
    {
        $this->assertSame('active', $this->payload(self::license(['activation_count' => 5]))['state']);
    }

    public function testM5AnUnlimitedPlanIsNeverOverLimit(): void
    {
        $this->assertSame('active', $this->payload(self::license(['activation_count' => 40, 'max_activations' => 0]))['state']);
    }

    /** One answer when several are true: the one that stops updates wins. */
    public function testATurnedOffLicenceOutranksItsExpiryAndItsSites(): void
    {
        $payload = $this->payload(self::license(['status' => 'suspended', 'expires_at' => '2026-10-01T00:00:00+00:00', 'activation_count' => 9]));

        $this->assertSame('disabled', $payload['state']);
    }

    public function testAnExpiryOutranksAFailedPayment(): void
    {
        $payload = $this->payload(self::license(['status' => 'expired', 'renewal' => self::renewal(['state' => 'payment_failed'])]));

        $this->assertSame('expired', $payload['state']);
    }

    public function testC1ASiteThatMovedDomainsIsMovedAndNamesBoth(): void
    {
        $payload = $this->payload(
            self::license(['activated_domain' => 'old-example.com']),
            facts: ['domainChange' => ['was' => 'old-example.com', 'now' => 'example.com']]
        );

        $this->assertSame('moved', $payload['state']);
        $this->assertSame(['was' => 'old-example.com', 'now' => 'example.com', 'was_dev' => false], $payload['domain_change']);
    }

    /** Nexus says this domain holds no seat: a staging or local copy. */
    public function testC2AStagingCopyIsACopy(): void
    {
        $payload = $this->payload(
            self::license(['site' => ['active' => false, 'is_counted' => false]]),
            facts: ['here' => 'staging2.example.com', 'domainChange' => ['was' => 'example.com', 'now' => 'staging2.example.com']]
        );

        $this->assertSame('copy', $payload['state']);
    }

    /** Staging pushed live: moving will use a seat here, and the page says so. */
    public function testC3AStagingSitePushedToProductionIsMovedFromADevDomain(): void
    {
        $payload = $this->payload(
            self::license(['activated_domain' => 'staging.example.com']),
            facts: ['domainChange' => ['was' => 'staging.example.com', 'now' => 'example.com']]
        );

        $this->assertSame('moved', $payload['state']);
        $this->assertTrue($payload['domain_change']['was_dev']);
    }

    /** http→https and www are one site to the store, so no banner and "here" still matches. */
    public function testC4AWwwOrSchemeChangeIsTheSameSite(): void
    {
        $payload = $this->payload(self::license(), facts: ['here' => 'www.example.com']);

        $this->assertSame('active', $payload['state']);
        $this->assertNull($payload['domain_change']);
        $this->assertTrue($payload['sites'][0]['here']);
    }

    public function testC5ASiteDeletedWithoutDeactivatingStillListsWithWhenItWasLastSeen(): void
    {
        $license = self::license();
        $license['sites'][] = ['id' => 9, 'domain' => 'old-shop.example.com', 'site_url' => '', 'is_counted' => true, 'activated_at' => '2025-11-08T10:00:00+00:00', 'last_check_at' => '2026-03-02T10:00:00+00:00'];

        $sites = $this->payload($license)['sites'];

        $this->assertSame('old-shop.example.com', $sites[3]['domain']);
        $this->assertSame('2026-03-02T10:00:00+00:00', $sites[3]['last_seen']);
    }

    /** A June answer restored from a backup reads as June's until the next check replaces it. */
    public function testC6ARestoredAnswerSaysWhenItIsFrom(): void
    {
        $june = 1780401600; // 2026-06-02 12:00 UTC
        $payload = $this->payload(self::license(['status' => 'expired', 'expires_at' => '2026-06-02T00:00:00+00:00', 'last_validated_at' => $june, 'last_success_at' => $june]));

        $this->assertSame('expired', $payload['state']);
        $this->assertSame($june, $payload['last_success_at']);
        $this->assertSame('ok', $payload['reach']);
    }

    /** Rotated salts: the SDK still says active (wp-premium-sdk#29); updates have stopped. */
    public function testC7AKeyThatNoLongerDecryptsIsKeyUnreadable(): void
    {
        $payload = $this->payload(self::license(), key: null);

        $this->assertSame('key_unreadable', $payload['state']);
        $this->assertNull($payload['key']['masked']);
    }

    /** The store did not answer the last check: the licence is kept, and the page says when it last did. */
    public function testC8AnUnreachableStoreKeepsTheLicenceAndSaysWhenItLastAnswered(): void
    {
        $payload = $this->payload(self::license(['last_validated_at' => self::NOW - 3600, 'last_success_at' => self::NOW - 3 * 86400]));

        $this->assertSame('active', $payload['state']);
        $this->assertSame('unreachable', $payload['reach']);
        $this->assertSame(self::NOW - 3600, $payload['last_checked_at']);
        $this->assertSame(self::NOW - 3 * 86400, $payload['last_success_at']);
    }

    /** Whatever else is true, a key that cannot be read is the first thing to fix. */
    public function testAnUnreadableKeyOutranksEverything(): void
    {
        $payload = $this->payload(self::license(['status' => 'suspended']), key: null, facts: ['domainChange' => ['was' => 'a.com', 'now' => 'example.com']]);

        $this->assertSame('key_unreadable', $payload['state']);
    }

    public function testD6AnUpdateTheStoreOffersIsNamedWithWordPresssOwnUpgradeLink(): void
    {
        $payload = $this->payload(self::license(), facts: [
            'manifest' => ['update_available' => true, 'manifest' => ['version' => '1.5.0']],
            'updateUrl' => 'https://example.com/wp-admin/update.php?action=upgrade-plugin&plugin=wconvert-pro%2Fwconvert-pro.php&_wpnonce=abc',
            'updatesCheckedAt' => self::NOW - 600,
        ]);

        $this->assertSame([
            'installed' => '1.4.2',
            'latest' => '1.5.0',
            'file_mods' => true,
            'update_url' => 'https://example.com/wp-admin/update.php?action=upgrade-plugin&plugin=wconvert-pro%2Fwconvert-pro.php&_wpnonce=abc',
            'checked_at' => self::NOW - 600,
        ], $payload['updates']);
    }

    public function testD6UpToDateHasNoUpgradeLink(): void
    {
        $updates = $this->payload(self::license(), facts: ['manifest' => ['update_available' => false]])['updates'];

        $this->assertSame('1.4.2', $updates['latest']);
        $this->assertNull($updates['update_url']);
    }

    /** DISALLOW_FILE_MODS: the licence is fine, but WordPress cannot install, so no link. */
    public function testD7FileChangesTurnedOffByTheHostHaveNoUpgradeLink(): void
    {
        $updates = $this->payload(self::license(), facts: [
            'manifest' => ['update_available' => true, 'manifest' => ['version' => '1.5.0']],
            'fileMods' => false,
            'updateUrl' => 'https://example.com/wp-admin/update.php?x',
        ])['updates'];

        $this->assertFalse($updates['file_mods']);
        $this->assertSame('1.5.0', $updates['latest']);
        $this->assertNull($updates['update_url']);
    }

    /** A licence that stops updates offers no upgrade link, whatever the cache still says. */
    public function testM3AnExpiredLicenceOffersNoUpgradeLink(): void
    {
        $updates = $this->payload(self::license(['status' => 'expired']), facts: [
            'manifest' => ['update_available' => true, 'manifest' => ['version' => '1.5.0']],
            'updateUrl' => 'https://example.com/wp-admin/update.php?x',
        ])['updates'];

        $this->assertNull($updates['update_url']);
    }

    /** Each door goes to the store's own page for it, and the store's answer wins where it gives one. */
    public function testTheDoorsLeadToTheStore(): void
    {
        $urls = $this->payload(self::license())['urls'];

        $this->assertSame('https://my.wconvert.io/account/licenses/7', $urls['account']);
        $this->assertSame('https://my.wconvert.io/account/licenses/7', $urls['sites']);
        $this->assertSame('https://my.wconvert.io/account/licenses/7/upgrade', $urls['upgrade']);
        $this->assertSame('https://my.wconvert.io/account/licenses/7', $urls['renew'], 'no renewal link from the store: the licence page');
        $this->assertSame('https://my.wconvert.io/account/billing', $urls['payment']);
        $this->assertSame('https://my.wconvert.io/account/downloads', $urls['downloads']);
        $this->assertSame('https://wconvert.io/pro/', $urls['checkout']);
        $this->assertSame('https://wconvert.io/support/', $urls['support']);
    }

    public function testS1WithNoLicenceTheDoorsAreTheAccountAndThePlans(): void
    {
        $urls = $this->payload(null)['urls'];

        $this->assertSame('https://my.wconvert.io/account', $urls['account']);
        $this->assertSame('https://wconvert.io/pro/', $urls['checkout']);
    }

    /**
     * A key in wp-config.php: the client sees whether updates work and who to
     * call — no sites, buyer, plan, dates, prices, coupons or account links.
     * Redacted here, so nothing the browser receives can show them.
     */
    public function testP1AManagedLicenceTellsTheClientOnlyWhetherUpdatesWorkAndWhoManagesIt(): void
    {
        $payload = $this->payload(
            self::license(['source' => 'constant', 'renewal' => self::renewal(['offer' => ['code' => 'RENEW20', 'discount_type' => 'percentage', 'discount_value' => 20]])]),
            facts: ['managed' => true, 'contact' => 'Acme Studio <help@acme.studio>', 'domainChange' => ['was' => 'a.com', 'now' => 'example.com']]
        );

        $this->assertSame(['by' => 'Acme Studio', 'email' => 'help@acme.studio'], $payload['managed']);
        $this->assertSame([], $payload['sites']);
        $this->assertNull($payload['buyer']);
        $this->assertNull($payload['plan']);
        $this->assertNull($payload['expires_at']);
        $this->assertNull($payload['days_left']);
        $this->assertNull($payload['renewal']);
        $this->assertNull($payload['domain_change']);
        $this->assertNull($payload['last_checked_at']);
        $this->assertNull($payload['last_success_at']);
        $this->assertSame(['masked' => null, 'source' => 'constant'], $payload['key']);
        $this->assertSame(['support' => 'https://wconvert.io/support/'], $payload['urls']);
        $this->assertStringNotContainsString('RENEW20', (string) json_encode($payload));
        $this->assertStringNotContainsString('2027', (string) json_encode($payload));
    }

    public function testP1AManagedLicenceWithNoContactNamesNobody(): void
    {
        $payload = $this->payload(self::license(['source' => 'constant']), facts: ['managed' => true]);

        $this->assertSame(['by' => null, 'email' => null], $payload['managed']);
    }

    /** "Updates stopped" is all the client is told, and the state is reduced to that. */
    public function testP1AManagedLicenceThatExpiredReadsOnlyAsStopped(): void
    {
        $payload = $this->payload(self::license(['source' => 'constant', 'status' => 'expired', 'error_code' => 'license_expired']), facts: ['managed' => true]);

        $this->assertSame('stopped', $payload['state']);
        $this->assertSame('', $payload['error_code']);
    }

    public function testP1AManagedLicenceThatWorksReadsAsActive(): void
    {
        $payload = $this->payload(self::license(['source' => 'constant', 'renewal' => self::renewal(['auto_renews' => false]), 'expires_at' => '2026-10-15T00:00:00+00:00']), facts: ['managed' => true]);

        $this->assertSame('active', $payload['state'], 'an expiring licence is the agency\'s to know about, not the client\'s');
    }

    public function testP1AManagedLicenceStillOffersItsUpdate(): void
    {
        $updates = $this->payload(self::license(['source' => 'constant']), facts: [
            'managed' => true,
            'manifest' => ['update_available' => true, 'manifest' => ['version' => '1.5.0']],
            'updateUrl' => 'https://example.com/wp-admin/update.php?x',
        ])['updates'];

        $this->assertSame('https://example.com/wp-admin/update.php?x', $updates['update_url']);
    }

    /** The wp-config key has not activated: there is nothing to show but who to call. */
    public function testP3AManagedKeyThatNeverActivatedIsNoneAndManaged(): void
    {
        $payload = $this->payload(null, facts: ['managed' => true, 'contact' => 'help@acme.studio']);

        $this->assertSame('none', $payload['state']);
        $this->assertSame(['by' => null, 'email' => 'help@acme.studio'], $payload['managed']);
        $this->assertSame('constant', $payload['key']['source']);
    }

    public function testAManualLicenceIsNotManaged(): void
    {
        $this->assertNull($this->payload(self::license())['managed']);
    }

    /**
     * @param array<string, mixed>|null $license
     * @param array<string, mixed> $facts
     * @return array<string, mixed>
     */
    private function payload(?array $license, ?string $key = 'WCV-8K2D-L9QX-AB12', array $facts = []): array
    {
        return LicenseState::payload(new LicenseFacts(...[
            'license' => $license,
            'key' => $license === null ? null : $key,
            'now' => self::NOW,
            'installed' => '1.4.2',
            'here' => 'example.com',
            ...$facts,
        ]));
    }

    /**
     * A licence as the SDK stores it after a healthy answer: 5 sites, three in
     * use (one of them a staging copy that uses none), renewing automatically.
     *
     * @param array<string, mixed> $over
     * @return array<string, mixed>
     */
    private static function license(array $over = []): array
    {
        return array_replace([
            'license_key' => 'ciphertext',
            'status' => 'active',
            'error_code' => '',
            'plan_name' => '5 sites',
            'tier_slug' => '5-sites',
            'expires_at' => '2027-03-03T00:00:00+00:00',
            'max_activations' => 5,
            'activation_count' => 2,
            'customer_name' => 'Sara K.',
            'customer_email' => 's***@example.com',
            'renewal' => self::renewal(),
            'manage_url' => 'https://my.wconvert.io/account/licenses/7',
            'upgrade_url' => 'https://my.wconvert.io/account/licenses/7/upgrade',
            'buyer' => ['name' => 'Sara K.', 'email' => 's***@example.com'],
            'sites' => [
                ['id' => 1, 'domain' => 'example.com', 'site_url' => 'https://example.com', 'is_counted' => true, 'activated_at' => '2026-03-03T10:00:00+00:00', 'last_check_at' => '2026-10-12T09:14:00+00:00'],
                ['id' => 2, 'domain' => 'shop.example.com', 'site_url' => 'https://shop.example.com', 'is_counted' => true, 'activated_at' => '2026-04-18T10:00:00+00:00', 'last_check_at' => '2026-10-11T08:00:00+00:00'],
                ['id' => 3, 'domain' => 'staging.example.com', 'site_url' => 'https://staging.example.com', 'is_counted' => false, 'activated_at' => '2026-05-02T10:00:00+00:00', 'last_check_at' => null],
            ],
            'site' => ['active' => true, 'is_counted' => true],
            'activated_at' => 1772532000,
            'source' => 'manual',
            'activated_domain' => 'example.com',
            'last_validated_at' => self::NOW - 3 * 3600,
            'last_success_at' => self::NOW - 3 * 3600,
        ], $over);
    }

    /**
     * Nexus's renewal block (`RenewalOfferService::metaForLicense()`).
     *
     * @param array<string, mixed> $over
     * @return array<string, mixed>
     */
    private static function renewal(array $over = []): array
    {
        return array_replace([
            'subscription_status' => 'active',
            'renews_at' => '2027-03-03T00:00:00+00:00',
            'days_remaining' => 142,
            'state' => 'active',
            'renew_url' => null,
            'offer' => null,
            'is_trial' => false,
            'trial_ends_at' => null,
            'auto_renews' => true,
            'grace_ends_at' => null,
        ], $over);
    }
}

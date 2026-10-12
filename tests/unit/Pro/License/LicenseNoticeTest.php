<?php

namespace WConvert\Tests\Unit\Pro\License;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\License\LicenseNotice;

/**
 * What the licence says OUTSIDE its own page: the header badge's dot and its
 * reason, and the line under Pro on the Plugins screen. One answer, so the two
 * cannot disagree — and the bell is never part of it (it belongs to the
 * notifications feature).
 */
#[CoversClass(LicenseNotice::class)]
final class LicenseNoticeTest extends TestCase
{
    /** @return iterable<string, array{array<string, mixed>, string|null, string|null}> */
    public static function states(): iterable
    {
        yield 'S1 no licence' => [['state' => 'none'], null, 'Activate your license to get updates.'];
        yield 'D1 active' => [['state' => 'active'], null, null];
        yield 'D3 cancelled' => [['state' => 'cancelled'], null, null];
        yield 'D4 lifetime' => [['state' => 'lifetime'], null, null];
        yield 'D5 trial, 12 days' => [['state' => 'trial', 'days_left' => 12], null, null];
        yield 'D5 trial, 3 days' => [['state' => 'trial', 'days_left' => 3], 'amber', 'Your trial ends in 3 days.'];
        yield 'D5 trial ended' => [['state' => 'trial_ended'], 'red', 'Your trial ended, so updates stopped.'];
        yield 'M1 expiring' => [['state' => 'expiring', 'days_left' => 9], 'amber', 'Your license ends in 9 days.'];
        yield 'M1 one day' => [['state' => 'expiring', 'days_left' => 1], 'amber', 'Your license ends in 1 day.'];
        yield 'M2 payment' => [['state' => 'payment_failed', 'renewal' => ['grace_ends_at' => '2026-10-16T12:00:00+00:00']], 'amber', 'Your payment didn’t go through. Update it by 2026-10-16 to keep updates.'];
        yield 'M3 expired' => [['state' => 'expired'], 'red', 'Your license expired, so updates stopped.'];
        yield 'M4 turned off' => [['state' => 'disabled'], 'red', 'This license was turned off, so updates stopped.'];
        yield 'M5 over limit' => [['state' => 'over_limit', 'plan' => ['max' => 5, 'used' => 6]], 'amber', '6 sites use a 5-site license.'];
        yield 'C1 moved' => [['state' => 'moved', 'domain_change' => ['was' => 'old-example.com']], 'amber', 'This site moved from old-example.com, so updates are off here.'];
        yield 'C2 copy' => [['state' => 'copy', 'domain_change' => ['was' => 'example.com']], 'amber', 'This is a copy of example.com, so updates are off here.'];
        yield 'C7 key unreadable' => [['state' => 'key_unreadable'], 'red', 'WordPress can’t read your license key, so updates stopped.'];
    }

    /** @param array<string, mixed> $payload */
    #[DataProvider('states')]
    public function testEachStateHasOneDotAndOneLine(array $payload, ?string $dot, ?string $row): void
    {
        $notice = LicenseNotice::for($payload + ['managed' => null], static fn (string $iso): string => substr($iso, 0, 10));

        $this->assertSame($dot, $notice['dot']);
        $this->assertSame($row, $notice['row']);
    }

    /** P1: an agency's client is reminded of nothing, even when it expired. */
    public function testAManagedLicenceRemindsNobody(): void
    {
        $notice = LicenseNotice::for(['state' => 'stopped', 'managed' => ['by' => null, 'email' => null]]);

        $this->assertNull($notice['dot']);
        $this->assertNull($notice['row']);
        $this->assertNull($notice['title']);
    }

    public function testTheBadgeReasonIsTheTitle(): void
    {
        $notice = LicenseNotice::for(['state' => 'expired', 'managed' => null]);

        $this->assertSame('Your license expired', $notice['title']);
    }
}

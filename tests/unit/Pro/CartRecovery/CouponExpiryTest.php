<?php

namespace WConvert\Tests\Unit\Pro\CartRecovery;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\Module\CartRecovery\CouponExpiry;

/** Whether a code a campaign shows stays valid after the campaign ends (#287). */
#[CoversClass(CouponExpiry::class)]
final class CouponExpiryTest extends TestCase
{
    private static function at(string $wall): int
    {
        return (new \DateTimeImmutable($wall, new \DateTimeZone('Asia/Muscat')))->getTimestamp();
    }

    private static function verdict(?int $expires, ?string $endsAt): string
    {
        return CouponExpiry::verdict($expires, $endsAt, new \DateTimeZone('Asia/Muscat'));
    }

    public function testACouponRunningPastTheCampaignOutlivesIt(): void
    {
        self::assertSame('outlives', self::verdict(self::at('2026-12-31 00:00'), '2026-12-02 00:00'));
    }

    public function testACouponWithNoExpirySaysSo(): void
    {
        self::assertSame('no_expiry', self::verdict(null, '2026-12-02 00:00'));
    }

    public function testExpiringOnOrBeforeTheEndIsFine(): void
    {
        self::assertSame('ok', self::verdict(self::at('2026-12-02 00:00'), '2026-12-02 00:00'));
        self::assertSame('ok', self::verdict(self::at('2026-12-01 00:00'), '2026-12-02 00:00'));
    }

    /** The end is the site's wall time: one second past it in Muscat outlives it. */
    public function testTheEndIsReadInTheSiteTimezone(): void
    {
        self::assertSame('outlives', self::verdict(self::at('2026-12-02 00:00') + 1, '2026-12-02 00:00'));
    }

    public function testACampaignThatNeverEndsIsAlwaysFine(): void
    {
        self::assertSame('ok', self::verdict(null, null));
        self::assertSame('ok', self::verdict(self::at('2030-01-01 00:00'), null));
    }

    public function testAnUnreadableEndIsUnknown(): void
    {
        self::assertSame('unknown', self::verdict(null, 'December 2'));
    }
}

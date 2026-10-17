<?php

namespace WConvert\Tests\Unit\Pro\CartRecovery;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\Module\CartRecovery\CouponLink;

/**
 * `?coupon=CODE` applies an existing WooCommerce coupon to the visitor's own
 * cart, and only a code a published campaign is showing now (ADR 0152).
 */
#[CoversClass(CouponLink::class)]
final class CouponLinkTest extends TestCase
{
    private const SHOWN = ['bf30' => true];

    /**
     * Every argument the store would answer, in the shape that applies.
     *
     * @param array<string, mixed> $overrides
     */
    private static function decide(array $overrides = []): string
    {
        $case = $overrides + ['code' => 'BF30', 'shown' => self::SHOWN, 'exists' => true, 'consent' => true, 'applied' => false, 'empty' => false];

        return CouponLink::decide($case['code'], $case['shown'], $case['exists'], $case['consent'], $case['applied'], $case['empty']);
    }

    public function testACodeACampaignShowsIsAppliedToACartWithItems(): void
    {
        $this->assertSame('apply', self::decide());
    }

    public function testAnEmptyCartHoldsTheCodeForItsFirstItem(): void
    {
        $this->assertSame('pending', self::decide(['empty' => true]));
    }

    /** WooCommerce matches codes without case, so the guard does too. */
    public function testTheCodeIsMatchedWithoutCase(): void
    {
        $this->assertSame('apply', self::decide(['code' => 'bf30']));
    }

    public function testACodeNoCampaignShowsIsLeftAlone(): void
    {
        // It exists in WooCommerce. Applying it would hand out a code the
        // merchant never advertised to whoever has the link.
        $this->assertSame('skip', self::decide(['code' => 'STAFF50']));
        $this->assertSame('skip', self::decide(['shown' => []]));
        $this->assertSame('skip', self::decide(['code' => '']));
    }

    public function testACodeWooCommerceDoesNotHaveIsLeftAlone(): void
    {
        $this->assertSame('skip', self::decide(['exists' => false]));
    }

    public function testWithoutFunctionalConsentNothingIsStoredOrApplied(): void
    {
        $this->assertSame('skip', self::decide(['consent' => false]));
        $this->assertSame('skip', self::decide(['consent' => false, 'empty' => true]));
    }

    public function testACodeAlreadyInTheCartIsNotAppliedTwice(): void
    {
        $this->assertSame('skip', self::decide(['applied' => true]));
    }

    /**
     * @param array<string, mixed> $content
     * @param array<string, int> $window
     * @return array<string, mixed>
     */
    private static function entry(string $id, array $content, array $window = []): array
    {
        return ['id' => $id, 'payload' => $window + ['template' => ['tree' => ['v' => 2, 'steps' => [['id' => 's', 'kind' => 'content', 'content' => $content]]]]]];
    }

    public function testTheShownCodesAreTheServableCampaignsCodesInsideTheirWindow(): void
    {
        $now = 1_800_000_000_000;
        $set = [
            self::entry('LIVE', ['type' => 'stack', 'children' => [['type' => 'code', 'text' => ' BF30 '], ['type' => 'text', 'text' => 'NOTACODE']]]),
            self::entry('ENDED', ['type' => 'code', 'text' => 'OLD10'], ['ends_at' => $now - 1]),
            self::entry('SOON', ['type' => 'code', 'text' => 'XMAS20'], ['starts_at' => $now + 1]),
            self::entry('HIDDEN', ['type' => 'code', 'text' => 'SECRET', 'hidden' => true]),
            self::entry('SUSPENDED', ['type' => 'code', 'text' => 'CART15']),
        ];
        $servable = ['LIVE' => true, 'ENDED' => true, 'SOON' => true, 'HIDDEN' => true];

        $this->assertSame(['bf30' => true], CouponLink::shownCodes($set, $servable, $now));
    }
}

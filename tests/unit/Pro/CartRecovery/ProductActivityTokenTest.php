<?php
namespace WConvert\Tests\Unit\Pro\CartRecovery;

use PHPUnit\Framework\TestCase;
use WConvert\Pro\Module\CartRecovery\ProductActivityToken;

final class ProductActivityTokenTest extends TestCase
{
    public function testOnlyTheServedCardAndPublishedRevisionCanBeReportedWithinTheWindow(): void
    {
        $now = 1791200000;
        $token = ProductActivityToken::issue('campaign', 'revision', 42, $now, 'secret');
        self::assertTrue(ProductActivityToken::valid($token, 'campaign', 'revision', 42, $now + 600, 'secret'));
        foreach ([['other', 'revision', 42, $now, 'secret'], ['campaign', 'old', 42, $now, 'secret'],
            ['campaign', 'revision', 43, $now, 'secret'], ['campaign', 'revision', 42, $now, 'other'],
            ['campaign', 'revision', 42, $now + 1801, 'secret'], ['campaign', 'revision', 42, $now - 1, 'secret']] as $args) {
            self::assertFalse(ProductActivityToken::valid($token, ...$args));
        }
        self::assertFalse(ProductActivityToken::valid('forged', 'campaign', 'revision', 42, $now, 'secret'));
    }
}

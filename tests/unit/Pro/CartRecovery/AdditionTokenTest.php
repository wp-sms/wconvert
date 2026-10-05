<?php
namespace WConvert\Tests\Unit\Pro\CartRecovery;

use PHPUnit\Framework\TestCase;
use WConvert\Pro\Module\CartRecovery\AdditionToken;

final class AdditionTokenTest extends TestCase
{
    public function testProtectionIsBoundToSessionCampaignRevisionAndExpiry(): void
    {
        $token = AdditionToken::issue('shopper', 'campaign', 'revision', 'mount', 100, 'secret');
        self::assertSame(['mount' => 'mount', 'expires' => 1900], AdditionToken::read($token, 'shopper', 'campaign', 'revision', 101, 'secret'));
        self::assertNull(AdditionToken::read($token, 'another shopper', 'campaign', 'revision', 101, 'secret'));
        self::assertNull(AdditionToken::read($token, 'shopper', 'campaign', 'changed', 101, 'secret'));
        self::assertNull(AdditionToken::read($token, 'shopper', 'campaign', 'revision', 1900, 'secret'));
        self::assertNull(AdditionToken::read($token . 'x', 'shopper', 'campaign', 'revision', 101, 'secret'));
    }
}

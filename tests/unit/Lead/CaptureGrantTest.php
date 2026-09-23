<?php
namespace WConvert\Tests\Unit\Lead;
use PHPUnit\Framework\TestCase;
use WConvert\Lead\CaptureGrant;
final class CaptureGrantTest extends TestCase
{
    public function testOnlyTheOriginalUnexpiredCampaignContractCanContinue(): void
    {
        $grants = new CaptureGrant('test-secret');
        $token = $grants->issue('campaign', 'contract', 100);
        self::assertNotNull($grants->verify($token, 'campaign', 'contract', 101));
        self::assertNull($grants->verify($token, 'other', 'contract', 101));
        self::assertNull($grants->verify($token, 'campaign', 'changed', 101));
        self::assertNull($grants->verify($token, 'campaign', 'contract', 1900));
        self::assertNull((new CaptureGrant('another-key'))->verify($token, 'campaign', 'contract', 101));
    }
}

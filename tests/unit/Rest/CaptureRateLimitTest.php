<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Rest\CaptureRateLimit;
use WConvert\Tests\Unit\Support\FakeTransientStore;

#[CoversClass(CaptureRateLimit::class)]
final class CaptureRateLimitTest extends TestCase
{
    public function testItIsPerCampaignAndStoresNoRawAddress(): void
    {
        $store = new FakeTransientStore();
        $limit = new CaptureRateLimit($store);

        for ($attempt = 0; $attempt < CaptureRateLimit::ALLOWED; $attempt++) {
            $this->assertTrue($limit->allows('203.0.113.42', 'CAMPAIGN-A', 1_700_000_000));
        }

        $this->assertFalse($limit->allows('203.0.113.42', 'CAMPAIGN-A', 1_700_000_000));
        $this->assertTrue($limit->allows('203.0.113.42', 'CAMPAIGN-B', 1_700_000_000));
        $this->assertStringNotContainsString('203.0.113.42', serialize($store->stored));
    }

    public function testAnUnknownAddressFailsOpenAndStoresNothing(): void
    {
        $store = new FakeTransientStore();

        $this->assertTrue((new CaptureRateLimit($store))->allows('', 'CAMPAIGN-A', 1_700_000_000));
        $this->assertSame([], $store->stored);
    }

    public function testTheAllowanceReturnsAfterTheWindow(): void
    {
        $store = new FakeTransientStore();
        $store->sweeps = false;
        $limit = new CaptureRateLimit($store);

        for ($attempt = 0; $attempt <= CaptureRateLimit::ALLOWED; $attempt++) {
            $limit->allows('203.0.113.42', 'CAMPAIGN-A', 1_700_000_000);
        }

        $this->assertTrue($limit->allows('203.0.113.42', 'CAMPAIGN-A', 1_700_000_000 + CaptureRateLimit::WINDOW));
    }

    public function testRepeatedAttemptsDoNotExtendHowLongTheHashIsKept(): void
    {
        $store = new FakeTransientStore();
        $limit = new CaptureRateLimit($store);
        $now = 1_700_000_000;

        $limit->allows('203.0.113.42', 'CAMPAIGN-A', $now);
        $expires = array_values($store->stored)[0]['expires'];
        $store->now += 120;
        $limit->allows('203.0.113.42', 'CAMPAIGN-A', $now + 120);

        $this->assertSame($expires, array_values($store->stored)[0]['expires']);
    }
}

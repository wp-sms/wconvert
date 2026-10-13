<?php

namespace WConvert\Tests\Unit\Pro\Destination;

use PHPUnit\Framework\TestCase;
use WConvert\Pro\Module\Destinations\WebhookSignature;

/** Signing is Standard Webhooks, checked against the specification's own example. */
final class WebhookSignatureTest extends TestCase
{
    /** From the Standard Webhooks specification's reference test vector. */
    public function testItReproducesTheSpecificationsExample(): void
    {
        self::assertSame('v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
            WebhookSignature::sign('whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw', 'msg_p5jXN8AQM9LWM0D4loKWxJek', 1614265330, '{"test": 2432232314}'));
    }

    public function testTheSignatureCoversTheExactBytesSent(): void
    {
        $secret = WebhookSignature::secret();
        $body = '{"answer":"Ja, gerne 👍 — 东京"}';
        $signature = WebhookSignature::sign($secret, 'msg_1', 1700000000, $body);
        self::assertNotSame($signature, WebhookSignature::sign($secret, 'msg_1', 1700000000, $body . ' '));
        self::assertNotSame($signature, WebhookSignature::sign($secret, 'msg_1', 1700000001, $body), 'A retry re-signs with its own time.');
        self::assertNotSame($signature, WebhookSignature::sign(WebhookSignature::secret(), 'msg_1', 1700000000, $body), 'A regenerated secret signs differently.');
    }

    public function testAGeneratedSecretIsThirtyTwoRandomBytesInTheSpecificationsFormat(): void
    {
        $secret = WebhookSignature::secret();
        self::assertMatchesRegularExpression('/^whsec_[A-Za-z0-9+\/]{43}=$/D', $secret);
        $bytes = base64_decode(substr($secret, 6), true);
        self::assertIsString($bytes);
        self::assertSame(32, strlen($bytes));
        self::assertTrue(WebhookSignature::isSecret($secret));
        self::assertNotSame($secret, WebhookSignature::secret());
    }

    public function testAnythingElseIsNotASecret(): void
    {
        foreach (['', 'whsec_', 'whsec_not base64!', 'MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw', 'whsec_' . base64_encode('short')] as $value) {
            self::assertFalse(WebhookSignature::isSecret($value), $value);
        }
    }
}

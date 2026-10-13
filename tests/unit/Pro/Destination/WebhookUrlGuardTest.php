<?php

namespace WConvert\Tests\Unit\Pro\Destination;

use PHPUnit\Framework\TestCase;
use WConvert\Pro\Module\Destinations\WebhookUrlGuard;

/**
 * A webhook may point at any public host on any port, and at nothing on the
 * site's own network: a merchant's form must not become a way to reach the
 * server's metadata endpoint or an admin panel bound to localhost.
 */
final class WebhookUrlGuardTest extends TestCase
{
    /** @param array<string, list<string>> $dns */
    private static function guard(array $dns = []): WebhookUrlGuard
    {
        return new WebhookUrlGuard(static fn (string $host): array => $dns[$host] ?? []);
    }

    public function testAPublicHostOnAnyPortIsAllowed(): void
    {
        $guard = self::guard(['n8n.example.com' => ['93.184.216.34'], 'hooks.zapier.com' => ['2600:1f18::1', '54.1.2.3']]);
        self::assertNull($guard->refusal('https://n8n.example.com:5678/webhook/abc'));
        self::assertNull($guard->refusal('https://hooks.zapier.com/hooks/catch/1/x/'));
        self::assertNull($guard->refusal('http://user:pass@n8n.example.com/webhook'));
        self::assertNull($guard->refusal('http://[64:ff9b::808:808]/'), 'NAT64 to a public address is public.');
    }

    public function testTheSitesOwnNetworkIsRefused(): void
    {
        $guard = self::guard(['localhost' => ['127.0.0.1'], 'intranet.example' => ['10.0.0.8'], 'mixed.example' => ['93.184.216.34', '192.168.1.10']]);
        foreach (['http://localhost:5678/', 'http://127.0.0.1/', 'http://10.1.2.3/', 'http://192.168.0.5:8080/', 'http://[::1]/', 'http://169.254.169.254/latest/',
            'http://[::ffff:127.0.0.1]/', 'http://100.64.0.1/', 'http://198.18.0.1/', 'http://[64:ff9b::7f00:1]/', 'http://[64:ff9b::a00:1]/',
            'https://intranet.example/', 'https://mixed.example/'] as $url) {
            self::assertSame(WebhookUrlGuard::PRIVATE, $guard->refusal($url), $url);
        }
    }

    public function testADeveloperMayAllowTheirOwnNetwork(): void
    {
        self::assertNull(self::guard(['localhost' => ['127.0.0.1']])->refusal('http://localhost:5678/', true));
    }

    public function testOnlyHttpUrlsAreWebhooks(): void
    {
        foreach (['', 'hooks.zapier.com/x', 'ftp://example.com/', 'file:///etc/passwd', 'gopher://example.com/', 'https:///nohost'] as $url) {
            self::assertSame(WebhookUrlGuard::INVALID, self::guard()->refusal($url), $url);
        }
    }

    public function testAHostThatDoesNotResolveIsSaidSo(): void
    {
        self::assertSame(WebhookUrlGuard::UNRESOLVED, self::guard()->refusal('https://no-such-host.example/'));
    }
}

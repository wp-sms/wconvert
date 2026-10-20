<?php
namespace WConvert\Tests\Unit\Pro\License;

use PHPUnit\Framework\TestCase;
use WConvert\Pro\License\{TemplateDownloads, SdkConfig};
use WConvert\Template\Catalog\WpCatalogTransport;

final class TemplateDownloadsTest extends TestCase
{
    use FakesNexus;
    /** @var list<array{string, array<string, mixed>}> */
    private array $requests = [];
    private \WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Container\PremiumServiceProvider $sdk;
    private const ORIGIN = 'https://templates.example';
    private const DIGEST = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    protected function setUp(): void
    {
        $this->fakeNexus();
        $this->sdk = SdkConfig::sdk();
        $this->sdk->licenseManager()->activate('local-test-key');
        $this->requests = [];
        $GLOBALS['wconvertHttpReply'] = function ($url, $args) {
            $this->requests[] = [$url, $args];
            return ['response' => ['code' => 200], 'body' => str_ends_with($url, '/grants') ? json_encode(['grant' => 'eyJhbGciOiJFZERTQSJ9.e30.c2ln', 'expires_in' => 300]) : 'file'];
        };
    }
    protected function tearDown(): void { unset($GLOBALS['wconvertHttpReply']); $this->stopFakingNexus(); }
    private function transport(string $origin = self::ORIGIN): TemplateDownloads { return new TemplateDownloads($this->sdk, new WpCatalogTransport(), $origin); }
    /** One premium design, the way the catalogue asks for it: a pass for the batch, then the file. */
    private function pack(TemplateDownloads $http): string { $http->authorize([self::DIGEST], []); return $http->premium('premium/designs/' . self::DIGEST . '.json', 262144); }
    public function testProviderUsesHostedOriginWithoutTrustingTheEditableCatalogueSource(): void
    {
        $container = (new \ReflectionClass(\WConvert\Container\ServiceContainer::class))->newInstanceWithoutConstructor();
        (new \WConvert\Pro\License\LicenseServiceProvider())->register($container);
        $container->register(\WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Container\PremiumServiceProvider::class, fn () => $this->sdk);
        update_option(\WConvert\Template\Catalog\TemplateCatalog::SOURCE_OPTION, 'https://untrusted.example/manifest.json');
        $http = $container->resolve(\WConvert\Template\Catalog\CatalogTransport::class);
        self::assertInstanceOf(TemplateDownloads::class, $http);
        self::assertCount(0, $this->requests, 'Resolving the default transport must not fetch');
        // Premium paths are relative to the pinned origin: the editable source can name none.
        self::assertSame('file', $this->pack($http));
        self::assertSame('https://templates.wconvert.io/v3/grants', $this->requests[0][0]);
        self::assertSame('https://templates.wconvert.io/v3/premium/designs/' . self::DIGEST . '.json', $this->requests[1][0]);
        self::assertSame('local-test-key', $this->requests[0][1]['headers']['X-License-Key']);
    }
    public function testCredentialsOnlyGoToPinnedGrantEndpointAndPassIsReusedForImages(): void
    {
        $http = $this->transport();
        self::assertSame('file', $this->pack($http));
        self::assertSame('file', $http->premium('premium/assets/' . self::DIGEST . '.png', 100));
        self::assertCount(3, $this->requests);
        self::assertSame('local-test-key', $this->requests[0][1]['headers']['X-License-Key']);
        self::assertSame(['domain' => 'example.test', 'designs' => [self::DIGEST], 'setups' => []], json_decode($this->requests[0][1]['body'], true));
        foreach (array_slice($this->requests, 1) as [$url, $args]) {
            self::assertArrayNotHasKey('X-License-Key', $args['headers']); self::assertStringStartsWith('Bearer ', $args['headers']['Authorization']);
            self::assertSame(0, $args['redirection']); self::assertStringNotContainsString('local-test-key', $url);
        }
    }
    public function testPublicDownloadsNeverReadOrTransmitCredentials(): void
    {
        $http = $this->transport(); $http->get(self::ORIGIN . '/v3/manifest.json'); $http->image(self::ORIGIN . '/v3/assets/' . self::DIGEST . '.png', 100);
        foreach ($this->requests as [$url, $args]) { self::assertArrayNotHasKey('Authorization', $args['headers']); self::assertArrayNotHasKey('X-License-Key', $args['headers']); }
        self::assertCount(2, $this->requests);
    }
    public function testUnconfiguredOrDifferentOriginNeverReceivesCredentials(): void
    {
        foreach (['', 'http://templates.example', 'https://user@templates.example', 'https://templates.example/path'] as $origin) {
            try { $this->pack($this->transport($origin)); self::fail('Accepted untrusted origin'); } catch (\RuntimeException $e) { self::assertStringContainsString('not configured', $e->getMessage()); }
        }
        self::assertSame([], $this->requests);
    }
    public function testExpiredPassRefreshesOnlyOnce(): void
    {
        $grants = 0; $files = 0;
        $GLOBALS['wconvertHttpReply'] = function ($url) use (&$grants, &$files) {
            if (str_ends_with($url, '/grants')) { $grants++; return ['response'=>['code'=>200], 'body'=>json_encode(['grant'=>'a.b.c','expires_in'=>300])]; }
            $files++; return ['response'=>['code'=>401], 'body'=>json_encode(['error_code'=>'invalid_grant'])];
        };
        try { $this->pack($this->transport()); self::fail('Accepted expired pass'); } catch (\RuntimeException $e) { self::assertStringContainsString('expired', $e->getMessage()); }
        self::assertSame(2, $grants); self::assertSame(2, $files);
    }
    public function testRefusalsAreSpecificAndNeverRetryOrEchoServerSecrets(): void
    {
        foreach (['license_expired'=>'Renew', 'domain_not_allowed'=>'Activate', 'invalid_key'=>'Settings', 'service_not_allowed'=>'Try again later'] as $code=>$message) {
            $count=0;
            $GLOBALS['wconvertHttpReply'] = function () use ($code,&$count) { $count++; return ['response'=>['code'=>403], 'body'=>json_encode(['error_code'=>$code,'message'=>'secret-value'])]; };
            try { $this->pack($this->transport()); self::fail('Accepted refusal'); } catch (\RuntimeException $e) { self::assertStringContainsString($message,$e->getMessage()); self::assertStringNotContainsString('secret-value',$e->getMessage()); }
            self::assertSame(1,$count);
        }
    }
    public function testRateLimitIsHonouredAcrossRequestsWithoutCallingServerAgain(): void
    {
        $count=0;
        $GLOBALS['wconvertHttpReply'] = function () use (&$count) { $count++; return ['response'=>['code'=>429], 'headers'=>['retry-after'=>'45'], 'body'=>'{}']; };
        for ($i=0;$i<2;$i++) { try { $this->pack($this->transport()); self::fail('Accepted rate limit'); } catch (\RuntimeException $e) { self::assertStringContainsString('temporarily unavailable',$e->getMessage()); } }
        self::assertSame(1,$count);
    }
    public function testIssuanceBackoffDoesNotInterruptAnAlreadyAuthorizedDownload(): void
    {
        foreach ([429, 503] as $status) {
            $origin = 'https://templates' . $status . '.example';
            $first = $this->transport($origin);
            $this->pack($first);
            $normal = $GLOBALS['wconvertHttpReply'];
            $GLOBALS['wconvertHttpReply'] = static fn () => ['response' => ['code' => $status], 'headers' => ['retry-after' => '45'], 'body' => '{}'];
            try { $this->pack($this->transport($origin)); self::fail('Accepted unavailable issuance'); }
            catch (\RuntimeException $e) { self::assertStringContainsString('temporarily unavailable', $e->getMessage()); }
            $GLOBALS['wconvertHttpReply'] = $normal;
            self::assertSame('file', $first->premium('premium/assets/' . self::DIGEST . '.png', 100));
            $before = count($this->requests);
            try { $this->pack($this->transport($origin)); self::fail('Ignored issuance backoff'); }
            catch (\RuntimeException $e) { self::assertStringContainsString('temporarily unavailable', $e->getMessage()); }
            self::assertCount($before, $this->requests);
        }
    }

    public function testFileDeliveryBackoffStillProtectsTheFileServer(): void
    {
        $first = $this->transport();
        $this->pack($first);
        $calls = 0;
        $GLOBALS['wconvertHttpReply'] = static function () use (&$calls) { $calls++; return ['response' => ['code' => 503], 'headers' => ['retry-after' => '30'], 'body' => '{}']; };
        for ($i = 0; $i < 2; $i++) {
            try { $first->premium('premium/assets/' . self::DIGEST . '.png', 100); self::fail('Accepted unavailable file'); }
            catch (\RuntimeException $e) { self::assertStringContainsString('temporarily unavailable', $e->getMessage()); }
        }
        self::assertSame(1, $calls);
    }

    #[\PHPUnit\Framework\Attributes\RunInSeparateProcess]
    public function testManagedLicenceRefusalsHideDetailsAndDirectUsersToTheirManager(): void
    {
        define('WCONVERT_LICENSE_KEY', 'managed-fixture-key');
        foreach (['invalid_key', 'license_expired', 'key_disabled', 'license_suspended', 'license_revoked', 'domain_not_allowed'] as $code) {
            $GLOBALS['wconvertHttpReply'] = static function ($url, $args) use ($code) {
                self::assertSame('managed-fixture-key', $args['headers']['X-License-Key']);
                return ['response' => ['code' => 403], 'body' => json_encode(['error_code' => $code, 'message' => 'private licence detail'])];
            };
            try { $this->pack($this->transport()); self::fail('Accepted refused managed key'); }
            catch (\RuntimeException $e) {
                self::assertSame('Premium template access is unavailable. Contact the person managing your licence. Installed designs still work.', $e->getMessage());
            }
        }
    }

    public function testMissingKeyMakesNoDownloadRequest(): void
    {
        $this->sdk->licenseManager()->deactivate();
        try { $this->pack($this->transport()); self::fail('Accepted missing key'); }
        catch (\RuntimeException $e) { self::assertStringContainsString('Connect your', $e->getMessage()); }
        self::assertSame([], $this->requests);
    }
    public function testSiteIdentityKeepsSubdirectoryAndUsesSdkNormalization(): void
    {
        $before = $GLOBALS['wconvertTestQuery'];
        try {
            $GLOBALS['wconvertTestQuery']['home_url'] = 'https://www.Example.test:8443/Shop/';
            $this->pack($this->transport());
            self::assertSame('example.test/shop', json_decode($this->requests[0][1]['body'], true)['domain']);
        } finally { $GLOBALS['wconvertTestQuery'] = $before; }
    }
    public function testNetworkFailureDoesNotSayInvalidLicenceOrEchoTransportDetails(): void
    {
        $GLOBALS['wconvertHttpReply'] = static fn () => new \WP_Error('timeout', 'private transport details');
        try { $this->pack($this->transport()); self::fail('Accepted network failure'); }
        catch (\RuntimeException $e) { self::assertStringContainsString('could not be reached', $e->getMessage()); self::assertStringNotContainsString('private transport', $e->getMessage()); }
    }
    public function testRedirectAndOversizedResponsesAreRefused(): void
    {
        foreach ([['response'=>['code'=>302], 'body'=>'', 'headers'=>['location'=>'https://other.example']], ['response'=>['code'=>200], 'body'=>str_repeat('x',16385)]] as $response) {
            $GLOBALS['wconvertHttpReply'] = static fn () => $response;
            try { $this->pack($this->transport()); self::fail('Accepted invalid response'); }
            catch (\RuntimeException $e) { self::assertNotSame('', $e->getMessage()); }
        }
    }

}

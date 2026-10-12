<?php

namespace WConvert\Tests\Unit\Pro\License;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\License\LicenseController;
use WConvert\Pro\License\SdkConfig;
use WConvert\Rest\Routes;
use WConvert\Tests\Unit\Support\FakeTransientStore;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * The License page's routes, driven through the real SDK with the store
 * answered in-process.
 */
#[CoversClass(LicenseController::class)]
final class LicenseControllerTest extends TestCase
{
    use FakesNexus;

    private FakeTransientStore $transients;

    protected function setUp(): void
    {
        $this->fakeNexus();
        $this->transients = new FakeTransientStore();
    }

    protected function tearDown(): void
    {
        $this->stopFakingNexus();
        $GLOBALS['wconvertTestRoutes'] = [];
    }

    /** P4: every route asks for the one management capability. */
    public function testEveryRouteIsForSomebodyWhoCanManageWConvert(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];
        $this->controller()->registerRoutes();

        $routes = array_filter($GLOBALS['wconvertTestRoutes'], static fn (array $r): bool => str_starts_with($r['route'], '/license'));
        $this->assertCount(11, $routes);

        foreach ($routes as $route) {
            $this->assertSame(Routes::NAMESPACE, $route['namespace']);
            $this->assertSame([Routes::class, 'canManage'], $route['args'][0]['permission_callback'], $route['route']);
        }
    }

    public function testS1WithNoLicenceTheStateIsNone(): void
    {
        $this->assertSame('none', $this->data($this->controller()->show($this->request()))['state']);
    }

    /** A pasted key is cleaned, activated, and answered with the state. */
    public function testActivatingAKeyReturnsTheNewState(): void
    {
        $response = $this->controller()->activate($this->request(['key' => " wcv–8k2d–l9qx–ab12 \n"]));

        $this->assertSame('active', $this->data($response)['state']);
        $this->assertSame('WCV-8K2D-L9QX-AB12', $this->nexusCallsTo('/api/v1/license/activate')[0]['license_key']);
    }

    /** S6, S7: the store's own code comes back, with an HTTP status the page can branch on. */
    public function testARefusedKeyComesBackWithTheStoresCode(): void
    {
        $this->nexusRefusal = ['code' => 'invalid_key', 'status' => 422];

        $error = $this->controller()->activate($this->request(['key' => 'WCV-TYPO']));

        $this->assertInstanceOf(WP_Error::class, $error);
        $this->assertSame('invalid_key', $error->get_error_code());
        $this->assertSame(422, $error->get_error_data()['status']);
    }

    public function testAnEmptyKeyIsRefusedBeforeTheStoreIsAsked(): void
    {
        $error = $this->controller()->activate($this->request(['key' => "  \n"]));

        $this->assertInstanceOf(WP_Error::class, $error);
        $this->assertSame('empty', $error->get_error_code());
        $this->assertSame([], $this->nexusCalls);
    }

    /** P6: a code from a future store is passed through as it is, never blanked. */
    public function testAnUnknownCodeIsPassedThrough(): void
    {
        $this->nexusRefusal = ['code' => 'license_quantum_flux', 'status' => 422];

        $error = $this->controller()->activate($this->request(['key' => 'WCV-ZZZZ']));

        $this->assertInstanceOf(WP_Error::class, $error);
        $this->assertSame('license_quantum_flux', $error->get_error_code());
    }

    /** S10: rate limited is a 429 with the wait. */
    public function testRateLimitedIsA429(): void
    {
        $this->nexusRefusal = ['code' => 'rate_limited', 'status' => 429];

        $error = $this->controller()->activate($this->request(['key' => 'WCV-RATE']));

        $this->assertInstanceOf(WP_Error::class, $error);
        $this->assertSame(429, $error->get_error_data()['status']);
    }

    /** S9: a store that cannot be reached is a gateway failure, not the merchant's mistake. */
    public function testAnUnreachableStoreIsA502(): void
    {
        $this->nexusDown = true;

        $error = $this->controller()->activate($this->request(['key' => 'WCV-DOWN']));

        $this->assertInstanceOf(WP_Error::class, $error);
        $this->assertSame('network_error', $error->get_error_code());
        $this->assertSame(502, $error->get_error_data()['status']);
    }

    /** P2: the new key first, then the old seat — no gap, and no orphan (#30). */
    public function testReplacingAKeyActivatesTheNewOneThenReleasesTheOld(): void
    {
        $this->activateLicenseHere('WCV-OLD0-0000-0001');
        $this->nexusCalls = [];

        $data = $this->data($this->controller()->replace($this->request(['key' => 'WCV-NEW0-0000-0002'])));

        $this->assertSame(['/api/v1/license/activate', '/api/v1/license/validate', '/api/v1/license/deactivate'], array_column($this->nexusCalls, 0));
        $this->assertSame('WCV-OLD0-0000-0001', $this->nexusCallsTo('/api/v1/license/deactivate')[0]['license_key']);
        $this->assertTrue($data['released']['removed_remotely']);
        $this->assertSame('••••0002', $data['key']['masked']);
    }

    /** The same key in other letter case is the same licence to the store: re-entering it frees nothing (#30). */
    public function testReplacingAKeyWithItselfInOtherCaseReleasesNothing(): void
    {
        $this->activateLicenseHere('wcv-same-0000-0001');
        $this->nexusCalls = [];

        $data = $this->data($this->controller()->replace($this->request(['key' => 'WCV-SAME-0000-0001'])));

        $this->assertSame([], $this->nexusCallsTo('/api/v1/license/deactivate'), 'the seat just activated was released');
        $this->assertTrue($data['released']['removed_remotely']);
        $this->assertSame('active', $data['state']);
    }

    /** Rotated salts: the old seat cannot be released, and the answer says so rather than claiming it was. */
    public function testReplacingAKeyThatNoLongerDecryptsSaysTheOldSeatWasNotFreed(): void
    {
        $this->activateLicenseHere();
        $stored = get_option(SdkConfig::OPTION_KEY);
        $stored['license']['license_key'] = base64_encode(str_repeat('x', 64));
        $GLOBALS['wconvertTestOptionTable'][SdkConfig::OPTION_KEY] = $stored;

        $data = $this->data($this->controller()->replace($this->request(['key' => 'WCV-NEW0-0000-0002'])));

        $this->assertFalse($data['released']['removed_remotely']);
        $this->assertSame('key_unreadable', $data['released']['error_code']);
    }

    /** C2: activating a staging copy, without saying, never frees the live site's seat. */
    public function testMovingWithoutSayingLeavesTheChoiceToTheSdk(): void
    {
        $this->activateLicenseHere();
        $GLOBALS['wconvertTestQuery']['home_url'] = 'https://staging2.example.test';
        $this->nexusLicense = ['site' => ['active' => true, 'is_counted' => false]];

        try {
            $this->data($this->controller()->move($this->request()));
        } finally {
            unset($GLOBALS['wconvertTestQuery']['home_url']);
        }

        $this->assertSame([], $this->nexusCallsTo('/api/v1/license/deactivate'), 'a staging copy freed the live site\'s seat');
    }

    /** C4: http→https and www are one site to the store: no move, no banner. */
    public function testC4WwwIsTheSameSite(): void
    {
        $this->activateLicenseHere();
        $GLOBALS['wconvertTestQuery']['home_url'] = 'https://www.example.test';

        try {
            $data = $this->data($this->controller()->show($this->request()));
        } finally {
            unset($GLOBALS['wconvertTestQuery']['home_url']);
        }

        $this->assertSame('active', $data['state']);
        $this->assertNull($data['domain_change']);
    }

    /** L3: removed from this site, with the store reachable or not. */
    public function testRemovingFromThisSiteForgetsTheLicenceAndSaysWhetherTheSeatWasFreed(): void
    {
        $this->activateLicenseHere();
        $this->nexusDown = true;

        $data = $this->data($this->controller()->remove());

        $this->assertSame('none', $data['state']);
        $this->assertFalse($data['released']['removed_remotely']);
        $this->assertFalse(get_option(SdkConfig::OPTION_KEY)['license'] ?? false);
    }

    public function testThisSiteCannotBeRemovedFromTheSitesList(): void
    {
        $this->activateLicenseHere();

        $error = $this->controller()->removeSite($this->request(['domain' => 'example.test']));

        $this->assertInstanceOf(WP_Error::class, $error);
        $this->assertSame('this_site', $error->get_error_code());
    }

    public function testAnotherSiteIsRemoved(): void
    {
        $this->activateLicenseHere();

        $this->controller()->removeSite($this->request(['domain' => 'shop.example.com']));

        $this->assertSame('shop.example.com', $this->nexusCallsTo('/api/v1/license/deactivate')[0]['domain'] ?? null);
    }

    /** D8: coming back to the tab asks the store — at most once a minute. */
    public function testTheFocusCheckAsksTheStoreAtMostOnceAMinute(): void
    {
        $this->activateLicenseHere();
        $this->nexusCalls = [];

        $this->controller()->show($this->request(['check' => true]));
        $this->controller()->show($this->request(['check' => true]));

        $this->assertCount(2, $this->nexusCallsTo('/api/v1/license/validate'), 'one status check and one sites check, once');
    }

    public function testPlainReadsNeverAskTheStore(): void
    {
        $this->activateLicenseHere();
        $this->nexusCalls = [];

        $this->controller()->show($this->request());

        $this->assertSame([], $this->nexusCalls);
    }

    public function testCheckingForUpdatesAsksWordPressToRebuildItsList(): void
    {
        $before = $GLOBALS['wconvertTestPluginUpdateChecks'] ?? 0;

        $data = $this->data($this->controller()->checkUpdates());

        $this->assertArrayHasKey('updates', $data);
        $this->assertSame($before + 1, $GLOBALS['wconvertTestPluginUpdateChecks']);
    }

    /** S3, S8: the chooser shows masked keys, and which licences have no site left — never a raw key. */
    public function testTheAccountsLicencesAreListedWithoutTheirKeys(): void
    {
        $this->nexusAccountLicenses = [
            self::accountLicense(11, 'WCV-AAAA-BBBB-1111', 5, ['a.com', 'b.com']),
            self::accountLicense(12, 'WCV-CCCC-DDDD-2222', 1, ['other.com']),
        ];
        $this->signInToTheAccount();

        $data = $this->data($this->controller()->account());

        $this->assertTrue($data['signed_in']);
        $this->assertSame('s***@example.com', $data['email_masked']);
        $this->assertSame([11, 12], array_column($data['licenses'], 'id'));
        $this->assertSame(['••••1111', '••••2222'], array_column($data['licenses'], 'key_masked'));
        $this->assertSame([false, true], array_column($data['licenses'], 'full'));
        $this->assertStringNotContainsString('WCV-AAAA', (string) json_encode($data));
    }

    public function testChoosingALicenceByIdActivatesItsKey(): void
    {
        $this->nexusAccountLicenses = [self::accountLicense(11, 'WCV-AAAA-BBBB-1111', 5, []), self::accountLicense(12, 'WCV-CCCC-DDDD-2222', 5, [])];
        $this->signInToTheAccount();

        $data = $this->data($this->controller()->choose($this->request(['license_id' => 12])));

        $this->assertSame('active', $data['state']);
        $this->assertSame('WCV-CCCC-DDDD-2222', $this->nexusCallsTo('/api/v1/license/activate')[0]['license_key']);
    }

    /** S2: one licence on the account activates straight away. */
    public function testS2ASignInWithOneLicenceActivatesIt(): void
    {
        $this->nexusAccountLicenses = [self::accountLicense(11, 'WCV-ONLY-0NE0-1111', 5, [])];

        $this->signInToTheAccount();

        $this->assertSame('active', $this->data($this->controller()->show($this->request()))['state']);
        $this->assertSame('WCV-ONLY-0NE0-1111', $this->nexusCallsTo('/api/v1/license/activate')[0]['license_key']);
    }

    /** S4: an account with no WConvert licence — usually the wrong account. */
    public function testS4AnAccountWithNoLicenceListsNone(): void
    {
        $this->signInToTheAccount();

        $data = $this->data($this->controller()->account());

        $this->assertTrue($data['signed_in']);
        $this->assertSame([], $data['licenses']);
    }

    /** S5: a session past its 24 hours reads as timed out, not as never signed in. */
    public function testS5ASessionPastItsTimeSaysItTimedOut(): void
    {
        $this->nexusAccountLicenses = [self::accountLicense(11, 'WCV-AAAA-BBBB-1111', 5, []), self::accountLicense(12, 'WCV-CCCC-DDDD-2222', 5, [])];
        $this->signInToTheAccount();
        $stored = get_option(SdkConfig::OPTION_KEY);
        $stored['account']['expires_at'] = time() - 60;
        $GLOBALS['wconvertTestOptionTable'][SdkConfig::OPTION_KEY] = $stored;

        $data = $this->data($this->controller()->account());

        $this->assertFalse($data['signed_in']);
        $this->assertSame('account_expired', $data['error_code']);
    }

    /** The sign-in belongs to the site (SDK 1.0.0-beta.9): every administrator shares it, and any of them may end it. */
    public function testEveryAdministratorSharesTheSignIn(): void
    {
        $this->nexusAccountLicenses = [self::accountLicense(11, 'WCV-AAAA-BBBB-1111', 5, []), self::accountLicense(12, 'WCV-CCCC-DDDD-2222', 5, [])];
        $this->signInToTheAccount();
        $GLOBALS['wconvertTestUserId'] = 2;

        try {
            $list = $this->data($this->controller()->account());
            $out = $this->data($this->controller()->signOut());
        } finally {
            unset($GLOBALS['wconvertTestUserId']);
        }

        $this->assertTrue($list['signed_in']);
        $this->assertCount(2, $list['licenses']);
        $this->assertFalse($out['signed_in']);
    }

    /** A sign-in that went wrong says so once, with the SDK's code beside the message (#32). */
    public function testASignInErrorComesBackWithItsCodeOnce(): void
    {
        $this->signInToTheAccount();
        $this->freshSdk()->accountManager()->setFlashError('Your account has no licenses for this product.', 'no_licenses');

        $first = $this->data($this->controller()->account());
        $second = $this->data($this->controller()->account());

        $this->assertSame('no_licenses', $first['error_code']);
        $this->assertSame('Your account has no licenses for this product.', $first['message']);
        $this->assertNull($second['error_code']);
        $this->assertNull($second['message']);
    }

    /** S5: an expired sign-in signs out and says so. */
    public function testAnExpiredSignInSaysSo(): void
    {
        $this->signInToTheAccount();
        $this->nexusAccountExpired = true;

        $data = $this->data($this->controller()->account());

        $this->assertFalse($data['signed_in']);
        $this->assertSame('account_expired', $data['error_code']);
    }

    private function controller(): LicenseController
    {
        return new LicenseController($this->freshSdk(), $this->transients);
    }

    /** @param array<string, mixed> $params */
    private function request(array $params = []): WP_REST_Request
    {
        $request = new WP_REST_Request('GET', '/wconvert/v1/license');

        foreach ($params as $name => $value) {
            $request->set_param($name, $value);
        }

        return $request;
    }

    /**
     * @param WP_REST_Response|WP_Error $response
     * @return array<string, mixed>
     */
    private function data($response): array
    {
        $this->assertInstanceOf(WP_REST_Response::class, $response, $response instanceof WP_Error ? $response->get_error_code() : '');

        return $response->get_data();
    }

    /**
     * @param list<string> $domains
     * @return array<string, mixed>
     */
    private static function accountLicense(int $id, string $key, int $limit, array $domains): array
    {
        return [
            'id' => $id,
            'key' => $key,
            'type' => $limit === 1 ? 'single-site' : '5-sites',
            'status' => 'active',
            'activation_limit' => $limit,
            'activations' => array_map(static fn (string $domain): array => ['domain' => $domain, 'is_counted' => true], $domains),
            'expires_at' => '2027-03-03T00:00:00+00:00',
        ];
    }
}

<?php

namespace WConvert\Tests\Unit\Pro\License;

use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Container\PremiumServiceProvider;
use WConvert\Pro\License\SdkConfig;

/**
 * Answer the SDK's calls to the store in-process, and record them.
 *
 * Ported from WP Statistics' `FakesNexusTrait`. Hooks `pre_http_request` for
 * `/api/v1/license/*`, so a test stores a real licence through the SDK's own
 * `activate()` — key encrypted, data mapped exactly as in production — instead
 * of hand-writing the option row. Every licence request is recorded in
 * `$nexusCalls` as [path, body]. Nothing else is answered.
 *
 * Set `$nexusLicense` before activating to shape what the store answers,
 * `$nexusDown` to answer every call with a transport failure, and
 * `$nexusReplies` to replay an answer the real store gave.
 */
trait FakesNexus
{
    /** @var list<array{0: string, 1: array<string, mixed>}> */
    protected array $nexusCalls = [];

    /** @var array<string, mixed> Merged into the licence the store returns. */
    protected array $nexusLicense = [];

    protected bool $nexusDown = false;

    /** @var array{code: string, status: int}|null The store refuses licence calls with this. */
    protected ?array $nexusRefusal = null;

    /**
     * Answers the store really gave, replayed verbatim — `/api/v1/license/activate`
     * => {status, body}. A path named here wins over every other setting.
     *
     * @var array<string, array{status: int, body: array<string, mixed>}>
     */
    protected array $nexusReplies = [];

    /** @var list<array<string, mixed>> The signed-in account's licences, as Nexus formats them. */
    protected array $nexusAccountLicenses = [];

    protected bool $nexusAccountExpired = false;

    /** @var array<string, mixed> */
    private array $filtersBeforeNexus = [];

    /** @var array<string, mixed> */
    private array $optionsBeforeNexus = [];

    /** @var array<string, mixed> */
    private array $siteTransientsBeforeNexus = [];

    protected function fakeNexus(): void
    {
        $this->filtersBeforeNexus = $GLOBALS['wconvertTestFilters'];
        $this->optionsBeforeNexus = $GLOBALS['wconvertTestOptionTable'];
        $this->siteTransientsBeforeNexus = $GLOBALS['wconvertTestSiteTransients'];
        $GLOBALS['wconvertTestTransients'] = [];

        add_filter('pre_http_request', function ($preempt, array $args, string $url) {
            $path = (string) parse_url($url, PHP_URL_PATH);

            if ($preempt !== false || !str_contains($path, '/api/v1/')) {
                return $preempt;
            }

            $body = json_decode((string) ($args['body'] ?? ''), true);
            $this->nexusCalls[] = [$path, is_array($body) ? $body : []];

            if (isset($this->nexusReplies[$path])) {
                return self::reply($this->nexusReplies[$path]['status'], $this->nexusReplies[$path]['body']);
            }

            if ($this->nexusDown) {
                return new \WP_Error('http_request_failed', 'cURL error 28: Operation timed out');
            }

            if (!str_contains($path, '/api/v1/license/')) {
                return $this->answerAccount($path);
            }

            if ($this->nexusRefusal !== null) {
                return self::reply($this->nexusRefusal['status'], ['success' => false, 'error_code' => $this->nexusRefusal['code'], 'message' => 'Refused.']);
            }

            $license = array_merge([
                'status' => 'active',
                'tier_slug' => '5-sites',
                'expires_at' => gmdate('Y-m-d H:i:s', time() + 200 * DAY_IN_SECONDS),
                'max_activations' => 5,
                'activation_count' => 1,
                // A subscription with a card behind it, as most are.
                'renewal' => ['state' => 'active', 'auto_renews' => true, 'is_trial' => false, 'subscription_status' => 'active', 'offer' => null],
            ], $this->nexusLicense);

            return self::reply(200, ['success' => true, 'license' => $license]);
        }, 10, 3);
    }

    /** @return array<string, mixed> */
    private function answerAccount(string $path): array
    {
        if ($this->nexusAccountExpired) {
            return self::reply(401, ['success' => false, 'error_code' => 'token_expired', 'message' => 'Expired.']);
        }

        return match (true) {
            str_ends_with($path, '/auth/exchange-code') => self::reply(200, ['access_token' => 'account-token', 'expires_in' => 86400, 'user' => ['email' => 'sara@example.com', 'name' => 'Sara']]),
            str_ends_with($path, '/account/licenses') => self::reply(200, ['success' => true, 'data' => $this->nexusAccountLicenses]),
            default => self::reply(200, ['success' => true]),
        };
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    private static function reply(int $status, array $body): array
    {
        return [
            'headers' => [],
            'body' => (string) json_encode($body),
            'response' => ['code' => $status, 'message' => ''],
        ];
    }

    /** Sign in to the account through the SDK's own return handler. */
    protected function signInToTheAccount(): void
    {
        $sdk = $this->freshSdk();
        $state = $sdk->accountManager()->getAuthorizeUrl()['state'];
        $sdk->accountManager()->handleOAuthCallback('code', $state, $sdk->licenseManager());
    }

    protected function stopFakingNexus(): void
    {
        $GLOBALS['wconvertTestFilters'] = $this->filtersBeforeNexus;
        $GLOBALS['wconvertTestOptionTable'] = $this->optionsBeforeNexus;
        $GLOBALS['wconvertTestSiteTransients'] = $this->siteTransientsBeforeNexus;
        $GLOBALS['wconvertTestSiteOptions'] = [];
        $GLOBALS['wconvertTestTransients'] = null;
        $GLOBALS['wconvertTestBlogTables'] = [];
        $this->nexusCalls = [];
        $this->nexusLicense = [];
        $this->nexusDown = false;
        $this->nexusRefusal = null;
        $this->nexusReplies = [];
        $this->nexusAccountLicenses = [];
        $this->nexusAccountExpired = false;
    }

    /** A fresh SDK for this site, as `pro/uninstall.php` builds one. */
    protected function freshSdk(): PremiumServiceProvider
    {
        return SdkConfig::sdk();
    }

    /** Store a licence through the SDK's own activate(). */
    protected function activateLicenseHere(string $key = 'WCV-TEST-KEY-0001'): void
    {
        $this->freshSdk()->licenseManager()->activate($key);
    }

    /**
     * The calls made to one store path, e.g. '/api/v1/license/deactivate'.
     *
     * @return list<array<string, mixed>> The request bodies.
     */
    protected function nexusCallsTo(string $path): array
    {
        return array_values(array_map(
            static fn (array $call): array => $call[1],
            array_filter($this->nexusCalls, static fn (array $call): bool => $call[0] === $path)
        ));
    }
}

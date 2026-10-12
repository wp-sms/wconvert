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
 * Set `$nexusLicense` before activating to shape what the store answers, and
 * `$nexusDown` to answer every call with a transport failure.
 */
trait FakesNexus
{
    /** @var list<array{0: string, 1: array<string, mixed>}> */
    protected array $nexusCalls = [];

    /** @var array<string, mixed> Merged into the licence the store returns. */
    protected array $nexusLicense = [];

    protected bool $nexusDown = false;

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

        add_filter('pre_http_request', function ($preempt, array $args, string $url) {
            $path = (string) parse_url($url, PHP_URL_PATH);

            if ($preempt !== false || !str_contains($path, '/api/v1/license/')) {
                return $preempt;
            }

            $body = json_decode((string) ($args['body'] ?? ''), true);
            $this->nexusCalls[] = [$path, is_array($body) ? $body : []];

            if ($this->nexusDown) {
                return new \WP_Error('http_request_failed', 'cURL error 28: Operation timed out');
            }

            $licence = array_merge([
                'status' => 'active',
                'tier_slug' => '5-sites',
                'expires_at' => gmdate('Y-m-d H:i:s', time() + 200 * DAY_IN_SECONDS),
                'max_activations' => 5,
                'activation_count' => 1,
            ], $this->nexusLicense);

            return [
                'headers' => [],
                'body' => (string) json_encode(['success' => true, 'license' => $licence]),
                'response' => ['code' => 200, 'message' => 'OK'],
            ];
        }, 10, 3);
    }

    protected function stopFakingNexus(): void
    {
        $GLOBALS['wconvertTestFilters'] = $this->filtersBeforeNexus;
        $GLOBALS['wconvertTestOptionTable'] = $this->optionsBeforeNexus;
        $GLOBALS['wconvertTestSiteTransients'] = $this->siteTransientsBeforeNexus;
        $this->nexusCalls = [];
        $this->nexusLicense = [];
        $this->nexusDown = false;
    }

    /** A fresh SDK for this site, as `pro/uninstall.php` builds one. */
    protected function freshSdk(): PremiumServiceProvider
    {
        return new PremiumServiceProvider(SdkConfig::build(), plugin_basename(WCONVERT_PRO_MAIN_FILE));
    }

    /** Store a licence through the SDK's own activate(). */
    protected function activateLicenceHere(string $key = 'WCV-TEST-KEY-0001'): void
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

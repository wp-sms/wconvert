<?php

namespace WConvert\Tests\Unit\Pro\License;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Container\ServiceContainer;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Container\PremiumServiceProvider;
use WConvert\Pro\License\LicenseServiceProvider;
use WConvert\Pro\License\SdkConfig;
use WConvert\Pro\License\SignInGuard;

/**
 * =============================================================================
 * THE SDK IS IN, AND IT GATES NO FEATURE.
 * =============================================================================
 * The SDK arrives with a module loader that switches code on by licence. The
 * build is WConvert's gate (ADR 0015), so the loader is unhooked in the same
 * breath the SDK hooks it — asserted here, because the failure is silent: a
 * loader with no modules path does nothing today and something the day a
 * directory appears where it looks.
 */
#[CoversClass(LicenseServiceProvider::class)]
#[CoversClass(SdkConfig::class)]
#[CoversClass(SignInGuard::class)]
final class LicenseServiceProviderTest extends TestCase
{
    /** @var array<string, mixed> */
    private array $actions;

    /** @var array<string, mixed> */
    private array $filters;

    /** @var list<string> */
    private array $capabilities;

    protected function setUp(): void
    {
        $this->actions = $GLOBALS['wconvertTestActions'];
        $this->filters = $GLOBALS['wconvertTestFilters'];
        $this->capabilities = $GLOBALS['wconvertTestCapabilities'];
        $GLOBALS['wconvertTestActions'] = [];
        $GLOBALS['wconvertTestFilters'] = [];
    }

    protected function tearDown(): void
    {
        $GLOBALS['wconvertTestActions'] = $this->actions;
        $GLOBALS['wconvertTestFilters'] = $this->filters;
        $GLOBALS['wconvertTestCapabilities'] = $this->capabilities;
        unset($_GET['wps_oauth_code'], $_GET['wcv_oauth_state'], $_REQUEST['wps_oauth_code'], $_REQUEST['wcv_oauth_state']);
    }

    public function testTheSdkIsScopedIntoProsOwnNamespace(): void
    {
        $this->assertTrue(
            class_exists(PremiumServiceProvider::class),
            'the prefixed SDK is not on Pro\'s autoloader — run `composer install` in pro/'
        );
        $this->assertFalse(
            class_exists('VeronaLabs\\WpPremiumSdk\\Container\\PremiumServiceProvider', false),
            'an unprefixed SDK is loaded, so another plugin\'s copy could answer for ours'
        );
    }

    public function testBootingHooksTheUpdaterAndUnhooksTheModuleLoaderAndTheSdksAjax(): void
    {
        $sdk = $this->boot();

        foreach (['license', 'account', 'network_license'] as $action) {
            $this->assertEmpty(
                $GLOBALS['wconvertTestActions']['wp_ajax_wconvert_pro_' . $action] ?? [],
                sprintf('the SDK\'s "%s" admin-ajax endpoint is still hooked — a door beside the REST routes', $action)
            );
        }

        $this->assertNotEmpty($GLOBALS['wconvertTestFilters']['pre_set_site_transient_update_plugins'] ?? [], 'the updater is not hooked');

        foreach ($GLOBALS['wconvertTestActions']['init'] ?? [] as $registered) {
            $this->assertNotEquals(
                [$sdk->moduleLoader(), 'loadLicensedModules'],
                $registered['callback'],
                'the SDK\'s module loader is still hooked — a licence would be switching code on'
            );
        }
    }

    public function testTheSignInReturnIsDroppedForSomebodyWhoCannotManageTheLicence(): void
    {
        $this->boot();
        $GLOBALS['wconvertTestCapabilities'] = [];
        $_GET['wps_oauth_code'] = $_REQUEST['wps_oauth_code'] = 'x';
        $_GET['wcv_oauth_state'] = $_REQUEST['wcv_oauth_state'] = 'y';

        $this->runGuardOnly();

        $this->assertArrayNotHasKey('wps_oauth_code', $_GET);
        $this->assertArrayNotHasKey('wcv_oauth_state', $_GET);
        $this->assertArrayNotHasKey('wps_oauth_code', $_REQUEST);
    }

    public function testAnAdministratorsSignInReturnIsLeftForTheSdk(): void
    {
        $this->boot();
        $GLOBALS['wconvertTestCapabilities'] = ['manage_options'];
        $_GET['wps_oauth_code'] = 'x';
        $_GET['wcv_oauth_state'] = 'y';

        $this->runGuardOnly();

        $this->assertSame('x', $_GET['wps_oauth_code']);
        $this->assertSame('y', $_GET['wcv_oauth_state']);
    }

    public function testTheConfigurationNamesTheStoreAndLeavesTheSdksInstalledTierUnset(): void
    {
        $config = SdkConfig::build();

        $this->assertSame('wconvert', $config->productSlug());
        $this->assertSame('wconvert_pro_license', $config->optionKey());
        $this->assertSame('https://my.wconvert.io', $config->apiBaseUrl());
        $this->assertSame(['code' => 'wps_oauth_code', 'state' => 'wcv_oauth_state'], $config->oauthCallbackParams());
        $this->assertSame('WCONVERT_LICENSE_KEY', $config->licenseKeyConstant());
        // Plans are not tiers: an installed tier would make the SDK offer a
        // "different build" for every plan slug Nexus answers with.
        $this->assertSame('', $config->installedTier());
    }

    private function boot(): PremiumServiceProvider
    {
        $container = (new \ReflectionClass(ServiceContainer::class))->newInstanceWithoutConstructor();
        $provider = new LicenseServiceProvider();
        $provider->register($container);
        $provider->boot($container);

        /** @var PremiumServiceProvider */
        return $container->get(PremiumServiceProvider::class);
    }

    /** Run the guard's own admin_init callback — the SDK's would need a database. */
    private function runGuardOnly(): void
    {
        foreach ($GLOBALS['wconvertTestActions']['admin_init'] ?? [] as $registered) {
            $callback = $registered['callback'];

            if (is_array($callback) && $callback[0] instanceof SignInGuard) {
                $this->assertSame(9, $registered['priority'], 'the guard must run before the SDK\'s handler at 10');
                $callback[0]->ignoreReturnFromOthers();

                return;
            }
        }

        $this->fail('the sign-in guard is not hooked on admin_init');
    }
}

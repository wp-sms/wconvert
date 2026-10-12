<?php

namespace WConvert\Pro\License;

use WConvert\Container\ServiceContainer;
use WConvert\Container\ServiceProvider;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Container\PremiumServiceProvider;

defined('ABSPATH') || exit;

/**
 * The licence: updates and support, and nothing else (ADR 0015, ADR 0143).
 *
 * Everything licence-shaped in either plugin lives under `pro/src/License/`,
 * and `NoLicenceOnTheFrontEndTest` holds it there. Nothing in here is asked
 * whether a feature may run — the build is that answer — so the SDK's module
 * loader, which would gate code on the licence, is unhooked the moment the SDK
 * hooks it.
 *
 * @since 0.1.0
 */
final class LicenseServiceProvider implements ServiceProvider
{
    public function register(ServiceContainer $container): void
    {
        $container->register(
            PremiumServiceProvider::class,
            static fn (): PremiumServiceProvider => new PremiumServiceProvider(
                SdkConfig::build(),
                plugin_basename(WCONVERT_PRO_MAIN_FILE)
            )
        );
    }

    public function boot(ServiceContainer $container): void
    {
        /** @var PremiumServiceProvider $sdk */
        $sdk = $container->get(PremiumServiceProvider::class);

        // The updater filter, the account sign-in return, the constant-key
        // activation on admin_init, and the SDK's own admin-ajax endpoints.
        // Building it reads nothing: no option, no request, no translation.
        $sdk->register();

        // The build is the gate. A premium module is present because it shipped
        // in this ZIP, and the licence never switches one on or off.
        remove_action('init', [$sdk->moduleLoader(), 'loadLicensedModules'], 20);

        (new SignInGuard(array_values($sdk->config()->oauthCallbackParams())))->hooks();
    }
}

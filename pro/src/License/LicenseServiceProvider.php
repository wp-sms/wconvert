<?php

namespace WConvert\Pro\License;

use WConvert\Container\ServiceContainer;
use WConvert\Container\ServiceProvider;
use WConvert\Storage\TransientStore;
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
    /** The SDK's three admin-ajax endpoints, by the names it registers them under. */
    private const SDK_AJAX_ACTIONS = ['license', 'account', 'network_license'];

    public function register(ServiceContainer $container): void
    {
        $container->register(
            LicenseController::class,
            static fn (ServiceContainer $c): LicenseController => new LicenseController(
                $c->resolve(PremiumServiceProvider::class),
                $c->resolve(TransientStore::class)
            )
        );

        $container->register(
            PremiumServiceProvider::class,
            static fn (): PremiumServiceProvider => SdkConfig::sdk()
        );
    }

    public function boot(ServiceContainer $container): void
    {
        /** @var PremiumServiceProvider $sdk */
        $sdk = $container->get(PremiumServiceProvider::class);

        // The updater filter, the account sign-in return and the constant-key
        // activation on admin_init. Building it reads nothing: no option, no
        // request, no translation.
        $sdk->register();

        // The build is the gate. A premium module is present because it shipped
        // in this ZIP, and the licence never switches one on or off.
        remove_action('init', [$sdk->moduleLoader(), 'loadLicensedModules'], 20);

        // And the SDK's admin-ajax endpoints go too. The License page talks to
        // `wconvert/v1/license`, which holds the managed-key refusals and keeps
        // raw keys server-side (ADR 0143); a second door beside it would hold
        // neither.
        foreach (self::SDK_AJAX_ACTIONS as $action) {
            remove_all_actions('wp_ajax_' . $sdk->config()->ajaxAction() . '_' . $action);
        }

        (new SignInGuard(array_values($sdk->config()->oauthCallbackParams())))->hooks();
        (new UpdateGate($sdk, plugin_basename(WCONVERT_PRO_MAIN_FILE)))->hooks();
        (new RefreshCron($sdk->licenseManager(), $sdk->store()))->hooks();

        // On `rest_api_init`, which fires on requests WordPress does not
        // consider wp-admin — the same reason Pro's other routes register there.
        add_action('rest_api_init', static function () use ($container): void {
            $container->resolve(LicenseController::class)->registerRoutes();
        });
    }
}

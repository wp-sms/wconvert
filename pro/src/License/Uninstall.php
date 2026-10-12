<?php

namespace WConvert\Pro\License;

use Throwable;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Container\PremiumServiceProvider;

defined('ABSPATH') || exit;

/**
 * Deleting Pro frees this site's seat and removes what the SDK stored.
 *
 * Run from `pro/uninstall.php`, where the plugin is not loaded: only Pro's
 * constants and autoloader are, so the SDK is built here from `SdkConfig`
 * rather than resolved from a container that does not exist.
 *
 * Releasing is best-effort — the SDK waits at most 5 seconds and never throws
 * — so a slow or unreachable store cannot hold up the delete. The SDK then
 * removes its option, its fallback cipher key and its manifest transients, each
 * by its exact name. A port of WP Statistics' `LicenseUninstaller` without the
 * network loop: Pro refuses network activation (ADR 0143), so the site being
 * uninstalled is the only one that holds a seat for this install.
 *
 * Deactivating keeps the licence. Only deleting lets the seat go.
 *
 * @since 0.1.0
 */
final class Uninstall
{
    /**
     * @param (callable(): PremiumServiceProvider)|null $sdk Builds the SDK; a
     *        test passes its own.
     * @return array{removed_remotely: bool, error_code: string|null}
     */
    public static function run(?callable $sdk = null): array
    {
        RefreshCron::unschedule();

        try {
            $provider = $sdk !== null
                ? $sdk()
                : new PremiumServiceProvider(SdkConfig::build(), plugin_basename(WCONVERT_PRO_MAIN_FILE));

            return $provider->uninstall(true);
        } catch (Throwable $e) {
            // Building the SDK failed (a broken autoloader, missing sodium).
            // The rest of Pro's uninstall still runs, and the option goes with
            // it, so a reinstall does not inherit a licence it cannot release.
            delete_option(SdkConfig::OPTION_KEY);

            return ['removed_remotely' => false, 'error_code' => 'unknown'];
        }
    }
}

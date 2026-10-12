<?php

namespace WConvert\Pro\License;

use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Config\ClientConfig;

defined('ABSPATH') || exit;

/**
 * The one place the SDK's configuration is built.
 *
 * Two callers, which is why it is a class of its own: the live provider, and
 * `pro/uninstall.php`, which runs with the plugin not loaded and only
 * `src/constants.php` behind it. Every constant read here past those is
 * therefore guarded with `defined()`.
 *
 * Copied from WP Statistics' `SdkConfig`, less one key. There is **no
 * `installed_tier`**: Nexus's tiers for WConvert are plans — `single-site`,
 * `5-sites`, `unlimited` — and not the rungs of `tiers.json`, so the SDK's
 * tier-mismatch offer must stay inert. A plan changes how many sites a licence
 * covers, never which build is installed (ADR 0143).
 *
 * @since 0.1.0
 */
final class SdkConfig
{
    /**
     * The SDK's own option: non-autoloaded, and the only licence storage there
     * is. Named OPTION_KEY rather than OPTION so `UninstallTest`, which claims
     * every `OPTION` constant for free's uninstaller, does not take it.
     */
    public const OPTION_KEY = 'wconvert_pro_license';

    /** The wp-config constant that hands the licence to an agency (managed mode). */
    public const KEY_CONSTANT = 'WCONVERT_LICENSE_KEY';

    /** Who manages a constant-held licence: 'Acme Studio <help@acme.studio>'. */
    public const CONTACT_CONSTANT = 'WCONVERT_LICENSE_CONTACT';

    public const DEFAULT_STORE = 'https://my.wconvert.io';

    /** The store's product slug; the catalog item is `wconvert-pro`. */
    public const PRODUCT_SLUG = 'wconvert';

    public static function build(): ClientConfig
    {
        return new ClientConfig([
            'product_slug' => self::PRODUCT_SLUG,
            'option_key' => self::OPTION_KEY,
            'oauth_state_prefix' => 'wconvert_pro_oauth_',
            // Nexus answers every product's sign-in with `wps_oauth_code`; the
            // state parameter is the one we name.
            'oauth_callback_params' => [
                'code' => 'wps_oauth_code',
                'state' => 'wcv_oauth_state',
            ],
            'api_base_url' => self::storeUrl(),
            'text_domain' => 'wconvert-pro',
            'current_version' => defined('WCONVERT_PRO_VERSION') ? WCONVERT_PRO_VERSION : '0.0.0',
            'ajax_action' => 'wconvert_pro',
            'license_key_constant' => self::KEY_CONSTANT,
        ]);
    }

    /** The store, overridable for a staging Nexus. */
    public static function storeUrl(): string
    {
        $url = defined('WCONVERT_NEXUS_URL') ? (string) constant('WCONVERT_NEXUS_URL') : '';

        return rtrim($url !== '' ? $url : self::DEFAULT_STORE, '/');
    }
}

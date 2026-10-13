<?php

namespace WConvert\Admin;

use WConvert\Support\ProPresence;
use WConvert\Support\Tier;

defined('ABSPATH') || exit;

/**
 * Whether free names what Pro adds where it is wanted (ADR 0147).
 *
 * Two facts for the admin bundle, decided here rather than recombined in
 * TypeScript:
 *
 * - **`shown()`**: the contextual hints appear on a free install, for someone
 *   who could install Pro, unless a developer turned them off. A Pro install
 *   has nothing left to name (ADR 0146); a site admin on a multisite, or a
 *   client given `manage_options`, could not act on one.
 * - **`proInstalledInactive()`**: Pro's plugin is on disk but not running, so
 *   a hint and the header say "Activate it" and lead to the Plugins screen
 *   rather than to the sales page.
 *
 * The header link and the Settings list are not hints and are not gated here.
 */
final class ProHints
{
    /** Developer-only: return false for agencies and white-label builds. */
    public const FILTER = 'wconvert_show_pro_hints';

    /** Where an installed WordPress keeps Pro's main file. */
    public const PRO_PLUGIN = 'wconvert-pro/wconvert-pro.php';

    public static function shown(ProPresence $pro): bool
    {
        return $pro->installedTier() === Tier::Free
            && current_user_can('install_plugins')
            // Spelled out rather than self::FILTER, so Plugin Check can see the prefix.
            && (bool) apply_filters('wconvert_show_pro_hints', true);
    }

    /**
     * @param array<string, mixed>|null $plugins `get_plugins()`, passed by tests.
     */
    public static function proInstalledInactive(ProPresence $pro, ?array $plugins = null): bool
    {
        if ($pro->installedTier() !== Tier::Free || !current_user_can('activate_plugins')) {
            return false;
        }

        if ($plugins === null) {
            if (!function_exists('get_plugins')) {
                $file = ABSPATH . 'wp-admin/includes/plugin.php';

                if (!is_file($file)) {
                    return false;
                }

                require_once $file;
            }

            $plugins = get_plugins();
        }

        // Free is running without Pro's constant, so a Pro file here is one WordPress has not loaded.
        return isset($plugins[self::PRO_PLUGIN]);
    }
}

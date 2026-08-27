<?php

namespace WConvert\Assets;

use WConvert\Admin\AdminNotices;

defined('ABSPATH') || exit;

/**
 * Enqueues the Vite-built admin bundle.
 *
 * @since 0.1.0
 */
final class ViteHelper
{
    private const ADMIN_DIST = 'public/admin/';

    public static function enqueueAdmin(string $handle): void
    {
        $distDir = WCONVERT_DIR . self::ADMIN_DIST;
        $distUrl = WCONVERT_URL . self::ADMIN_DIST;

        // A missing main.js is an incomplete build, and the screen would render
        // as a blank <div> with nothing in any log. Say so instead.
        if (!is_file($distDir . 'main.js')) {
            self::noticeMissingAdminBundle();

            return;
        }

        // The CSS is optional: an admin screen with no styles is degraded, an
        // admin screen with no script is broken, so only the script is fatal.
        if (is_file($distDir . 'main.css')) {
            wp_enqueue_style(
                $handle,
                $distUrl . 'main.css',
                [],
                BuiltAsset::version($distDir . 'main.css')
            );
        }

        wp_enqueue_script(
            $handle,
            $distUrl . 'main.js',
            ['wp-i18n', 'wp-api-fetch'],
            BuiltAsset::version($distDir . 'main.js'),
            true
        );

        wp_set_script_translations($handle, 'wconvert');
    }

    /**
     * **Not `admin_notices`, and that is the point.**
     *
     * This fires on exactly the screen whose `admin_notices` hook
     * {@see AdminNotices::suppress()} empties, so a callback added there would
     * remove itself a moment later and the plugin would lose its only way of
     * saying its admin screen cannot load. {@see AdminNotices} prints it from
     * inside the page instead — the one path that survives the suppression,
     * and the one that does not need the stylesheet whose absence it is
     * reporting.
     */
    private static function noticeMissingAdminBundle(): void
    {
        AdminNotices::add(__(
            'WConvert could not load its admin screen — the built assets are missing. Reinstall the plugin to restore them.',
            'wconvert'
        ));
    }
}

<?php

namespace WConvert\Assets;

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
                self::assetVersion($distDir . 'main.css')
            );
        }

        wp_enqueue_script(
            $handle,
            $distUrl . 'main.js',
            ['wp-i18n', 'wp-api-fetch'],
            self::assetVersion($distDir . 'main.js'),
            true
        );

        wp_set_script_translations($handle, 'wconvert');
    }

    private static function noticeMissingAdminBundle(): void
    {
        add_action('admin_notices', static function (): void {
            echo '<div class="notice notice-error"><p>';
            echo esc_html__(
                'WConvert could not load its admin screen — the built assets are missing. Reinstall the plugin to restore them.',
                'wconvert'
            );
            echo '</p></div>';
        });
    }

    /**
     * Cache-bust on the file's own mtime, so a rebuilt bundle gets a new URL
     * without anyone remembering to bump a version.
     */
    private static function assetVersion(string $path): string
    {
        $mtime = is_file($path) ? filemtime($path) : false;

        return $mtime !== false ? (string) $mtime : WCONVERT_VERSION;
    }
}

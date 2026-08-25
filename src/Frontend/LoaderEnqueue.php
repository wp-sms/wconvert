<?php

namespace WConvert\Frontend;

use WConvert\Assets\BuiltAsset;
use WConvert\Optin\PublishedSet;

defined('ABSPATH') || exit;

/**
 * Puts the loader and its payload on the page — and, far more often, does not.
 *
 * The whole front-end read path is here: read one non-autoloaded option, walk
 * its projections, evaluate the Targeting axis, and print what survived.
 * **No transient, no object-cache entry, no per-URL memo of any kind.** The
 * full-page cache is the cache (ADR 0003); a transient keyed by URL would
 * cache something already cached and add an invalidation surface that will
 * eventually be wrong. `tests/unit/Frontend/NoSecondCacheTest.php` is what
 * keeps that true.
 *
 * @since 0.1.0
 */
final class LoaderEnqueue
{
    public const HANDLE = 'wconvert-loader';

    private const DIST = 'public/loader/loader.js';

    public function __construct(
        private readonly PublishedSet $publishedSet,
    ) {
    }

    public function hooks(): void
    {
        add_action('wp_enqueue_scripts', [$this, 'enqueue']);
    }

    public function enqueue(): void
    {
        // A feed, a robots.txt or an oEmbed response is not a page a visitor
        // is looking at, and printing a script tag into one corrupts it.
        if (is_admin() || is_feed() || is_robots() || is_embed()) {
            return;
        }

        $set = $this->publishedSet->all();

        if ($set === []) {
            return;
        }

        $entries = Payload::forRequest($set, RequestContextFactory::forPublishedSet($set));

        // An Optin that does not match this page costs this page nothing —
        // not a script, not a byte of payload.
        if ($entries === []) {
            return;
        }

        $dist = WCONVERT_DIR . self::DIST;

        if (!BuiltAsset::exists($dist)) {
            self::noticeMissingLoaderBundle();

            return;
        }

        wp_enqueue_script(
            self::HANDLE,
            WCONVERT_URL . self::DIST,
            [],
            BuiltAsset::version($dist),
            true
        );

        // Priority 5 on `wp_head`: after `wp_enqueue_scripts` (which core runs
        // at 1) so this callback is registered in time, and early enough that
        // the payload precedes anything an optimizer aggregates into the head.
        // The loader still must not ASSUME that — Autoptimize's force-in-head
        // moves it above the payload and strips its `defer`, which is why the
        // loader retries after DOMContentLoaded (ADR 0004).
        add_action('wp_head', static function () use ($entries): void {
            // Not escaped, and correctly so: PayloadTag renders JSON with
            // JSON_HEX_TAG, which is the escaping this context needs. Running
            // esc_html() over it would escape the quotes and produce invalid
            // JSON.
            echo PayloadTag::render($entries); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        }, 5);
    }

    private static function noticeMissingLoaderBundle(): void
    {
        add_action('admin_notices', static function (): void {
            echo '<div class="notice notice-error"><p>';
            echo esc_html__(
                'WConvert has published Optins but its loader script is missing, so none of them can display. Reinstall the plugin to restore it.',
                'wconvert'
            );
            echo '</p></div>';
        });
    }
}

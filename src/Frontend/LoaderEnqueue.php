<?php

namespace WConvert\Frontend;

use WConvert\Assets\BuiltAsset;
use WConvert\Optin\PublishedOptin;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\Routes;
use WConvert\Template\PolicyLink;

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

    /**
     * When this runs on `wp_enqueue_scripts`.
     *
     * A named constant because **[[Pro]] replaces this loader by dequeuing it
     * on the same hook, later** (ADR 0014), and "later" has to be a fact the
     * two plugins share rather than two numbers that agree by habit. Pro reads
     * it — `WConvert\Pro\Frontend\ProLoaderEnqueue::PRIORITY` is this plus
     * ten — so the ordering cannot drift, and it does not depend on which
     * plugin file WordPress loaded first.
     */
    public const PRIORITY = 10;

    private const DIST = 'public/loader/loader.js';

    /**
     * @param string $pluginDir Where free is on disk, trailing slash — `WCONVERT_DIR`.
     * @param string $pluginUrl Where free is on the web, trailing slash — `WCONVERT_URL`.
     */
    public function __construct(
        private readonly PublishedSet $publishedSet,
        private readonly string $pluginDir,
        private readonly string $pluginUrl,
    ) {
    }

    public function hooks(): void
    {
        add_action('wp_enqueue_scripts', [$this, 'enqueue'], self::PRIORITY);
    }

    public function enqueue(): void
    {
        // A feed, a robots.txt or an oEmbed response is not a page a visitor
        // is looking at, and printing a script tag into one corrupts it.
        if (is_admin() || is_feed() || is_robots() || is_embed()) {
            return;
        }

        // Parsed once, here, and passed as objects from this point on. The set
        // is stored as plain arrays because that is what an option is; letting
        // those arrays travel further means every reader downstream spells a
        // rule type as a string literal (ADR 0005).
        $set = PublishedOptin::fromSet($this->publishedSet->all());

        if ($set === []) {
            return;
        }

        $entries = Payload::forRequest($set, RequestContextFactory::forPublishedSet($set));

        // An Optin that does not match this page costs this page nothing —
        // not a script, not a byte of payload.
        if ($entries === []) {
            return;
        }

        // **The renderer owns the privacy-policy link, and this is render
        // time** (ADR 0032). It is resolved here rather than baked into the
        // published set so that moving the policy page corrects every running
        // Optin without republishing one, and it is safe under the full-page
        // cache because `get_privacy_policy_url()` is a site-wide setting
        // identical for every visitor.
        $policy = get_privacy_policy_url();
        $entries = array_map(static fn (array $entry): array => PolicyLink::into($entry, $policy), $entries);

        $dist = $this->pluginDir . self::DIST;

        if (!is_file($dist)) {
            self::noticeMissingLoaderBundle();

            return;
        }

        wp_enqueue_script(
            self::HANDLE,
            $this->pluginUrl . self::DIST,
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
        $captureUrl = rest_url(Routes::NAMESPACE . '/capture');
        $beaconUrl = rest_url(Routes::NAMESPACE . '/beacon');

        add_action('wp_head', static function () use ($entries, $captureUrl, $beaconUrl): void {
            // Not escaped, and correctly so: PayloadTag renders JSON with
            // JSON_HEX_TAG, which is the escaping this context needs. Running
            // esc_html() over it would escape the quotes and produce invalid
            // JSON. It escapes the two route URLs itself, where the context
            // is an attribute and esc_url is what that needs.
            echo PayloadTag::render($entries, $captureUrl, $beaconUrl);
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

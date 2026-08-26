<?php

namespace WConvert\Pro\Frontend;

use WConvert\Assets\BuiltAsset;
use WConvert\Frontend\LoaderEnqueue;

defined('ABSPATH') || exit;

/**
 * =============================================================================
 * PRO REPLACES THE LOADER RATHER THAN AUGMENTING IT (ADR 0014).
 * =============================================================================
 * Pro ships a COMPLETE replacement front-end loader — free's modules plus its
 * own, composed in Pro's entry file where the bundler can see it (ADR 0028) —
 * and dequeues free's. There is no registration seam, no second script, and
 * **never two loaders on one page**.
 *
 * WHY REPLACEMENT AND NOT A SMALL ENTITLED ADD-ON. The byte case for an add-on
 * is void: the whole premium rule vocabulary measured ~300 bytes gzipped, so
 * an augment scheme spends an extra HTTP request on every premium install to
 * save 300 bytes on none of them. The deciding argument is ADR 0004. An
 * augment scheme needs the second script to REGISTER BEFORE THE FIRST
 * EVALUATES, and that is exactly the failure the loader prototype catalogued:
 * Autoptimize's force-in-head moved the loader above its payload, stripped its
 * `defer`, and killed every popup silently, with nothing in any log. A
 * registration ordering contract is a promise the page is not ours to keep.
 *
 * **The dequeue below runs in PHP, before one byte of HTML exists**, so the
 * optimizer never sees two scripts to reorder. Replacement is therefore
 * strictly safer than augmentation under the exact hazard 0004 documents — the
 * inverse of the intuition that fewer bytes and fewer copies is the safer
 * shape.
 *
 * THERE IS NO ENTITLEMENT CHECK HERE, and there is nothing missing. Being
 * loaded IS the entitlement: this class is in Pro's ZIP and a free install has
 * never contained it, so the question "may this site have exit intent" has
 * already been answered by the file system (ADR 0015). Nothing on this path
 * reads a licence, and `tests/unit/Contract/NoLicenceOnTheFrontEndTest.php` is
 * what keeps that true.
 *
 * @since 0.1.0
 */
final class ProLoaderEnqueue
{
    public const HANDLE = 'wconvert-pro-loader';

    /**
     * After free's, on the same hook.
     *
     * Derived from free's own constant rather than written as a number, so
     * "later" is a fact the two plugins share. It must not depend on load
     * order: WordPress loads active plugins in the order its own option lists
     * them, so a swap that worked because `wconvert-pro` happened to be read
     * after `wconvert` would work by accident.
     */
    public const PRIORITY = LoaderEnqueue::PRIORITY + 10;

    /**
     * Pro's own bundle path, spelled again rather than borrowed from free.
     *
     * That the two read identically is a coincidence of two Vite configs, not
     * a shared fact: each plugin's build decides where its own artifact lands,
     * and they release on independent tags (ADR 0030). Reaching for free's
     * constant would make Pro's asset path change when free moved its build
     * output — a plugin breaking because a *different* plugin was refactored.
     */
    private const DIST = 'public/loader/loader.js';

    /**
     * @param string $pluginDir Where Pro is on disk, trailing slash — `WCONVERT_PRO_DIR`.
     * @param string $pluginUrl Where Pro is on the web, trailing slash — `WCONVERT_PRO_URL`.
     */
    public function __construct(
        private readonly string $pluginDir,
        private readonly string $pluginUrl,
    ) {
    }

    public function hooks(): void
    {
        add_action('wp_enqueue_scripts', [$this, 'replace'], self::PRIORITY);
    }

    /**
     * Swap free's loader for Pro's, on the pages that carry one.
     */
    public function replace(): void
    {
        // Free decides WHETHER a page carries a loader at all, and it is not
        // Pro's decision to revisit: free reads the published set, evaluates
        // the Targeting axis and enqueues nothing on a page no Optin matched
        // (ADR 0003). Pro decides WHICH loader. Enqueuing unconditionally
        // would put a script on every page on the site.
        if (!wp_script_is(LoaderEnqueue::HANDLE, 'enqueued')) {
            return;
        }

        $dist = $this->pluginDir . self::DIST;

        // A BROKEN PRO DEGRADES TO FREE, NEVER TO NOTHING. An incomplete
        // build — a ZIP that unpacked badly, a partial upload — must not take
        // the site's popups down with it, and dequeuing free's loader while
        // pointing at a bundle that is not there would 404 on every page and
        // leave every Optin dead. So the dequeue is conditional on the
        // replacement existing.
        if (!is_file($dist)) {
            self::noticeMissingLoaderBundle();

            return;
        }

        wp_dequeue_script(LoaderEnqueue::HANDLE);
        // And DEREGISTERED, which is the difference between one loader and
        // two: a dequeued script is out of the queue but still registered, and
        // WordPress prints the registered dependencies of anything that is
        // queued. One third-party script declaring `wconvert-loader` as a
        // dependency would put free's loader back on a page that already has
        // Pro's. Free's handle is not a documented extension point and nothing
        // in either plugin depends on it (ADR 0014).
        wp_deregister_script(LoaderEnqueue::HANDLE);

        wp_enqueue_script(
            self::HANDLE,
            $this->pluginUrl . self::DIST,
            [],
            BuiltAsset::version($dist),
            true
        );
    }

    /**
     * A Pro that quietly does nothing is indistinguishable from a Pro that is
     * working, so the merchant reads the missing premium features as a bug in
     * the product rather than as something they can fix — the same reasoning
     * as {@see \WConvert\Pro\Boot\BootGuard::noticeRefusal()}, and the same
     * shape as free's own missing-bundle notice.
     */
    private static function noticeMissingLoaderBundle(): void
    {
        add_action('admin_notices', static function (): void {
            echo '<div class="notice notice-error"><p>';
            echo esc_html__(
                'WConvert Pro could not load its front-end script, so its premium Triggers are not running. WConvert is still displaying your Optins. Reinstall WConvert Pro to restore them.',
                'wconvert-pro'
            );
            echo '</p></div>';
        });
    }
}

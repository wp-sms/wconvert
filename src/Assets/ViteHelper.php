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

    /**
     * The two built scripts, as they are named on disk.
     *
     * ========================================================================
     * BOTH ARE HASHED, AND NEITHER IS ENQUEUED WITH A VERSION QUERY.
     * ========================================================================
     * `main-*.js` is the entry the screen loads; `builder-*.js` is the chunk it
     * `import()`s when a merchant opens the builder (#73). The hashes are
     * `vite.config.admin.mjs`'s `entryFileNames` and `chunkFileNames`, and they
     * are not only about caching.
     *
     * **The chunk imports the entry by a relative path, `./main-<hash>.js`.**
     * If this enqueued the entry as `main.js?ver=<mtime>` — which is what
     * {@see BuiltAsset} does for the stylesheet and what this did before the
     * split — the browser would hold TWO modules for one file, because a query
     * string makes a different URL and a different module record. The second
     * one carries its own React, and the builder's first `useState` throws
     * *"Invalid hook call"* against a copy of React that never rendered it. The
     * screen goes blank, and no test anywhere catches it.
     *
     * So there is one URL for the entry, it carries no query, and its name is
     * what busts its cache. The stylesheet keeps its `?ver`: a stylesheet has
     * no module identity and nothing imports it.
     */
    private const ENTRY = 'main-*.js';

    private const BUILDER_CHUNK = 'builder-*.js';

    /**
     * @param AdminNotices $notices where a broken build is reported, since
     *                              `admin_notices` is emptied on this screen.
     */
    public static function enqueueAdmin(string $handle, AdminNotices $notices): void
    {
        $distDir = WCONVERT_DIR . self::ADMIN_DIST;
        $distUrl = WCONVERT_URL . self::ADMIN_DIST;

        $entry = self::built($distDir, self::ENTRY);

        // An incomplete build renders as a blank <div> with nothing in any log.
        // Say so instead. **Both files, since #73 split the bundle in two**: the
        // entry alone booting is not the screen working, because the builder
        // lives in a chunk the entry fetches at the moment a merchant opens it
        // — which is the one moment nobody is reading a build log.
        if ($entry === null || self::built($distDir, self::BUILDER_CHUNK) === null) {
            self::noticeMissingAdminBundle($notices);

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

        // ====================================================================
        // `null`, WHICH IS THE ONLY VALUE THAT ADDS NO QUERY AT ALL.
        // ====================================================================
        // The constant above says why no query: a `?ver` gives the browser a
        // second module for the very file the builder chunk imports, and a
        // second React with it.
        //
        // **`false` does not do that**, however much it reads like it should.
        // `WP_Scripts::get_normalized_src()` tests
        // `empty($obj->ver) && null !== $obj->ver`, so `false` — the parameter's
        // own default — falls through to the SITE's WordPress version and the
        // script is served as `main-<hash>.js?ver=7.1`. Only `null` is the
        // absence of a version rather than a request for the default one, and
        // the difference here is a blank admin screen.
        wp_enqueue_script(
            $handle,
            $distUrl . $entry,
            ['wp-i18n', 'wp-api-fetch'],
            null,
            true
        );

        self::serveAsModule($handle);

        wp_set_script_translations($handle, 'wconvert');
    }

    /**
     * A built file's name, or null where the build produced none.
     *
     * `glob()` returns false on failure and an empty array on no match, and the
     * two mean different things to nobody here — a directory that cannot be
     * searched and a directory with nothing in it are both a build this cannot
     * vouch for. Which is the point: the check fails closed, exactly as the
     * `is_file()` test it replaced always did.
     *
     * The basename rather than the path, because the caller needs it as a URL.
     */
    private static function built(string $distDir, string $pattern): ?string
    {
        $matches = glob($distDir . $pattern);

        return is_array($matches) && $matches !== [] ? basename($matches[0]) : null;
    }

    /**
     * Serve the admin bundle as an ES module.
     *
     * ========================================================================
     * THE SPLIT IS WHY, AND `script_loader_tag` IS THE ONLY PORTABLE WHERE.
     * ========================================================================
     * The bundle was an IIFE until #73, and an IIFE cannot code-split — there
     * is nowhere in one for a second chunk to go, so Vite silently flattens any
     * `import()` back into the entry. Splitting the builder out therefore meant
     * an ES build (ADR 0038), and an ES build is inert in a classic
     * `<script src>`: the browser parses it as a script, hits `export`, and
     * throws a syntax error before a line of it runs.
     *
     * WordPress has no API for this at the version this plugin supports.
     * `wp_enqueue_script_module()` is 6.5 and would not help anyway — the
     * `wp-i18n` and `wp-api-fetch` this depends on are classic scripts, not
     * script modules, and a module cannot declare a dependency on one.
     * `wp_script_add_data()` carries a `strategy` since 6.3 and no type at all.
     * The plugin's floor is **6.2**, so the tag is filtered, which every version
     * since 3.0 supports.
     *
     * The existing `type` is stripped rather than left beside the new one:
     * WordPress writes `type='text/javascript'` on any theme that does not
     * declare HTML5 script support, and two `type` attributes on one tag is the
     * first one winning and the module never loading.
     *
     * **A module is deferred, and that is what the enqueue already wanted.** It
     * is registered with `$in_footer` true, so nothing here changes about when
     * it runs relative to the page — and `wp_add_inline_script(…, 'before')`,
     * which is how {@see AdminMenu} hands over the screen's settings, still runs
     * first because a classic inline script executes where it is written.
     */
    private static function serveAsModule(string $handle): void
    {
        add_filter(
            'script_loader_tag',
            static function (string $tag, string $forHandle) use ($handle): string {
                if ($forHandle !== $handle) {
                    return $tag;
                }

                $stripped = preg_replace('/\stype=([\'"]).*?\1/', '', $tag);

                return str_replace('<script ', '<script type="module" ', $stripped ?? $tag);
            },
            10,
            2
        );
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
    private static function noticeMissingAdminBundle(AdminNotices $notices): void
    {
        $notices->add(__(
            'WConvert could not load its admin screen — the built assets are missing. Reinstall the plugin to restore them.',
            'wconvert'
        ));
    }
}

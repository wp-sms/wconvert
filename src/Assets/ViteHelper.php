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

    /** Free's own text domain — the catalogue `wp_set_script_translations` loads. */
    private const TEXT_DOMAIN = 'wconvert';

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
        self::enqueueAdminFrom(
            $handle,
            WCONVERT_DIR . self::ADMIN_DIST,
            WCONVERT_URL . self::ADMIN_DIST,
            self::TEXT_DOMAIN,
            $notices
        );
    }

    /**
     * The same bundle, from whichever plugin directory built it.
     *
     * ========================================================================
     * TWO CALLERS, ONE MACHINE, AND THE SECOND IS PRO'S REPLACEMENT.
     * ========================================================================
     * [[Pro]] ships a COMPLETE replacement admin bundle — free's screens plus
     * its own, composed in Pro's entry where the bundler can see them — and
     * dequeues free's (ADR 0014, extended to the admin). It is the same
     * artifact built from a different entry into a different plugin, so it
     * needs everything this file knows and none of it copied: the hashed entry
     * that must carry no `?ver`, the builder chunk whose absence is a blank
     * screen on the fifth click, the `type="module"` filter, the fail-closed
     * glob.
     *
     * Pro passes its OWN directory and URL rather than borrowing free's
     * constants — the same reasoning `ProLoaderEnqueue::DIST` carries: the two
     * paths read alike by a coincidence of two Vite configs, not by contract,
     * and reaching for free's would make Pro's asset path change when free
     * moved its build output.
     *
     * @param string $textDomain The catalogue `wp_set_script_translations()`
     *                           loads. One domain per handle is all WordPress
     *                           allows, which is why Pro's own strings arrive
     *                           through {@see self::inlineTranslations()}.
     * @param AdminNotices|null $notices Where a broken build is reported, or
     *                           null where the caller reports it itself.
     * @return bool Whether a usable build was found and enqueued.
     */
    public static function enqueueAdminFrom(
        string $handle,
        string $distDir,
        string $distUrl,
        string $textDomain,
        ?AdminNotices $notices
    ): bool {
        $entry = self::built($distDir, self::ENTRY);

        // An incomplete build renders as a blank <div> with nothing in any log.
        // Say so instead. **Both files, since #73 split the bundle in two**: the
        // entry alone booting is not the screen working, because the builder
        // lives in a chunk the entry fetches at the moment a merchant opens it
        // — which is the one moment nobody is reading a build log.
        if ($entry === null || self::built($distDir, self::BUILDER_CHUNK) === null) {
            if ($notices !== null) {
                self::noticeMissingAdminBundle($notices);
            }

            return false;
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

        wp_set_script_translations($handle, $textDomain);

        return true;
    }

    /**
     * A SECOND catalogue on one handle, inlined.
     *
     * ========================================================================
     * WORDPRESS ALLOWS ONE DOMAIN PER HANDLE, AND PRO'S BUNDLE HOLDS TWO.
     * ========================================================================
     * Pro's admin bundle is free's screens plus Pro's, so its strings are
     * free's (`wconvert`) and Pro's (`wconvert-pro`) in one file.
     * `wp_set_script_translations()` binds ONE domain to a handle — call it
     * twice and the second replaces the first — so exactly one of the two can
     * be loaded the ordinary way, and the other has to be handed to `wp.i18n`
     * directly. This does that: it reads the JSON catalogue WordPress would
     * have served and calls `setLocaleData` for the second domain before the
     * bundle runs.
     *
     * It is free's file because the machinery is not premium — it is the same
     * enqueue this class already does — and because free's tree may not name
     * Pro. Free never calls it: free's bundle carries one domain and has no
     * second catalogue to load.
     *
     * `ViteHelper::inlinePremiumTranslations()` in WSMS is the same method, and
     * the difference is worth recording: WSMS needs it because its free and
     * premium React builds share one output path, and WConvert's two live in
     * two plugin directories (ADR 0014). The two-catalogue problem is real
     * here anyway — it is a property of one SCRIPT carrying two domains, not
     * of where that script was written.
     *
     * **Silent where there is nothing to load**, and correctly so: an untranslated
     * locale has no catalogue, which is the normal case rather than a fault.
     *
     * @param string $handle       The registered script the data is attached to.
     * @param string $textDomain   The SECOND domain, the one not bound to the handle.
     * @param string $languagesDir Where that domain's `.json` catalogues live.
     */
    public static function inlineTranslations(string $handle, string $textDomain, string $languagesDir): void
    {
        $json = load_script_textdomain($handle, $textDomain, $languagesDir);

        if (!is_string($json) || $json === '') {
            return;
        }

        $decoded = json_decode($json, true);
        $messages = is_array($decoded) ? ($decoded['locale_data']['messages'] ?? null) : null;

        if (!is_array($messages)) {
            return;
        }

        // The header entry carries the domain the data belongs to, and
        // `setLocaleData` needs it to agree with the second argument — a
        // catalogue announcing a different domain is loaded and never read.
        $messages['']['domain'] = $textDomain;

        wp_add_inline_script(
            $handle,
            'wp.i18n.setLocaleData( ' . wp_json_encode($messages) . ', "' . esc_js($textDomain) . '" );',
            'before'
        );
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
     * first.
     *
     * *The REASON that is true was recorded wrongly and is corrected here. It
     * read "because a classic inline script executes where it is written", and
     * the before-inline is not classic: `WP_Scripts::do_item()` builds the
     * before-tag, the src-tag and the after-tag into ONE string and applies
     * `script_loader_tag` to all of it, so the `str_replace()` below marks the
     * inline tag `type="module"` as well. Verified on a real WordPress —
     * `<script type="module" id="wconvert-admin-js-before">` is what the page
     * actually carries. The settings still run first, because module scripts
     * execute in document order and the inline one is written first; and
     * `window.wconvertAdmin = …` is a property assignment rather than a
     * top-level declaration, so a module's own scope does not swallow it.*
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

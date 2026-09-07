<?php

/**
 * The design-system capture harness, as a mu-plugin.
 *
 * Mounted at wp-content/mu-plugins/ by `build/capture-screens.mjs`. It does
 * four things, and each is here rather than in the capture script because each
 * is a fact about the WordPress side of the wire:
 *
 * 1. **Loads both plugins.** `activate_plugin()` takes effect on the NEXT
 *    request, so a script that activates and carries on runs against a
 *    WordPress that loaded neither (README, *Running a bin/verify-* script*).
 *    mu-plugins load before regular plugins and before `plugins_loaded`, so
 *    WConvert's own hook ordering is untouched.
 * 2. **Installs the schema.** `Installer::install()` runs on
 *    `register_activation_hook`, which a required-in plugin never reaches.
 * 3. **Forces the two states a seed cannot produce** — see FORCING below.
 * 4. **Seeds the site**, behind a URL, so empty and full are one boot.
 *
 * It does NOT log the capture browser in. `auth_redirect()` validates the auth
 * COOKIE directly rather than asking `determine_current_user`, so the filter
 * that would do it is the one thing wp-admin does not consult — and the
 * alternative is redefining a pluggable function, which makes every capture a
 * measurement of a WordPress this harness modified. The script posts the login
 * form once and reuses the storage state instead.
 *
 * ============================================================================
 * FORCING: FAILED IS HERE, LOADING IS NOT.
 * ============================================================================
 * ADR 0060 names four situations and a seed can only produce two of them:
 * empty is an unseeded site and full is a seeded one. The other two are
 * properties of a REQUEST, so they are forced per-request off a cookie the
 * capture script sets.
 *
 * **Failed is forced HERE, and it has to be.** `messageOf()` exists because
 * `apiFetch` rejects with WordPress's REST error body rather than an `Error` —
 * five screens rendered `[object Object]` before it. A 500 synthesised in the
 * browser would be a body this harness invented, so the card would prove the
 * error path against a shape WordPress does not send. `rest_pre_dispatch`
 * returning a `WP_Error` produces the real one.
 *
 * **Loading is NOT forced here, and must not be.** Holding a response open
 * server-side means a PHP worker that never returns, and Playground runs
 * `--workers=1` because its default six all write one SQLite file and corrupt
 * it (README). One held request would deadlock the whole server rather than
 * render a skeleton. So the hold lives in the capture script, as a Playwright
 * route that is never fulfilled — which suspends the fetch at exactly the
 * point a slow server would, without a worker waiting on it.
 */

declare(strict_types=1);

const WCONVERT_DS_SECRET = 'design-system-capture';

/*
 * Both plugins, required rather than activated. Pro is optional: the four
 * reading screens are free's, and a Pro bundle that is not mounted should
 * leave the capture reading exactly what a free install shows.
 */
require_once WP_CONTENT_DIR . '/plugins/wconvert/wconvert.php';

if (file_exists(WP_CONTENT_DIR . '/plugins/wconvert-pro/wconvert-pro.php')) {
    require_once WP_CONTENT_DIR . '/plugins/wconvert-pro/wconvert-pro.php';
}

/**
 * The schema, once per boot.
 *
 * `plugins_loaded` rather than `init`, so the tables are there before anything
 * that reads them runs — including the REST controllers, which register on
 * `rest_api_init` and are dispatched long after but resolve repositories that
 * assume a table.
 */
add_action('plugins_loaded', static function (): void {
    \WConvert\Bootstrap::container()
        ->get(\WConvert\Database\Installer::class)
        ->install();
}, 20);

/**
 * Right-to-left, without a language pack.
 *
 * WordPress decides `<html dir>` from `is_rtl()`, which reads the text
 * direction off the loaded locale — so the honest way to get one is a locale
 * whose pack has to be downloaded. This sets the direction directly instead,
 * because **direction is the whole of what the captures are for**: ADR 0060 §4
 * is about logical properties and mirrored glyphs, and every one of those is
 * driven by `dir`, not by which words are on screen. Keeping the strings in
 * English also keeps the RTL grid readable beside the LTR one — the two cards
 * differ only in the axis under test.
 *
 * It reaches the admin the same way a real locale does: `<html dir="rtl">`,
 * wp-admin's own `-rtl.css` stylesheets, and `useDirection()` reading
 * `getComputedStyle(document.documentElement).direction`.
 */
add_action('setup_theme', static function (): void {
    if (($_COOKIE['wconvert_ds_dir'] ?? '') !== 'rtl') {
        return;
    }

    add_filter('locale', static fn (): string => 'fa_IR');

    add_action('init', static function (): void {
        global $wp_locale;

        if ($wp_locale instanceof \WP_Locale) {
            $wp_locale->text_direction = 'rtl';
        }
    }, 0);
});

/**
 * Failed, forced before any WConvert route runs.
 *
 * Scoped to `wconvert/v1` so wp-admin's own REST traffic is untouched — an
 * admin page whose every request 500s never gets far enough to draw the screen
 * whose failure is being captured.
 */
add_filter('rest_pre_dispatch', static function ($result, $server, $request) {
    if (($_COOKIE['wconvert_ds_state'] ?? '') !== 'failed') {
        return $result;
    }

    if (strpos((string) $request->get_route(), '/wconvert/v1') !== 0) {
        return $result;
    }

    return new \WP_Error(
        'wconvert_ds_failure',
        'The database server is not responding.',
        ['status' => 500]
    );
}, 10, 3);

/**
 * The seed, behind a URL the capture script hits between its two phases.
 *
 * **Empty and full are one server, in order.** They differ in what is in the
 * database rather than in anything about a request, so the alternative is two
 * Playground boots — and a second boot is a second SQLite file, a second
 * install and a minute of wall clock to produce a site that differs from the
 * first only in rows. The script captures every empty card, calls this, and
 * captures every full one.
 */
add_action('init', static function (): void {
    if (($_GET['wconvert_ds_seed'] ?? '') !== WCONVERT_DS_SECRET) {
        return;
    }

    require_once __DIR__ . '/wconvert-ds-seed.php';

    header('Content-Type: text/plain');
    echo wconvert_ds_seed();

    exit;
});

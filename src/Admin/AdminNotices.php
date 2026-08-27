<?php

namespace WConvert\Admin;

use WConvert\Optin\PublishedSet;

defined('ABSPATH') || exit;

/**
 * Empties `admin_notices` on WConvert's screens, and carries the plugin's own
 * notices across the gap that leaves.
 *
 * **The two halves are one class deliberately.** Suppression and survival are
 * a single decision — a reviewer reading one without the other cannot tell
 * whether the plugin still has a way of saying it is broken — and keeping them
 * apart is exactly how a notice comes to silence itself.
 *
 * ADR 0035 is the suppression: everything on `admin.php?page=wconvert` is
 * WConvert's, and a stack of third-party banners above it is the loudest thing
 * on the screen and never the thing the merchant came for. WSMS empties the
 * same three hooks on its own screens, as does WooCommerce on its React pages.
 *
 * **Scoped by hook suffix, and that scope is the safety property.** A plugin
 * that silenced notices site-wide would hide the update nags and the security
 * warnings that are the whole point of them — so this matches the suffix
 * `add_menu_page()` returned, which is the same string
 * {@see AdminMenu::enqueueAssets()} matches to decide where the bundle loads.
 * Nothing is built by hand and nothing is matched by substring.
 *
 * @since 0.1.0
 */
final class AdminNotices
{
    /**
     * The hook suffixes that are WConvert's screens.
     *
     * Registered by {@see AdminMenu::registerMenu()} from what
     * `add_menu_page()` actually returned, rather than spelled here a second
     * time. A screen that fails to register — the current user lacks the
     * capability — registers nothing, so there is no suffix to match and
     * nothing is suppressed.
     *
     * @var array<string, true>
     */
    private static array $screens = [];

    /**
     * Messages the plugin needs a human to read, in the order they were added.
     *
     * @var list<string>
     */
    private static array $messages = [];

    public function __construct(
        private readonly PublishedSet $publishedSet,
    ) {
    }

    public function hooks(): void
    {
        // Every admin page load, because the check is one `is_file()` in the
        // case that is not broken. It runs here rather than on `admin_notices`
        // so the message exists before EITHER render path — the hook below,
        // and {@see renderOwned()} on our own screen, which runs later still.
        add_action('admin_enqueue_scripts', [$this, 'checkLoaderBundle']);

        // `in_admin_header` at PHP_INT_MAX is the last action before
        // `admin_notices` fires, so this removes callbacks every other plugin
        // has already had a chance to add.
        add_action('in_admin_header', [$this, 'suppress'], PHP_INT_MAX);

        add_action('admin_notices', [self::class, 'renderForWordPress']);
    }

    /**
     * Record a message for whichever render path this request reaches.
     *
     * Static because its callers are: {@see \WConvert\Assets\ViteHelper} is a
     * static helper and reports a missing bundle from inside an enqueue, where
     * there is no service to resolve and no container to reach for.
     */
    public static function add(string $message): void
    {
        self::$messages[] = $message;
    }

    /**
     * Declare a hook suffix as one of WConvert's screens.
     */
    public static function owns(string $hookSuffix): void
    {
        if ($hookSuffix === '') {
            return;
        }

        self::$screens[$hookSuffix] = true;
    }

    /**
     * **The loader's missing-bundle notice, moved to where it can fire.**
     *
     * It lives here rather than in {@see \WConvert\Frontend\LoaderEnqueue}
     * because that class runs on `wp_enqueue_scripts` and bails on
     * `is_admin()`, so the `admin_notices` callback it used to register was
     * added on front-end requests only — on which `admin_notices` never runs.
     * The notice could not be seen by anybody, in any circumstance, and the
     * plugin's only way of saying its loader was missing had been dead since
     * it was written.
     *
     * The order of the two checks is the cost control. `is_file()` is a stat
     * against a path the realpath cache already holds, so the healthy install
     * pays that and stops. Reading the published set is a query, and it is
     * only reached once the bundle is already known to be missing — which is
     * also the only time the answer changes what the merchant is told.
     */
    public function checkLoaderBundle(): void
    {
        if (is_file(WCONVERT_DIR . 'public/loader/loader.js')) {
            return;
        }

        // No published Optins is not a broken install: nothing is being
        // displayed, so nothing is failing to display.
        if ($this->publishedSet->all() === []) {
            return;
        }

        self::add(__(
            'WConvert has published Optins but its loader script is missing, so none of them can display. Reinstall the plugin to restore it.',
            'wconvert'
        ));
    }

    /**
     * Empty the notice hooks on WConvert's screens.
     *
     * All three, because `all_admin_notices` and `network_admin_notices` are
     * where a plugin puts a banner it wants shown on every screen — which is
     * the category this exists to keep off ours.
     *
     * This removes {@see renderForWordPress()} along with everything else, and
     * that is intended: on our screen the surviving path is
     * {@see renderOwned()}, and leaving both registered would print the same
     * sentence twice.
     */
    public function suppress(): void
    {
        if (!self::isOurScreen()) {
            return;
        }

        remove_all_actions('admin_notices');
        remove_all_actions('all_admin_notices');
        remove_all_actions('network_admin_notices');
    }

    /**
     * Print the plugin's notices on a screen that is WordPress's.
     *
     * Removed before it runs on a screen that is ours.
     */
    public static function renderForWordPress(): void
    {
        self::render();
    }

    /**
     * Print the plugin's notices inside the page WConvert owns.
     *
     * Called by {@see AdminMenu::renderScreen()}, after the suppression above
     * has run and before React mounts — which is what makes it the path that
     * survives, and the only path that can report a MISSING ADMIN BUNDLE at
     * all. That failure leaves no React to render a message and no stylesheet
     * to style one with.
     *
     * **So it wears WordPress's notice classes, on purpose.** ADR 0035 says
     * this screen renders no wp-admin chrome, and this is the one moment the
     * screen is not WConvert's: the assets that would have made it ours are
     * the thing that is missing. A notice that depends on the stylesheet it is
     * reporting the absence of is a notice nobody reads.
     */
    public static function renderOwned(): void
    {
        self::render();
    }

    private static function render(): void
    {
        foreach (self::$messages as $message) {
            echo '<div class="notice notice-error wconvert-notice"><p>';
            echo esc_html($message);
            echo '</p></div>';
        }
    }

    /**
     * Whether this request is rendering one of WConvert's screens.
     *
     * `$GLOBALS['hook_suffix']` rather than `get_current_screen()`: the suffix
     * is the string `add_menu_page()` returned and `admin_enqueue_scripts` is
     * passed, so matching it compares one fact to itself. A screen id is a
     * second derivation of the same thing and drifts on submenu pages.
     */
    private static function isOurScreen(): bool
    {
        $suffix = $GLOBALS['hook_suffix'] ?? '';

        return is_string($suffix) && isset(self::$screens[$suffix]);
    }
}

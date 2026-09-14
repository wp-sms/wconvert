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
 * The survival half now carries a second message, and it is the one that does
 * not fit the pattern: {@see self::warnAboutNetworkActivation()} speaks on a
 * screen WConvert has no menu entry on at all, because that is the screen
 * where somebody network-activates a plugin that does not support multisite.
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
    private array $screens = [];

    /**
     * Messages the plugin needs a human to read, in the order they were added.
     *
     * @var list<string>
     */
    private array $messages = [];

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

        // Removed again by suppress() on our own screens, where
        // {@see AdminMenu::renderScreen()} calls render() from inside the page
        // instead. Registering both and letting one be removed is what makes
        // the surviving path a consequence of the suppression rather than a
        // second thing to keep in step with it.
        add_action('admin_notices', [$this, 'render']);

        // Its own hook, and not `add()` into the list above, because it is the
        // one message that belongs on a screen WConvert has no menu entry on:
        // `admin_notices` does not fire in the network admin at all.
        add_action('network_admin_notices', [$this, 'warnAboutNetworkActivation']);
    }

    /**
     * Record a message for whichever render path this request reaches.
     */
    public function add(string $message): void
    {
        $this->messages[] = $message;
    }

    /**
     * Declare a hook suffix as one of WConvert's screens.
     */
    public function owns(string $hookSuffix): void
    {
        if ($hookSuffix === '') {
            return;
        }

        $this->screens[$hookSuffix] = true;
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

        $this->add(__(
            'WConvert has published Campaigns but its loader script is missing, so none of them can display. Reinstall the plugin to restore it.',
            'wconvert'
        ));
    }

    /**
     * ========================================================================
     * MULTISITE IS OUT OF SCOPE FOR v1, AND THIS IS WHERE THAT IS SAID OUT
     * LOUD.
     * ========================================================================
     * **The problem is not that network activation fails. It is that it works
     * on the sites you looked at.**
     *
     * {@see \WConvert\Bootstrap::activate()} installs tables for whichever
     * site's `$wpdb->prefix` was current and ignores `$network_wide`. The rest
     * of the network is not left broken forever — options are per-site and
     * `admin_init` fires per site, so a site with no `wconvert_db_version`
     * installs on its first dashboard visit. What that does not cover is a
     * site **nobody has opened the admin of**, whose front end is live and
     * whose capture path has no missing-table guard anywhere in it.
     *
     * Half-working and silent is worse than either honest alternative, and a
     * sentence is what removes the silence. It costs the price of one
     * `is_plugin_active_for_network()` on network-admin page loads, which are
     * rare and are not a merchant's or a visitor's request.
     *
     * **It is not dismissible**, deliberately: the condition it reports is
     * still true tomorrow, and a dismissal would store per-user state to hide
     * a fact about the install.
     *
     * The full job — looping `get_sites()` on activation and hooking
     * `wp_initialize_site` for sites created later — stays available for 1.2,
     * once there is evidence anyone wants it. Nothing here makes it harder.
     */
    public function warnAboutNetworkActivation(): void
    {
        // Asked rather than stored. Whether the plugin is network-activated is
        // a fact WordPress already holds, and recording our own copy of it at
        // activation would be a second source of truth that goes stale the
        // moment somebody activates from the Plugins screen instead.
        if (!is_multisite() || !function_exists('is_plugin_active_for_network')) {
            return;
        }

        if (!is_plugin_active_for_network(plugin_basename(WCONVERT_MAIN_FILE))) {
            return;
        }

        echo '<div class="notice notice-warning wconvert-notice"><p>';
        echo esc_html__(
            'WConvert does not support multisite in this version. Network activation only sets up the site whose dashboard was open at the time, and any site nobody has visited the admin of will have no database tables while its front end is live. Deactivate it for the network and activate it on each site individually instead.',
            'wconvert'
        );
        echo '</p></div>';
    }

    /**
     * Empty the notice hooks on WConvert's screens.
     *
     * All three, because `all_admin_notices` and `network_admin_notices` are
     * where a plugin puts a banner it wants shown on every screen — which is
     * the category this exists to keep off ours.
     *
     * This removes our own `admin_notices` callback along with everything
     * else, and that is intended: on our screen the surviving path is
     * {@see AdminMenu::renderScreen()}, and leaving both registered would
     * print the same sentence twice.
     *
     * It does **not** silence {@see self::warnAboutNetworkActivation()}, and
     * not because of an exception here. WConvert's screens are the ones
     * `add_menu_page()` returned a suffix for, which are per-site; the network
     * admin has none of them, so `isOurScreen()` is false there and this
     * returns before it removes anything.
     */
    public function suppress(): void
    {
        if (!$this->isOurScreen()) {
            return;
        }

        remove_all_actions('admin_notices');
        remove_all_actions('all_admin_notices');
        remove_all_actions('network_admin_notices');
    }

    /**
     * Print the plugin's notices.
     *
     * **Two call sites, one behaviour.** On a screen that is WordPress's this
     * runs from `admin_notices`. On a screen that is ours that hook has been
     * emptied, so {@see AdminMenu::renderScreen()} calls it directly from
     * inside the page — after the suppression and before React mounts, which
     * is what makes it the path that survives and the only path that can
     * report a MISSING ADMIN BUNDLE at all. That failure leaves no React to
     * render a message and no stylesheet to style one with.
     *
     * **So it wears WordPress's notice classes, on purpose.** ADR 0035 says
     * this screen renders no wp-admin chrome, and this is the one moment the
     * screen is not WConvert's: the assets that would have made it ours are
     * the thing that is missing. A notice that depends on the stylesheet whose
     * absence it is reporting is a notice nobody reads.
     *
     * `wconvert-notice` is what keeps it out of the catch-all in `index.css`
     * that hides banners echoed past the hook.
     */
    public function render(): void
    {
        foreach ($this->messages as $message) {
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
    private function isOurScreen(): bool
    {
        $suffix = $GLOBALS['hook_suffix'] ?? '';

        return is_string($suffix) && isset($this->screens[$suffix]);
    }
}

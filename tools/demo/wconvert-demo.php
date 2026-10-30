<?php

/**
 * Plugin Name: WConvert demo lockdown
 * Description: Keeps demo.wconvert.io's shared login safe. Must-use plugin; never ship it.
 *
 * Copy to `wp-content/mu-plugins/wconvert-demo.php` on the demo server only.
 *
 * Every demo visitor is the same `demo` user, so this file decides what that
 * user can reach. It is an **allow list**, not a block list: the demo user can
 * write through WConvert's own routes and nothing else, and anything this file
 * does not name is refused. The `wconvert_demo` role `seed.php` creates is the
 * first wall — it holds `read`, `manage_options` and `upload_files` and no
 * other capability, so posts, pages, raw HTML, plugins, themes and users are
 * already out of reach. These lists are the second wall.
 *
 * `administrator` accounts — ours, for upkeep — pass every list here except
 * mail and outbound requests, which are off for the whole site.
 *
 * The three hardening constants are defined here as well as being the ones to
 * put in `wp-config.php`. WordPress reads all three when it checks a
 * capability, not at boot, so defining them here works — and means they are on
 * wherever this file is, whatever `wp-config.php` says:
 *
 *     define('DISALLOW_FILE_MODS', true);
 *     define('DISALLOW_FILE_EDIT', true);
 *     define('DISALLOW_UNFILTERED_HTML', true);
 */

namespace WConvertDemo;

defined('ABSPATH') || exit;

foreach (['DISALLOW_FILE_MODS', 'DISALLOW_FILE_EDIT', 'DISALLOW_UNFILTERED_HTML'] as $constant) {
    if (!defined($constant)) {
        define($constant, true);
    }
}

const DEMO_LOGIN = 'demo';
const DEMO_ROLE = 'wconvert_demo';
const ADMIN_PAGE = 'wconvert';
const CATALOGUE_HOST = 'templates.wconvert.io';
const INSTALL_FREE = 'https://wordpress.org/plugins/wconvert/';
const GET_PRO = 'https://wconvert.io/pricing/';

/** Us. Everybody else — the demo user and anonymous visitors — is a visitor. */
function is_operator(): bool
{
    return (defined('WP_CLI') && WP_CLI) || in_array('administrator', wp_get_current_user()->roles, true);
}

function is_demo_user(): bool
{
    return in_array(DEMO_ROLE, wp_get_current_user()->roles, true);
}

function admin_home(): string
{
    return admin_url('admin.php?page=' . ADMIN_PAGE);
}

// ============================================================================
// ONE-CLICK ENTRY: /start logs in the demo user and opens WConvert
// ============================================================================

add_action('init', static function (): void {
    $path = trim((string) wp_parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH), '/');
    $home = trim((string) wp_parse_url(home_url(), PHP_URL_PATH), '/');
    if ($path !== ltrim($home . '/start', '/')) {
        return;
    }

    nocache_headers();
    if (!is_user_logged_in()) {
        $demo = get_user_by('login', DEMO_LOGIN);
        if ($demo === false) {
            wp_die('The demo is being prepared. Please try again in a minute.', 'WConvert demo', ['response' => 503]);
        }
        wp_set_current_user($demo->ID);
        wp_set_auth_cookie($demo->ID, false, is_ssl());
    }
    wp_safe_redirect(admin_home());
    exit;
}, 0);

// ============================================================================
// WP-ADMIN: WConvert's screen, and the three doors it needs
// ============================================================================

/** admin-ajax actions WConvert's screen uses: the session ping, the image picker's library, and core's compression probe. */
const AJAX_ACTIONS = ['heartbeat', 'query-attachments', 'get-attachment', 'wp-compression-test'];

/** admin-post actions: the Leads CSV export. */
const POST_ACTIONS = ['wconvert_export_leads'];

add_action('admin_init', static function (): void {
    if (!is_user_logged_in() || is_operator()) {
        return;
    }
    $action = sanitize_key((string) ($_REQUEST['action'] ?? ''));

    if (wp_doing_ajax()) {
        if (!in_array($action, AJAX_ACTIONS, true)) {
            wp_die('-1', 403);
        }
        return;
    }

    global $pagenow;
    $allowed = ($pagenow === 'admin.php' && ($_GET['page'] ?? '') === ADMIN_PAGE)
        || ($pagenow === 'admin-post.php' && in_array($action, POST_ACTIONS, true));
    if (!$allowed) {
        wp_safe_redirect(admin_home());
        exit;
    }
}, 1);

// A screen the role cannot open dies in menu.php, before `admin_init` runs.
add_action('admin_page_access_denied', static function (): void {
    if (is_user_logged_in() && !is_operator()) {
        wp_safe_redirect(admin_home());
        exit;
    }
});

// WooCommerce sends anybody without `edit_posts` to My Account, and hides their admin bar.
add_filter('woocommerce_prevent_admin_access', static fn (bool $prevent): bool => is_demo_user() ? false : $prevent);
add_filter('woocommerce_disable_admin_bar', static fn (bool $disable): bool => is_demo_user() ? false : $disable);

add_action('admin_menu', static function (): void {
    if (is_operator()) {
        return;
    }
    global $menu;
    foreach ((array) $menu as $item) {
        if (($item[2] ?? '') !== ADMIN_PAGE) {
            remove_menu_page((string) ($item[2] ?? ''));
        }
    }
    remove_submenu_page(ADMIN_PAGE, 'admin.php?page=' . ADMIN_PAGE . '#license');
}, PHP_INT_MAX);

// The plan badge in WConvert's header links to the License page.
add_filter('wconvert_pro_admin_settings', static function (array $settings): array {
    if (!is_operator()) {
        unset($settings['planBadge']);
    }
    return $settings;
}, PHP_INT_MAX);

// ============================================================================
// REST: writes only through WConvert, and the shop's cart
// ============================================================================

/** Route prefixes a visitor may write to. */
const WRITABLE = ['/wconvert/v1/', '/wc/store/v1/cart', '/wc/store/cart', '/wc/store/v1/batch', '/wc/store/batch'];

/** Route prefixes nobody but us may touch, even to read. */
const SEALED = ['/wconvert/v1/license', '/wc/store/v1/checkout', '/wc/store/checkout', '/wp/v2/settings', '/wp/v2/users'];

add_filter('rest_pre_dispatch', static function ($result, $server, \WP_REST_Request $request) {
    if ($result !== null || is_operator()) {
        return $result;
    }
    $route = untrailingslashit($request->get_route()) . '/';
    $starts = static fn (array $prefixes): bool => array_filter($prefixes, static fn (string $p): bool => str_starts_with($route, $p)) !== [];

    $read = in_array($request->get_method(), ['GET', 'HEAD', 'OPTIONS'], true);
    $sealed = $starts(SEALED) && !($read && $route === '/wp/v2/users/me/');
    if ($sealed || (!$read && !$starts(WRITABLE))) {
        return new \WP_Error('wconvert_demo_locked', 'That is switched off in the shared demo.', ['status' => 403]);
    }

    return $result;
}, 0, 3);

// ============================================================================
// THE SHOP: no checkout, no accounts, no comments
// ============================================================================

add_action('template_redirect', static function (): void {
    if (is_operator() || !function_exists('is_checkout') || !is_checkout()) {
        return;
    }
    wc_add_notice('Checkout is switched off in the demo. Your cart is real, though, so the cart reminder can find you.', 'notice');
    wp_safe_redirect(wc_get_cart_url());
    exit;
});
add_action('woocommerce_checkout_process', static function (): void {
    if (!is_operator()) {
        wc_add_notice('Checkout is switched off in the demo.', 'error');
    }
});

add_filter('pre_option_users_can_register', static fn () => '0');
add_filter('pre_option_woocommerce_enable_myaccount_registration', static fn () => 'no');
add_filter('woocommerce_registration_errors', static fn (\WP_Error $errors): \WP_Error => is_operator()
    ? $errors
    : new \WP_Error('wconvert_demo_locked', 'Accounts are switched off in the demo.'));

add_filter('comments_open', '__return_false', PHP_INT_MAX);
add_filter('pings_open', '__return_false', PHP_INT_MAX);
add_filter('xmlrpc_enabled', '__return_false');

// ============================================================================
// NOTHING LEAVES THE SERVER: no mail, and no requests but the template catalogue
// ============================================================================

// Reported as sent, so a lead magnet's "check your inbox" still reads true to the visitor.
add_filter('pre_wp_mail', static fn (): bool => true, PHP_INT_MAX);

add_filter('pre_http_request', static function ($pre, array $args, string $url) {
    $host = strtolower((string) wp_parse_url($url, PHP_URL_HOST));
    // The site itself stays reachable, so WordPress's own cron can spawn.
    if ($host === CATALOGUE_HOST || $host === strtolower((string) wp_parse_url(home_url(), PHP_URL_HOST))) {
        return $pre;
    }

    return new \WP_Error('wconvert_demo_offline', 'Outbound requests are switched off in the shared demo.');
}, PHP_INT_MAX, 3);

// ============================================================================
// NOINDEX, EVERYWHERE
// ============================================================================

add_action('init', static function (): void {
    if (!headers_sent()) {
        header('X-Robots-Tag: noindex, nofollow', true);
    }
}, 1);
add_filter('wp_robots', static fn (array $robots): array => ['noindex' => true, 'nofollow' => true] + $robots, PHP_INT_MAX);
add_filter('robots_txt', static fn (): string => "User-agent: *\nDisallow: /\n", PHP_INT_MAX);

// ============================================================================
// THE DEMO BAR: "Shared demo · resets every hour · Install free · Get Pro"
// ============================================================================
// In the admin bar wherever there is one, and as a strip above the page for
// visitors browsing the shop without having pressed Open demo.

add_action('admin_bar_menu', static function (\WP_Admin_Bar $bar): void {
    if (is_operator()) {
        return;
    }
    foreach (['wp-logo', 'comments', 'new-content', 'updates', 'edit-profile', 'user-info', 'customize', 'search', 'edit', 'site-editor'] as $node) {
        $bar->remove_node($node);
    }
    $bar->add_node(['id' => 'wconvert-demo', 'title' => 'Shared demo · resets every hour']);
    $bar->add_node(['id' => 'wconvert-demo-free', 'title' => 'Install free', 'href' => INSTALL_FREE, 'meta' => ['target' => '_blank']]);
    $bar->add_node(['id' => 'wconvert-demo-pro', 'title' => 'Get Pro', 'href' => GET_PRO, 'meta' => ['target' => '_blank']]);
}, PHP_INT_MAX);

function bar_styles(): void
{
    if (is_operator()) {
        return;
    }
    echo '<style>',
        '#wp-admin-bar-wconvert-demo .ab-item{opacity:.8}',
        '#wpadminbar #wp-admin-bar-wconvert-demo-free .ab-item{color:#fff;text-decoration:underline}',
        '#wpadminbar #wp-admin-bar-wconvert-demo-pro .ab-item{background:#f0b849;color:#1d2327;font-weight:600}',
        '.wconvert-demo-bar{background:#1d2327;color:#f0f0f1;font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:8px 16px;text-align:center}',
        '.wconvert-demo-bar a{color:#fff;font-weight:600;margin-left:12px}',
        '.wconvert-demo-bar a.is-pro{background:#f0b849;color:#1d2327;border-radius:3px;padding:2px 8px;text-decoration:none}',
        '</style>';
}
add_action('admin_head', __NAMESPACE__ . '\\bar_styles');
add_action('wp_head', __NAMESPACE__ . '\\bar_styles');

add_action('wp_body_open', static function (): void {
    if (is_user_logged_in()) {
        return;
    }
    printf(
        '<div class="wconvert-demo-bar">Shared demo · resets every hour <a href="%s">Open the WConvert admin</a> <a href="%s" target="_blank" rel="noopener">Install free</a> <a class="is-pro" href="%s" target="_blank" rel="noopener">Get Pro</a></div>',
        esc_url(home_url('/start')),
        esc_url(INSTALL_FREE),
        esc_url(GET_PRO)
    );
});

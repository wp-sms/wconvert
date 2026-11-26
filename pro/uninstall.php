<?php
/** Release the licence seat, then remove optional tracking configuration; historical order provenance belongs to WooCommerce. */
defined('WP_UNINSTALL_PLUGIN') || exit;

// The seat first, while the key that releases it is still stored. The plugin
// is not loaded here, so Pro's constants and autoloader are (ADR 0143).
//
// That code needs PHP 8.1, and this file runs on whatever the site has, so the
// rest of it stays PHP 7 syntax. Below 8.1 the licence stays stored: its key is
// what frees the seat, and Pro installed again on a newer PHP can still use it.
// Only the daily check goes, by its name (RefreshCron::HOOK).
if (version_compare(PHP_VERSION, '8.1', '>=')) {
    require_once __DIR__ . '/src/constants.php';
    require_once __DIR__ . '/src/autoload.php';
    WConvert\Pro\License\Uninstall::run();
} else {
    wp_clear_scheduled_hook('wconvert_pro_license_refresh');
}

delete_option('wconvert_revenue');
// Analytics\Settings::OPTION — the tracking IDs and switches (#374).
delete_option('wconvert_analytics');
wp_unschedule_hook('wconvert_claims_sweep');
delete_option('wconvert_claims_mark');
global $wpdb;
// Only exact plugin-owned receipt keys, never a shopper's session or order.
$wconvertClaims = $wpdb->get_col("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE 'wconvert\\_order\\_claim\\_%'");
foreach ($wconvertClaims as $wconvertClaim) {
    if (preg_match('/^wconvert_order_claim_[a-f0-9]{64}$/D', $wconvertClaim)) delete_option($wconvertClaim);
}
$wconvertCartClaims = $wpdb->get_col("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE 'wconvert\\_cart\\_claim\\_%'");
foreach ($wconvertCartClaims as $wconvertCartClaim) {
    if (preg_match('/^wconvert_cart_claim_[a-f0-9]{64}$/D', $wconvertCartClaim)) delete_option($wconvertCartClaim);
}

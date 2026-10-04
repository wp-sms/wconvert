<?php
/** Remove optional tracking configuration; historical order provenance belongs to WooCommerce. */
defined('WP_UNINSTALL_PLUGIN') || exit;
delete_option('wconvert_revenue');
wp_unschedule_hook('wconvert_attribution_claim_expired');
global $wpdb;
// Only exact plugin-owned receipt keys, never a shopper's session or order.
$wconvertClaims = $wpdb->get_col("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE 'wconvert\\_order\\_claim\\_%'");
foreach ($wconvertClaims as $wconvertClaim) {
    if (preg_match('/^wconvert_order_claim_[a-f0-9]{64}$/D', $wconvertClaim)) delete_option($wconvertClaim);
}

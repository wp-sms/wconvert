<?php
/**
 * Plugin Name: WConvert
 * Plugin URI: https://wconvert.io/
 * Description: Lead capture and conversion display — popups, floating bars, slide-ins and inline forms, created goal-first.
 * Version: 0.1.0
 * Author: VeronaLabs
 * Author URI: https://veronalabs.com/
 * Text Domain: wconvert
 * Domain Path: /resources/languages
 * Requires at least: 6.2
 * Requires PHP: 8.1
 * License: GPL-2.0+
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

defined('ABSPATH') || exit;

/*
|--------------------------------------------------------------------------
| The free plugin, whole
|--------------------------------------------------------------------------
| This file has no knowledge of Pro at all — no directory probe, no tier
| constant, no overlay autoloader. Pro is a SEPARATE plugin installed
| alongside this one (ADR 0014), so there is nothing here to detect and
| nothing here to strip. Whether Pro is present is answered in exactly one
| place, WConvert\Support\ProPresence, and only by whether Pro said so.
|
| WSMS's wp-sms.php opens with a premium-overlay probe fenced in
| @build-strip-free markers. That shape is not inherited: it exists because
| WSMS ships one plugin in per-tier builds, and this one does not.
*/

require_once __DIR__ . '/src/constants.php';

$wconvertAutoloader = __DIR__ . '/vendor/autoload.php';

if (!is_file($wconvertAutoloader)) {
    add_action('admin_notices', static function (): void {
        echo '<div class="notice notice-error"><p>';
        echo esc_html__(
            'WConvert could not start — its autoloader is missing. Reinstall the plugin to restore it.',
            'wconvert'
        );
        echo '</p></div>';
    });

    return;
}

require_once $wconvertAutoloader;

/*
|--------------------------------------------------------------------------
| Action Scheduler, bundled — a CORE dependency, not a premium one
|--------------------------------------------------------------------------
| Every [[Destination]] push is queued, including the in-process WSMS one, so
| the free plugin needs a scheduler with no ESP in sight (#4, ADR 0008). WSMS's
| own build stages Action Scheduler into its FREE tier for the same reason, and
| WooCommerce has shipped it that way for years.
|
| Loaded HERE rather than on `plugins_loaded`, because Action Scheduler
| version-negotiates at load time so the newest copy on the site wins — and a
| copy that registers late has already lost that negotiation. It must never be
| php-scoped for the same reason: `wp-sms.php:127` says it outright, "shared
| library — must NOT be prefixed".
|
| Composer's autoloader does not pull it in: it is a WordPress plugin rather
| than a PSR-4 library, and its entry file is what defines `as_*()`.
*/
$wconvertActionScheduler = __DIR__ . '/vendor/woocommerce/action-scheduler/action-scheduler.php';

if (is_file($wconvertActionScheduler)) {
    require_once $wconvertActionScheduler;
}

WConvert\Bootstrap::init();

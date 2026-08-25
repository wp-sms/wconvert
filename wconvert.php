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

WConvert\Bootstrap::init();

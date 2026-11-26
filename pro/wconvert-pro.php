<?php
/**
 * Plugin Name: WConvert Pro
 * Plugin URI: https://wconvert.io/pricing/
 * Description: Supplies WConvert's premium capabilities — the exit-intent and scroll-up Triggers, the advanced Conditions, floating bars and slide-ins, A/B testing, and the ESP Destinations.
 * Version: 1.1.1
 * Author: VeronaLabs
 * Author URI: https://veronalabs.com/
 * Text Domain: wconvert-pro
 * Domain Path: /resources/languages
 * Requires at least: 6.9
 * Requires PHP: 8.1
 * Requires Plugins: wconvert
 * License: GPL-2.0+
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

defined('ABSPATH') || exit;

/*
|--------------------------------------------------------------------------
| Pro is an add-on, not a replacement
|--------------------------------------------------------------------------
| Pro is installed ALONGSIDE the free plugin rather than instead of it
| (ADR 0014), and it does not unlock free's premium features — it SUPPLIES
| them. The code for exit intent, the advanced Conditions, floating_bar,
| slide_in, A/B testing and the ESP destinations exists only in this tree,
| and a free install has never contained it.
|
| There is no licence check here, and there will not be one. A licence buys
| updates and support, never the features themselves (ADR 0015): possession
| is the gate, so once the code is genuinely absent from free there is
| nothing left to guard. The licence code that does exist (src/License/,
| ADR 0143) runs the updater and the License page, and nothing it decides
| reaches a feature.
*/

/*
|--------------------------------------------------------------------------
| PHP 8.1 or newer, checked before any 8.1 code is read
|--------------------------------------------------------------------------
| The same guard as free's, and needed separately: this file loads on its own,
| and Pro's first enum is a parse error on PHP 8.0. This file and the notice
| below stay PHP 7 syntax.
*/
if (version_compare(PHP_VERSION, '8.1', '<')) {
    add_action('admin_notices', static function () {
        echo '<div class="notice notice-error"><p>';
        echo esc_html(sprintf(
            /* translators: %s: the PHP version the site runs, for example 8.0.30. */
            __('WConvert Pro needs PHP 8.1 or newer, and this site runs PHP %s. WConvert Pro is paused until PHP is updated. Your host can update it for you.', 'wconvert-pro'),
            PHP_VERSION
        ));
        echo '</p></div>';
    });

    return;
}

require_once __DIR__ . '/src/constants.php';
require_once __DIR__ . '/src/autoload.php';

WConvert\Pro\Bootstrap::init();

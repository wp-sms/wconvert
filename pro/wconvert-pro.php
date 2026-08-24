<?php
/**
 * Plugin Name: WConvert Pro
 * Plugin URI: https://wconvert.io/pro/
 * Description: Supplies WConvert's premium capabilities — exit-intent and scroll-up triggers, advanced targeting, floating bars and slide-ins, A/B testing, and the ESP destinations.
 * Version: 0.1.0
 * Author: VeronaLabs
 * Author URI: https://veronalabs.com/
 * Text Domain: wconvert-pro
 * Domain Path: /resources/languages
 * Requires at least: 6.0
 * Requires PHP: 8.1
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
| them. The code for exit intent, the advanced conditions, floating_bar,
| slide_in, A/B testing and the ESP destinations exists only in this tree,
| and a free install has never contained it.
|
| There is no licence check here, and there will not be one. A licence buys
| updates and support, never the features themselves (ADR 0015): possession
| is the gate, so once the code is genuinely absent from free there is
| nothing left to guard.
*/

require_once __DIR__ . '/src/constants.php';
require_once __DIR__ . '/src/autoload.php';

WConvert\Pro\Bootstrap::init();

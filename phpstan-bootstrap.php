<?php

/**
 * PHPStan bootstrap.
 *
 * Defines the constants the plugins define at load time so static analysis
 * sees them as defined rather than as possibly-undefined globals. It is a
 * stand-in for `wp-config.php` plus the two plugin files, and nothing more —
 * every value here is analysis-only.
 */

defined('ABSPATH') || define('ABSPATH', '/');

defined('WCONVERT_VERSION') || define('WCONVERT_VERSION', '0.1.0');
defined('WCONVERT_DIR') || define('WCONVERT_DIR', __DIR__ . '/');
defined('WCONVERT_URL') || define('WCONVERT_URL', 'https://example.test/wp-content/plugins/wconvert/');
defined('WCONVERT_MAIN_FILE') || define('WCONVERT_MAIN_FILE', __DIR__ . '/wconvert.php');

defined('WCONVERT_PRO_VERSION') || define('WCONVERT_PRO_VERSION', '0.1.0');
defined('WCONVERT_PRO_DIR') || define('WCONVERT_PRO_DIR', __DIR__ . '/pro/');
defined('WCONVERT_PRO_URL') || define('WCONVERT_PRO_URL', 'https://example.test/wp-content/plugins/wconvert-pro/');
defined('WCONVERT_PRO_MAIN_FILE') || define('WCONVERT_PRO_MAIN_FILE', __DIR__ . '/pro/wconvert-pro.php');
defined('WCONVERT_MIN_CORE') || define('WCONVERT_MIN_CORE', '0.1.0');

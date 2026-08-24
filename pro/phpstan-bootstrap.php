<?php

/**
 * PHPStan bootstrap — PRO.
 *
 * Separate from free's for the same reason Pro is a separate plugin: these
 * constants are Pro's, and stating them inside free's tree would put a Pro
 * reference there. Analysis-only, like its free counterpart.
 */

defined('WCONVERT_PRO_VERSION') || define('WCONVERT_PRO_VERSION', '0.1.0');
defined('WCONVERT_PRO_DIR') || define('WCONVERT_PRO_DIR', __DIR__ . '/');
defined('WCONVERT_PRO_URL') || define('WCONVERT_PRO_URL', 'https://example.test/wp-content/plugins/wconvert-pro/');
defined('WCONVERT_PRO_MAIN_FILE') || define('WCONVERT_PRO_MAIN_FILE', __DIR__ . '/wconvert-pro.php');
defined('WCONVERT_MIN_CORE') || define('WCONVERT_MIN_CORE', '0.1.0');

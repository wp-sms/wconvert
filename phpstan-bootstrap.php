<?php

/**
 * PHPStan bootstrap — FREE.
 *
 * Defines the constants the free plugin defines at load time so static
 * analysis sees them as defined rather than as possibly-undefined globals. It
 * stands in for wp-config.php plus wconvert.php, and nothing more; every value
 * here is analysis-only.
 *
 * Pro's constants live in pro/phpstan-bootstrap.php and deliberately not here.
 * This file sits in free's tree, where bin/verify-source-contract.sh scans
 * root-level PHP — and it caught exactly that: naming Pro's plugin file here
 * put a `pro/` path in free's tree. Analysis tooling is not an exemption from
 * the invariant; it is just another file that has to hold to it.
 */

defined('ABSPATH') || define('ABSPATH', '/');

defined('WCONVERT_VERSION') || define('WCONVERT_VERSION', '0.1.0');
defined('WCONVERT_DIR') || define('WCONVERT_DIR', __DIR__ . '/');
defined('WCONVERT_URL') || define('WCONVERT_URL', 'https://example.test/wp-content/plugins/wconvert/');
defined('WCONVERT_MAIN_FILE') || define('WCONVERT_MAIN_FILE', __DIR__ . '/wconvert.php');

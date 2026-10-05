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

defined('WCONVERT_VERSION') || define('WCONVERT_VERSION', '1.0.0');
defined('WCONVERT_DIR') || define('WCONVERT_DIR', __DIR__ . '/');
defined('WCONVERT_URL') || define('WCONVERT_URL', 'https://example.test/wp-content/plugins/wconvert/');
defined('WCONVERT_MAIN_FILE') || define('WCONVERT_MAIN_FILE', __DIR__ . '/wconvert.php');

// WordPress's own time constants. wp-config.php has them defined by the time
// any plugin file runs, so analysis has to see them as defined too.
defined('HOUR_IN_SECONDS') || define('HOUR_IN_SECONDS', 3600);
defined('DAY_IN_SECONDS') || define('DAY_IN_SECONDS', 86400);

/*
 * The database credentials wp-config.php defines.
 *
 * `bin/verify-stats.php` opens a SECOND connection with them — the concurrency
 * check needs two, and `wpdb` keeps its own handle protected — so analysis has
 * to see them as defined for the same reason it has to see ABSPATH.
 */
defined('DB_NAME') || define('DB_NAME', 'wordpress');
defined('DB_USER') || define('DB_USER', 'root');
defined('DB_PASSWORD') || define('DB_PASSWORD', '');
defined('DB_HOST') || define('DB_HOST', 'localhost');

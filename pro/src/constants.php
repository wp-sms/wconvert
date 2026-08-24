<?php

defined('ABSPATH') || exit;

$wconvertProPluginDir = dirname(__DIR__);

if (!defined('WCONVERT_PRO_VERSION')) {
    define('WCONVERT_PRO_VERSION', '0.1.0');
}

/*
 * The lowest free version this Pro build runs against.
 *
 * Free and Pro release on independent tags with independent version numbers
 * (ADR 0030), so this is the ONE statement Pro makes about free — which is
 * what keeps the skew between them a single, checkable number.
 *
 * It must be ≤ the highest free version ACTUALLY PUBLISHED, not the one in
 * this working tree. Raising it to a free version still sitting in the wp.org
 * review queue ships a Pro that refuses to boot on every install that can
 * exist, and presents to the merchant as premium features silently missing.
 * The release guard asserts that as its fifth condition — it lands with the
 * release workflow, in its own ticket.
 */
if (!defined('WCONVERT_MIN_CORE')) {
    define('WCONVERT_MIN_CORE', '0.1.0');
}

if (!defined('WCONVERT_PRO_DIR')) {
    define('WCONVERT_PRO_DIR', $wconvertProPluginDir . '/');
}

if (!defined('WCONVERT_PRO_URL')) {
    define('WCONVERT_PRO_URL', plugin_dir_url($wconvertProPluginDir . '/wconvert-pro.php'));
}

if (!defined('WCONVERT_PRO_MAIN_FILE')) {
    define('WCONVERT_PRO_MAIN_FILE', WCONVERT_PRO_DIR . 'wconvert-pro.php');
}

unset($wconvertProPluginDir);

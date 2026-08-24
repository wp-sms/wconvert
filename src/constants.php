<?php

defined('ABSPATH') || exit;

$wconvertPluginDir = dirname(__DIR__);

/*
 * WCONVERT_VERSION is the free plugin's version, and it is a public fact: it is
 * the number Pro's WCONVERT_MIN_CORE guard compares against (ADR 0030). Its
 * presence is also how Pro tells "free is installed and running" from "free is
 * absent entirely", so it is defined before anything can fail.
 */
if (!defined('WCONVERT_VERSION')) {
    define('WCONVERT_VERSION', '0.1.0');
}

if (!defined('WCONVERT_DIR')) {
    define('WCONVERT_DIR', $wconvertPluginDir . '/');
}

if (!defined('WCONVERT_URL')) {
    define('WCONVERT_URL', plugin_dir_url($wconvertPluginDir . '/wconvert.php'));
}

if (!defined('WCONVERT_MAIN_FILE')) {
    define('WCONVERT_MAIN_FILE', WCONVERT_DIR . 'wconvert.php');
}

unset($wconvertPluginDir);

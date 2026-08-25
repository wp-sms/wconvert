<?php

/**
 * PHPUnit bootstrap.
 *
 * The suite runs standalone: no WordPress, no database. Everything under test
 * here is either a pure function or a class whose WordPress touchpoints are
 * passed in, so a WordPress install would add minutes and prove nothing extra.
 */

require_once dirname(__DIR__) . '/vendor/autoload.php';

// Both plugin trees guard their files with `defined('ABSPATH') || exit`, so
// nothing loads without it.
if (!defined('ABSPATH')) {
    define('ABSPATH', '/');
}

// Pro carries its own PSR-4 autoloader rather than riding on free's Composer
// map — see the header of pro/src/autoload.php for why. Requiring that same
// file here keeps one definition of where Pro's classes live.
require_once dirname(__DIR__) . '/pro/src/autoload.php';

/*
 * The handful of WordPress functions the units under test call.
 *
 * Deliberately tiny, and deliberately not a WordPress test install: a class
 * that needs more of WordPress than this is a class whose WordPress
 * touchpoints should have been passed in. Each stub is the real function's
 * documented behaviour for the arguments WConvert actually passes.
 */
if (!function_exists('current_time')) {
    function current_time(string $type, int $gmt = 0): string
    {
        return $type === 'mysql' ? gmdate('Y-m-d H:i:s') : (string) time();
    }
}

if (!function_exists('wp_json_encode')) {
    /** @param mixed $data */
    function wp_json_encode($data, int $options = 0): string|false
    {
        return json_encode($data, $options);
    }
}

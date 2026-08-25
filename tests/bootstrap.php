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

/*
 * The action hook, and only the action hook.
 *
 * `wconvert_lead_captured` is the seam a [[Destination]] dispatch attaches to
 * (#30), and the ordering guarantee around it — the local row written FIRST and
 * ALWAYS, before anything else runs (ADR 0007) — is a property of WConvert's own
 * code that a test has to be able to observe. So the two functions that make a
 * hook a hook are here, and nothing else of WordPress's plugin API is.
 *
 * @var array<string, list<callable>> $wconvertTestActions
 */
$GLOBALS['wconvertTestActions'] = [];

if (!function_exists('add_action')) {
    function add_action(string $hook, callable $callback, int $priority = 10, int $args = 1): bool
    {
        $GLOBALS['wconvertTestActions'][$hook][] = $callback;

        return true;
    }
}

if (!function_exists('do_action')) {
    /** @param mixed ...$args */
    function do_action(string $hook, ...$args): void
    {
        foreach ($GLOBALS['wconvertTestActions'][$hook] ?? [] as $callback) {
            $callback(...$args);
        }
    }
}

if (!function_exists('remove_all_actions')) {
    function remove_all_actions(string $hook, ?int $priority = null): bool
    {
        unset($GLOBALS['wconvertTestActions'][$hook]);

        return true;
    }
}

if (!function_exists('esc_url')) {
    function esc_url(string $url): string
    {
        return htmlspecialchars($url, ENT_QUOTES);
    }
}

/*
 * REST route registration, recorded rather than performed.
 *
 * The capture route's `args` is deliberately almost empty: declaring
 * `'type' => 'boolean'` for `consent` would run
 * `rest_sanitize_value_from_schema`, which coerces `"true"`, `"on"` and `"1"`
 * into `true` — and a lenient read is an optional consent checkbox by another
 * name (ADR 0032). That is a property of the REGISTRATION, invisible to every
 * test that goes through the form, so it needs a way to be asserted.
 *
 * @var list<array{namespace: string, route: string, args: array<mixed>}> $wconvertTestRoutes
 */
$GLOBALS['wconvertTestRoutes'] = [];

if (!function_exists('register_rest_route')) {
    /** @param array<mixed> $args */
    function register_rest_route(string $namespace, string $route, array $args = []): bool
    {
        $GLOBALS['wconvertTestRoutes'][] = ['namespace' => $namespace, 'route' => $route, 'args' => $args];

        return true;
    }
}

if (!function_exists('__')) {
    function __(string $text, string $domain = 'default'): string
    {
        return $text;
    }
}

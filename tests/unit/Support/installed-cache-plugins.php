<?php

/*
 * WP Super Cache and Cache Enabler, as much of each as the purge touches.
 *
 * The GLOBAL namespace, deliberately: `WConvert\Pro\Boot\PageCache` reaches
 * these by name, and a name resolves in the global namespace or not at all —
 * so a copy declared inside a test's own namespace would be invisible to the
 * code under test and the whole file would prove nothing.
 *
 * Not in tests/bootstrap.php, because these are not WordPress. They are two
 * third-party plugins standing in for the set of them, and the page-cache test
 * is the only file with any business pretending they are installed.
 *
 * One of each SHAPE rather than one of each plugin: a bare function, and a
 * static method. Those are the two things `is_callable()` has to be right
 * about, and the rest of the list is more of the same.
 */

if (!function_exists('wp_cache_clear_cache')) {
    /** WP Super Cache. */
    function wp_cache_clear_cache(): void
    {
        $GLOBALS['wconvertTestPurgesCalled'][] = 'wp_cache_clear_cache';
    }
}

if (!class_exists('Cache_Enabler')) {
    /** Cache Enabler, which exposes a static method rather than a function. */
    class Cache_Enabler
    {
        public static function clear_complete_cache(): void
        {
            $GLOBALS['wconvertTestPurgesCalled'][] = 'Cache_Enabler::clear_complete_cache';
        }
    }
}

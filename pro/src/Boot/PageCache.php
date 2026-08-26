<?php

namespace WConvert\Pro\Boot;

defined('ABSPATH') || exit;

/**
 * =============================================================================
 * TURNING PRO ON OR OFF CHANGES THE ASSET URL, SO THE PAGE CACHE MUST GO.
 * =============================================================================
 * [[Pro]] ships a complete replacement loader and dequeues free's (ADR 0014),
 * so activating or deactivating it changes the `<script src>` that every
 * already-cached page carries. A full-page cache is the whole reason the
 * loader is shaped the way it is (ADR 0004), and it is exactly what would keep
 * serving the old URL.
 *
 * **This is the trigger, and there is no other.** ADR 0014 replaced the loader
 * prototype's vaguer "an entitlement change must purge the page cache" with a
 * concrete, synchronous, plugin-lifecycle event, because a licence never gated
 * a feature (ADR 0015) — so there is no licence webhook in this design to miss
 * and no licence event that could stand in for one. What changes the page is a
 * plugin going on or off, and WordPress hands us both moments.
 *
 * WHAT THIS IS NOT. WordPress has no page-cache API, so no purge can be
 * complete: a CDN, a host-level Varnish, a reverse proxy nobody told us about
 * will all keep their copy. **The design does not rest on it.** A stale page
 * keeps working in both directions — free's loader is still on disk after Pro
 * activates, and Pro's is still on disk after it deactivates, because
 * deactivating a plugin does not delete its files. So a merchant on a stale
 * page gets the previous tier's behaviour for a few minutes, not a 404 and a
 * dead popup. The purge makes the change take effect promptly; it is not what
 * keeps the site working.
 *
 * @since 0.1.0
 */
final class PageCache
{
    /**
     * Fired after every purge above has been attempted.
     *
     * The extension point that keeps the lists below from having to be
     * complete, which they cannot be: a host's mu-plugin, a CDN, the next WP
     * Rocket. It fires whether or not anything above was reachable, because
     * "we purged nothing we knew about" is precisely when someone else's
     * listener matters most.
     */
    public const PURGED = 'wconvert_purge_page_cache';

    /**
     * The page caches that expose something to call.
     *
     * Names rather than callables, and one list rather than two: a bare
     * function and a `Class::method` are both things `is_callable()` answers
     * for, so the difference between WP Super Cache and Cache Enabler stops
     * mattering at the point where it would otherwise become a second list.
     *
     * **This list is allowed to be incomplete and is not allowed to be
     * clever.** It is third-party knowledge, not a duplicate of anything
     * WConvert owns, so it is not the kind of second list ADR 0005 and
     * ADR 0015 refuse — nothing here drifts against a manifest, and an entry
     * that goes stale simply stops matching and is skipped.
     *
     * @var list<string>
     */
    private const PURGES = [
        'wp_cache_clear_cache',                    // WP Super Cache
        'w3tc_flush_all',                          // W3 Total Cache
        'rocket_clean_domain',                     // WP Rocket
        'wpfc_clear_all_cache',                    // WP Fastest Cache
        'sg_cachepress_purge_cache',               // SiteGround Optimizer
        'Cache_Enabler::clear_complete_cache',     // Cache Enabler
        'autoptimizeCache::clearall',              // Autoptimize
    ];

    /**
     * The page caches that listen on an action.
     *
     * Fired unconditionally. Asking whether the plugin is installed first
     * would be a second list to keep in step with this one, and firing an
     * action nobody listens to costs nothing.
     *
     * @var list<string>
     */
    private const ACTIONS = [
        'litespeed_purge_all',       // LiteSpeed Cache
        'rt_nginx_helper_purge_all', // Nginx Helper
        'breeze_clear_all_cache',    // Breeze
        'wpo_cache_flush',           // WP-Optimize
    ];

    /**
     * Purge every page cache this build can reach.
     *
     * It runs on activation and on deactivation, which are admin requests a
     * merchant is waiting on — never on a front-end request, where ADR 0004's
     * whole argument is that the request path carries no branches it does not
     * have to.
     *
     * **The object cache is deliberately left alone.** What changed is one
     * asset URL inside cached HTML; flushing a shared Redis or Memcached would
     * evict every other plugin's data on the site to fix it, which is a far
     * larger act than the one being asked for.
     */
    public static function purge(): void
    {
        foreach (self::PURGES as $purge) {
            // A cache that is not installed is skipped, not asked — the
            // ordinary WordPress site has none of these. `is_callable()`
            // rather than `function_exists()`, because it answers for both
            // shapes and a plugin that renamed its purge is then skipped
            // rather than fataled on.
            if (is_callable($purge)) {
                $purge();
            }
        }

        foreach (self::ACTIONS as $action) {
            do_action($action);
        }

        /**
         * Fires when WConvert Pro has purged what it knows how to purge.
         *
         * @since 0.1.0
         */
        do_action(self::PURGED);
    }
}

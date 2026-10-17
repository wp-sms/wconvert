<?php

namespace WConvert\Frontend;

defined('ABSPATH') || exit;

/**
 * =============================================================================
 * WHAT A CACHED PAGE CARRIES CHANGED, SO THE PAGE CACHE MUST GO.
 * =============================================================================
 * Every page carries two things a full-page cache freezes (ADR 0004): the
 * published set, inlined as the payload, and the loader's `<script src>`. Two
 * events change them, and each purges.
 *
 * - **The published set changed** — a campaign was published, paused, edited
 *   or deleted. Free hooks this to `wconvert_published_set_changed`, which only
 *   {@see \WConvert\Optin\PublishedSet::replaceWith()} fires (ADR 0150). It is
 *   free's, not Pro's, because pausing a campaign early is a free act and a
 *   cached page that keeps showing it is a free bug. A rebuild for a timezone,
 *   a permalink or an upgrade fires it too. Those are rare admin saves, and an
 *   extra purge on one costs less than a second hook to tell them apart.
 * - **Pro went on or off** — Pro replaces free's loader (ADR 0014), so the
 *   asset URL changed. Pro's lifecycle hooks call {@see self::purge()}
 *   directly.
 *
 * WHAT THIS IS NOT. WordPress has no page-cache API, so no purge can be
 * complete: a CDN, a host-level Varnish, a reverse proxy nobody told us about
 * will all keep their copy. **The design does not rest on it.** A schedule's
 * ends are enforced by the loader against the visitor's clock (ADR 0050), so a
 * stale page still stops showing a campaign whose window closed; and a stale
 * loader URL still resolves, because deactivating a plugin does not delete its
 * files. The purge makes a change take effect promptly; it is not what keeps
 * the site correct. `wconvert_purge_page_cache` is where a Cloudflare or a
 * host cache joins in.
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
     * Keyed by what is called, valued by the product's name.
     *
     * @var array<string, string>
     */
    private const PURGES = [
        'wp_cache_clear_cache' => 'WP Super Cache',
        'w3tc_flush_all' => 'W3 Total Cache',
        'rocket_clean_domain' => 'WP Rocket',
        'wpfc_clear_all_cache' => 'WP Fastest Cache',
        'sg_cachepress_purge_cache' => 'SiteGround Optimizer',
        'Cache_Enabler::clear_complete_cache' => 'Cache Enabler',
        'autoptimizeCache::clearall' => 'Autoptimize',
    ];

    /** @var list<string> The caches the last purge in this request reached, by name. */
    private static array $lastPurged = [];

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
     * It runs when the published set is rebuilt and on Pro's activation and
     * deactivation — admin and REST requests a merchant is waiting on, never a
     * front-end page view, where ADR 0004's whole argument is that the request
     * path carries no branches it does not have to.
     *
     * **The object cache is deliberately left alone.** What changed is one
     * asset URL inside cached HTML; flushing a shared Redis or Memcached would
     * evict every other plugin's data on the site to fix it, which is a far
     * larger act than the one being asked for.
     *
     * @return list<string> The PURGES entries that were installed and called,
     *                      for a reply that names what was cleared. The
     *                      actions are not in it: firing one says nothing
     *                      about whether anything listened.
     */
    public static function purge(): array
    {
        $called = [];

        foreach (array_keys(self::PURGES) as $purge) {
            // A cache that is not installed is skipped, not asked — the
            // ordinary WordPress site has none of these. `is_callable()`
            // rather than `function_exists()`, because it answers for both
            // shapes and a plugin that renamed its purge is then skipped
            // rather than fataled on.
            if (is_callable($purge)) {
                $purge();
                $called[] = $purge;
            }
        }

        foreach (self::ACTIONS as $action) {
            do_action($action);
        }

        /**
         * Fires when WConvert has purged what it knows how to purge.
         *
         * @since 0.1.0
         */
        do_action(self::PURGED);

        self::$lastPurged = array_map(static fn (string $purge): string => self::PURGES[$purge], $called);
        return $called;
    }

    /**
     * The page caches the last purge in this request reached, by product
     * name, so a reply can say what it cleared. Empty before any purge.
     *
     * @return list<string>
     */
    public static function lastPurged(): array
    {
        return self::$lastPurged;
    }

    /** Forget the last purge, so a caller can tell whether its own act caused one. */
    public static function forgetLastPurge(): void
    {
        self::$lastPurged = [];
    }
}

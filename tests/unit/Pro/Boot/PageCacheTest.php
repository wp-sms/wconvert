<?php

namespace WConvert\Tests\Unit\Pro\Boot;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Pro\Bootstrap;
use WConvert\Pro\Boot\PageCache;

require_once __DIR__ . '/../../Support/installed-cache-plugins.php';

/**
 * =============================================================================
 * ACTIVATING OR DEACTIVATING PRO PURGES THE PAGE CACHE.
 * =============================================================================
 * [[Pro]] replaces free's loader and dequeues it (ADR 0014), so turning Pro on
 * or off **changes the asset URL every cached page already carries**. A
 * full-page cache is the whole reason the loader is shaped the way it is
 * (ADR 0004), and it is exactly what would keep serving the old URL.
 *
 * This is a concrete, synchronous, plugin-lifecycle trigger. ADR 0014 replaced
 * the loader prototype's vaguer "an entitlement change must purge the page
 * cache" with it precisely because **there is no licence webhook in this design
 * to miss** — a licence never gated a feature (ADR 0015), so the only event
 * that changes what a page loads is a plugin going on or off, and WordPress
 * hands us both.
 *
 * WHAT A PURGE IS NOT. WordPress has no page-cache API, so no purge can be
 * complete: a CDN, a host-level Varnish or a reverse proxy we were never told
 * about will all keep their copy. The design therefore does not rest on it —
 * a stale page keeps working in both directions, because free's loader is
 * still on disk after Pro activates and Pro's is still on disk after it
 * deactivates. The purge is what makes the change take effect PROMPTLY, not
 * what keeps the site working.
 */
#[CoversClass(PageCache::class)]
#[CoversClass(Bootstrap::class)]
final class PageCacheTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestActions'] = [];
        $GLOBALS['wconvertTestPurgesCalled'] = [];
    }

    /**
     * Pro's plugin file calls this once, at file scope, so both hooks are
     * registered before WordPress can fire either. The guard inside makes a
     * second call a no-op, which is why this may be called from more than one
     * test in the same process.
     */
    private static function proPluginFileLoads(): void
    {
        Bootstrap::init();
    }

    /** @param 'activate'|'deactivate' $moment */
    private static function wordPressFires(string $moment): void
    {
        foreach ($GLOBALS['wconvertTestLifecycle'][$moment] as $callback) {
            $callback();
        }
    }

    /**
     * The function-shaped caches — WP Super Cache and the rest — are reached
     * by calling a function they define. `tests/unit/Support/installed-cache-plugins.php`
     * declares one, in the global namespace, exactly as the plugin would.
     */
    public function testItCallsThePurgeFunctionAnInstalledCacheDefines(): void
    {
        PageCache::purge();

        $this->assertContains('wp_cache_clear_cache', $GLOBALS['wconvertTestPurgesCalled']);
    }

    /**
     * Some caches expose a static method rather than a function, which is why
     * the list holds NAMES asked with `is_callable()` rather than function
     * names asked with `function_exists()` — one list, because that is the
     * point at which the difference stops mattering. Cache Enabler is the one
     * that proves the second shape works.
     */
    public function testItCallsThePurgeMethodAnInstalledCacheDefines(): void
    {
        PageCache::purge();

        $this->assertContains('Cache_Enabler::clear_complete_cache', $GLOBALS['wconvertTestPurgesCalled']);
    }

    /**
     * And the ones that listen on an action instead — LiteSpeed, Nginx
     * Helper — get the action fired whether they are there or not, because
     * firing an action nobody is listening to costs nothing and asking
     * "is this plugin installed" first would be a second list to keep.
     */
    public function testItFiresTheActionsTheOtherCachesListenOn(): void
    {
        $fired = [];

        foreach (['litespeed_purge_all', 'rt_nginx_helper_purge_all'] as $action) {
            add_action($action, static function () use ($action, &$fired): void {
                $fired[] = $action;
            });
        }

        PageCache::purge();

        $this->assertSame(['litespeed_purge_all', 'rt_nginx_helper_purge_all'], $fired);
    }

    /**
     * Plus one of our own, for the cache nobody here has heard of — a host's
     * mu-plugin, a CDN, the next WP Rocket. It is the extension point that
     * keeps the list above from having to be complete, which it cannot be.
     */
    public function testItFiresAnActionOfItsOwnForEverythingElse(): void
    {
        $fired = false;

        add_action(PageCache::PURGED, static function () use (&$fired): void {
            $fired = true;
        });

        PageCache::purge();

        $this->assertTrue($fired);
    }

    /**
     * The ordinary case is a site with no cache plugin at all, and a purge
     * that fataled there would take activation down with it — a plugin that
     * cannot be activated, on a site that had nothing wrong with it.
     */
    public function testActivatingProPurgesThePageCache(): void
    {
        self::proPluginFileLoads();

        self::wordPressFires('activate');

        $this->assertContains('wp_cache_clear_cache', $GLOBALS['wconvertTestPurgesCalled']);
    }

    /**
     * And deactivating, which is the direction it would be easy to forget:
     * every cached page is then pointing at Pro's loader on a site that no
     * longer enqueues it, so the merchant's premium Triggers keep running
     * until the cache turns over.
     */
    public function testDeactivatingProPurgesThePageCache(): void
    {
        self::proPluginFileLoads();

        self::wordPressFires('deactivate');

        $this->assertContains('wp_cache_clear_cache', $GLOBALS['wconvertTestPurgesCalled']);
    }

    public function testAPurgeThatIsNotInstalledIsSkippedRatherThanCalled(): void
    {
        PageCache::purge();

        // WP Rocket is not on this site, and the two tests above prove the
        // list is not empty — so this is the skip working rather than the
        // whole loop doing nothing.
        $this->assertNotContains('rocket_clean_domain', $GLOBALS['wconvertTestPurgesCalled']);
        $this->assertNotSame([], $GLOBALS['wconvertTestPurgesCalled']);
    }
}

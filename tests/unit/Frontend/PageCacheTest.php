<?php

namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Container\CoreServiceProvider;
use WConvert\Container\ServiceContainer;
use WConvert\Database\Connection;
use WConvert\Frontend\PageCache;
use WConvert\Pro\Bootstrap;
use WConvert\Pro\Container\ProServiceProvider;
use WConvert\Queue\Queue;
use WConvert\Storage\OptionStore;
use WConvert\Storage\TransientStore;
use WConvert\Support\ProPresence;
use WConvert\Support\SitePresence;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeQueue;
use WConvert\Tests\Unit\Support\FakeSitePresence;
use WConvert\Tests\Unit\Support\FakeTransientStore;

require_once __DIR__ . '/../Support/installed-cache-plugins.php';

/**
 * =============================================================================
 * WHAT A CACHED PAGE CARRIES CHANGED, SO THE PAGE CACHE IS PURGED.
 * =============================================================================
 * Two events change it. The published set — inlined into every page — changes
 * when a campaign is published, paused or edited, and free purges on that
 * (ADR 0150). Pro going on or off changes the loader's asset URL (ADR 0014),
 * and Pro's lifecycle hooks purge on that.
 *
 * WHAT A PURGE IS NOT. WordPress has no page-cache API, so no purge can be
 * complete: a CDN, a host-level Varnish or a reverse proxy we were never told
 * about will all keep their copy. The design therefore does not rest on it.
 * The purge is what makes a change take effect PROMPTLY, not what keeps the
 * site working.
 */
#[CoversClass(PageCache::class)]
#[CoversClass(CoreServiceProvider::class)]
#[CoversClass(Bootstrap::class)]
final class PageCacheTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestActions'] = [];
        $GLOBALS['wconvertTestPurgesCalled'] = [];
    }

    protected function tearDown(): void
    {
        // Booting Pro registers its filters, and a suite that left them
        // behind would run every later test on a Pro install (ADR 0116).
        $GLOBALS['wconvertTestFilters'] = [];
        $GLOBALS['wconvertTestActions'] = [];
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
     * The providers as `plugins_loaded` boots them, against fakes for
     * everything that would reach the database.
     *
     * @param list<class-string<\WConvert\Container\ServiceProvider>> $providers
     */
    private static function boot(array $providers): void
    {
        /** @var ServiceContainer $container */
        $container = (new \ReflectionClass(ServiceContainer::class))->newInstanceWithoutConstructor();
        $booting = [];

        foreach ($providers as $class) {
            $provider = new $class();
            $provider->register($container);
            $booting[] = $provider;
        }

        $container->register(Connection::class, static fn (): Connection => new FakeConnection());
        $container->register(OptionStore::class, static fn (): OptionStore => new FakeOptionStore());
        $container->register(TransientStore::class, static fn (): TransientStore => new FakeTransientStore());
        $container->register(Queue::class, static fn (): Queue => new FakeQueue());
        $container->register(ProPresence::class, static fn (): ProPresence => new FakeProPresence());
        $container->register(SitePresence::class, static fn (): SitePresence => new FakeSitePresence());

        foreach ($booting as $provider) {
            $provider->boot($container);
        }
    }

    /**
     * #275. Pausing a campaign early is a free act, so the cached page that
     * still shows it has to be cleared on a site with no Pro at all.
     */
    public function testWithOnlyFreeBootedAChangeToThePublishedSetPurges(): void
    {
        self::boot([CoreServiceProvider::class]);

        do_action('wconvert_published_set_changed');

        $this->assertContains('wp_cache_clear_cache', $GLOBALS['wconvertTestPurgesCalled']);
    }

    /**
     * Pro's analytics module used to hook the same purge. With both booted it
     * must still run once per change, not once per plugin.
     */
    public function testFreeAndProTogetherPurgeOncePerChange(): void
    {
        self::boot([CoreServiceProvider::class, ProServiceProvider::class]);

        do_action('wconvert_published_set_changed');

        $this->assertSame(
            ['wp_cache_clear_cache', 'Cache_Enabler::clear_complete_cache'],
            $GLOBALS['wconvertTestPurgesCalled']
        );
    }

    /**
     * What an agent's publish or pause reply will name (#284): the caches that
     * were installed and called, and nothing that was skipped.
     */
    public function testItReturnsTheNamesOfThePurgesItCalled(): void
    {
        $this->assertSame(
            ['wp_cache_clear_cache', 'Cache_Enabler::clear_complete_cache'],
            PageCache::purge()
        );
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
     * Turning Pro on changes the loader URL every cached page carries.
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

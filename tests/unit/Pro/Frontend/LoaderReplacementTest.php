<?php

namespace WConvert\Tests\Unit\Pro\Frontend;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Frontend\LoaderEnqueue;
use WConvert\Pro\Frontend\ProLoaderEnqueue;

/**
 * =============================================================================
 * EXACTLY ONE LOADER ON THE PAGE, AND IT IS PRO'S.
 * =============================================================================
 * [[Pro]] ships a COMPLETE replacement front-end loader and dequeues free's
 * (ADR 0014). There is no registration seam, no second script, and never two
 * loaders on one page.
 *
 * **This is asserted against the hazard rather than the happy path.** The
 * rejected alternative — free's loader plus a small entitled add-on that
 * registers premium rule types — needs the second script to register before
 * the first evaluates, which is precisely the failure the loader prototype
 * catalogued: Autoptimize's *Aggregate JS-files* + *Force JavaScript in
 * `<head>`* moved the loader above its payload, stripped its `defer`, and
 * killed every popup silently, with nothing in any log (ADR 0004).
 *
 * Replacement is immune to that by construction, and the seam below is where
 * the immunity lives. **An optimizer only ever sees the output of the script
 * queue.** The dequeue happens in PHP, on `wp_enqueue_scripts`, before one byte
 * of HTML exists — so a queue that holds one loader when that hook finishes
 * cannot become a page that holds two, whatever is then done to the tag's
 * position or its attributes.
 *
 * WHAT THIS DOES NOT PROVE, SAID OUT LOUD. Free's own `enqueue()` is not run
 * here: it reads WordPress's query globals through `RequestContextFactory`,
 * and stubbing those would put fourteen functions in `tests/bootstrap.php` to
 * simulate a page rather than test one. So free's half is stood in for by the
 * one call it makes, spelled with free's OWN handle and priority constants so
 * neither can drift. The end-to-end half — both plugins active on a real
 * WordPress, one `<script>` in the printed source, and a third-party script
 * depending on free's handle unable to bring it back — needs real
 * `WP_Dependencies` and is proven in `bin/verify-loader-replacement.php`.
 */
#[CoversClass(ProLoaderEnqueue::class)]
final class LoaderReplacementTest extends TestCase
{
    /**
     * A tree with a built loader in it.
     *
     * Not `pro/public/`, which is a build output and gitignored: a test
     * depending on it would pass on a machine that had run `npm run build` and
     * fail everywhere else.
     */
    private const PRO_TREE = __DIR__ . '/../../../fixtures/loader-replacement/pro/';

    /** A real directory with no built loader under it — this one. */
    private const PRO_TREE_WITHOUT_A_BUILD = __DIR__ . '/';

    private const PRO_URL = 'https://example.test/wp-content/plugins/wconvert-pro/';

    private const FREE_URL = 'https://example.test/wp-content/plugins/wconvert/';

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestScripts'] = ['registered' => [], 'enqueued' => []];
        $GLOBALS['wconvertTestActions'] = [];
    }

    /**
     * Free's half of the page, as one line.
     *
     * `LoaderEnqueue`'s own constants rather than literals: the handle Pro
     * dequeues and the priority it outruns are free's to change, and this is
     * the only thing standing between a rename there and a silent two-loader
     * page here.
     */
    private static function freeEnqueuesItsLoader(): void
    {
        add_action(
            'wp_enqueue_scripts',
            static fn () => wp_enqueue_script(
                LoaderEnqueue::HANDLE,
                self::FREE_URL . 'public/loader/loader.js',
                [],
                '1',
                true
            ),
            LoaderEnqueue::PRIORITY
        );
    }

    private static function pro(string $tree = self::PRO_TREE): ProLoaderEnqueue
    {
        return new ProLoaderEnqueue($tree, self::PRO_URL);
    }

    /** @return list<array-key> Every script handle the page would load. */
    private static function enqueued(): array
    {
        return array_keys($GLOBALS['wconvertTestScripts']['enqueued']);
    }

    public function testAPageWithBothPluginsActiveCarriesExactlyOneLoaderAndItIsPros(): void
    {
        self::freeEnqueuesItsLoader();
        self::pro()->hooks();

        do_action('wp_enqueue_scripts');

        $this->assertSame([ProLoaderEnqueue::HANDLE], self::enqueued());
    }

    /**
     * The ordering must not depend on which plugin WordPress loaded first.
     *
     * Pro is `wconvert-pro`, free is `wconvert`, and WordPress loads active
     * plugins in the order they appear in its own option — so the alphabet is
     * not on our side and a swap that worked because Pro's file happened to be
     * read second would work by accident. Pro registers LATER on the same hook
     * instead, which is a fact about the priority rather than about the load
     * order.
     */
    public function testTheSwapHoldsWhenProRegistersBeforeFree(): void
    {
        self::pro()->hooks();
        self::freeEnqueuesItsLoader();

        do_action('wp_enqueue_scripts');

        $this->assertSame([ProLoaderEnqueue::HANDLE], self::enqueued());
    }

    /** Pro's bundle from Pro's plugin directory — never free's, which is a different plugin. */
    public function testTheReplacementLoadsFromProsOwnPluginDirectory(): void
    {
        self::freeEnqueuesItsLoader();
        self::pro()->hooks();

        do_action('wp_enqueue_scripts');

        $this->assertSame(
            self::PRO_URL . 'public/loader/loader.js',
            $GLOBALS['wconvertTestScripts']['registered'][ProLoaderEnqueue::HANDLE]['src']
        );
    }

    /**
     * An Optin that does not match this page costs the page nothing — not a
     * script, not a byte of payload (ADR 0003). Pro must not undo that: on a
     * page where free enqueued no loader there is nothing to replace, and
     * enqueuing Pro's anyway would put a script on every page on the site.
     */
    public function testAPageFreeLeftAloneStaysAlone(): void
    {
        self::pro()->hooks();

        do_action('wp_enqueue_scripts');

        $this->assertSame([], self::enqueued());
    }

    /**
     * ========================================================================
     * A BROKEN PRO DEGRADES TO FREE, NEVER TO NOTHING.
     * ========================================================================
     * An incomplete Pro build — a ZIP that unpacked badly, a partial FTP
     * upload — must not take the site's popups down with it. Dequeuing free's
     * loader and pointing at a bundle that is not there would 404 on every
     * page and leave every Optin dead, which is the same silent, total loss of
     * function ADR 0004 exists to prevent, arriving through a missing file
     * instead of through an optimizer.
     *
     * So the dequeue is CONDITIONAL ON THE REPLACEMENT EXISTING. The merchant
     * loses `exit_intent` until they reinstall, and keeps everything else.
     */
    public function testFreesLoaderIsLeftAloneWhenProsOwnBundleIsMissing(): void
    {
        self::freeEnqueuesItsLoader();
        self::pro(self::PRO_TREE_WITHOUT_A_BUILD)->hooks();

        do_action('wp_enqueue_scripts');

        $this->assertSame([LoaderEnqueue::HANDLE], self::enqueued());
    }

    /**
     * And it says so. A Pro that quietly does nothing is indistinguishable
     * from a Pro that is working, so the merchant reads the missing premium
     * features as a bug in the product rather than as something they can fix —
     * the same reasoning as `BootGuard::noticeRefusal()`.
     */
    public function testAMissingProBundleIsReportedRatherThanSwallowed(): void
    {
        self::freeEnqueuesItsLoader();
        self::pro(self::PRO_TREE_WITHOUT_A_BUILD)->hooks();

        do_action('wp_enqueue_scripts');

        $this->assertArrayHasKey('admin_notices', $GLOBALS['wconvertTestActions']);
    }

    /**
     * ========================================================================
     * THE HANDLE IS DEREGISTERED AS WELL AS DEQUEUED.
     * ========================================================================
     * `wp_dequeue_script()` alone takes it out of the queue and leaves the
     * handle REGISTERED — and WordPress prints the registered dependencies of
     * anything that is queued. So one third-party script declaring
     * `wconvert-loader` as a dependency would put free's loader back on a page
     * that already has Pro's, which is the exact state ADR 0014 says can never
     * occur.
     *
     * This assertion was inert on the first pass, and it is worth saying why:
     * the script-queue stub held ONE array, so dequeuing and deregistering
     * were the same `unset()` and deleting the `wp_deregister_script()` line
     * left every test green. The stub models the two sets now. What it still
     * cannot prove is the resurrection itself — that needs real
     * `WP_Dependencies`, and `bin/verify-loader-replacement.php` enqueues a
     * dependent script against a real WordPress to prove it.
     */
    public function testTheFreeHandleIsGoneRatherThanMerelyUnqueued(): void
    {
        self::freeEnqueuesItsLoader();
        self::pro()->hooks();

        do_action('wp_enqueue_scripts');

        $this->assertFalse(wp_script_is(LoaderEnqueue::HANDLE, 'registered'), 'still registered, so a dependent could bring it back');
        $this->assertFalse(wp_script_is(LoaderEnqueue::HANDLE, 'enqueued'));
    }

    /**
     * And the guard that decides whether to swap at all reads the QUEUE, not
     * the registry. A handle that free registered and did not enqueue is a
     * page free chose to leave alone, and Pro must leave it alone too.
     */
    public function testARegisteredButUnqueuedLoaderIsNotAPageToReplace(): void
    {
        wp_register_script(LoaderEnqueue::HANDLE, self::FREE_URL . 'public/loader/loader.js', [], '1');
        self::pro()->hooks();

        do_action('wp_enqueue_scripts');

        $this->assertSame([], self::enqueued());
        $this->assertTrue(wp_script_is(LoaderEnqueue::HANDLE, 'registered'), 'free\'s registration was taken away from it');
    }
}

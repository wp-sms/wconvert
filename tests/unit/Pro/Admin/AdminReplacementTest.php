<?php

namespace WConvert\Tests\Unit\Pro\Admin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Admin\AdminMenu;
use WConvert\Admin\AdminNotices;
use WConvert\Optin\PublishedSet;
use WConvert\Pro\Admin\ProAdminEnqueue;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * =============================================================================
 * EXACTLY ONE ADMIN BUNDLE ON THE SCREEN, AND IT IS PRO'S.
 * =============================================================================
 * The sibling of `tests/unit/Pro/Frontend/LoaderReplacementTest.php`, one
 * bundle over, because ADR 0014's rule now reaches the admin: [[Pro]] ships a
 * COMPLETE replacement admin bundle — free's screens plus its own, composed in
 * Pro's entry where the bundler can see them — and dequeues free's.
 *
 * **This is asserted against the hazard rather than the happy path.** The
 * rejected alternative is runtime injection: free's bundle boots, Pro's second
 * script finds free's React on the page and mounts extra screens into it. That
 * needs the second script to run after the first has mounted, which is a
 * load-order contract across two script tags — the exact failure ADR 0004
 * catalogues on the front end, where an optimizer moved the loader above its
 * payload and killed every popup silently.
 *
 * It also puts a SECOND React one bundling mistake away, and this repository
 * has already paid for that once: `ViteHelper`'s hashed entry exists because a
 * `?ver` query gave the browser two module records for one file, and the
 * builder's first `useState` threw *"Invalid hook call"* against a copy of
 * React that had never rendered it. The screen went blank; every test passed.
 *
 * Replacement is immune by construction, and the seam below is where the
 * immunity lives: **the swap happens in PHP, on `admin_enqueue_scripts`,
 * before one byte of HTML exists.**
 *
 * WHAT THIS DOES NOT PROVE, SAID OUT LOUD. The queue here RECORDS what it was
 * handed; WordPress's is a dependency graph. So the one claim it cannot make
 * is that nothing can put free's bundle back — a dependent whose dependency is
 * deregistered is resolved by `WP_Dependencies::all_deps()`, and a stub that
 * re-implemented that would make itself the authority on what WordPress does.
 * `bin/verify-admin-replacement.php` proves it against the real thing.
 */
#[CoversClass(ProAdminEnqueue::class)]
final class AdminReplacementTest extends TestCase
{
    /**
     * A tree with a built admin bundle in it.
     *
     * Not `pro/public/`, which is a build output and gitignored: a test
     * depending on it would pass on a machine that had run `npm run build` and
     * fail everywhere else. Both halves of the split build are there, because
     * both are what `ViteHelper` requires (#73).
     */
    private const PRO_TREE = __DIR__ . '/../../../fixtures/admin-replacement/pro/';

    /** A real directory with no built admin bundle under it — this one. */
    private const PRO_TREE_WITHOUT_A_BUILD = __DIR__ . '/';

    private const PRO_URL = 'https://example.test/wp-content/plugins/wconvert-pro/';

    private const FREE_URL = 'https://example.test/wp-content/plugins/wconvert/';

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestScripts'] = ['registered' => [], 'enqueued' => []];
        $GLOBALS['wconvertTestStyles'] = ['registered' => [], 'enqueued' => []];
        $GLOBALS['wconvertTestActions'] = [];
        $GLOBALS['wconvertTestInlineScripts'] = [];
        $GLOBALS['wconvertTestScriptTranslations'] = [];
        $GLOBALS['wconvertTestScriptCatalogues'] = [];
    }

    /**
     * Free's half of the screen, as two lines.
     *
     * `AdminMenu`'s own constants rather than literals: the handle Pro dequeues
     * and the priority it outruns are free's to change, and this is the only
     * thing standing between a rename there and a silent two-React screen here.
     *
     * The inline settings are part of free's half deliberately — they are what
     * the replacement has to carry across, and a stand-in that left them out
     * would let the assertion below pass on a Pro that dropped them.
     */
    private static function freeEnqueuesItsAdmin(): void
    {
        add_action(
            'admin_enqueue_scripts',
            static function (): void {
                wp_enqueue_style(AdminMenu::SCRIPT_HANDLE, self::FREE_URL . 'public/admin/main.css', [], '1');
                wp_enqueue_script(
                    AdminMenu::SCRIPT_HANDLE,
                    self::FREE_URL . 'public/admin/main-1234abcd.js',
                    ['wp-i18n', 'wp-api-fetch'],
                    null,
                    true
                );
                wp_add_inline_script(AdminMenu::SCRIPT_HANDLE, 'window.wconvertAdmin = {};', 'before');
            },
            AdminMenu::PRIORITY
        );
    }

    private static function pro(string $tree = self::PRO_TREE): ProAdminEnqueue
    {
        return new ProAdminEnqueue($tree, self::PRO_URL, new AdminNotices(new PublishedSet(new FakeOptionStore())));
    }

    /** @return list<array-key> Every script handle the screen would load. */
    private static function enqueued(): array
    {
        return array_keys($GLOBALS['wconvertTestScripts']['enqueued']);
    }

    public function testAScreenWithBothPluginsActiveCarriesExactlyOneAdminBundleAndItIsPros(): void
    {
        self::freeEnqueuesItsAdmin();
        self::pro()->hooks();

        do_action('admin_enqueue_scripts');

        $this->assertSame([ProAdminEnqueue::HANDLE], self::enqueued());
    }

    /**
     * The ordering must not depend on which plugin WordPress loaded first.
     *
     * Pro is `wconvert-pro`, free is `wconvert`, and WordPress loads active
     * plugins in the order they appear in its own option — so the alphabet is
     * not on our side and a swap that worked because Pro's file happened to be
     * read second would work by accident. Pro registers LATER on the same hook
     * instead, derived from free's own constant.
     */
    public function testTheSwapHoldsWhenProRegistersBeforeFree(): void
    {
        self::pro()->hooks();
        self::freeEnqueuesItsAdmin();

        do_action('admin_enqueue_scripts');

        $this->assertSame([ProAdminEnqueue::HANDLE], self::enqueued());
    }

    /** Pro's bundle from Pro's plugin directory — never free's, which is a different plugin. */
    public function testTheReplacementLoadsFromProsOwnPluginDirectory(): void
    {
        self::freeEnqueuesItsAdmin();
        self::pro()->hooks();

        do_action('admin_enqueue_scripts');

        $this->assertSame(
            self::PRO_URL . 'public/admin/main-abc12345.js',
            $GLOBALS['wconvertTestScripts']['registered'][ProAdminEnqueue::HANDLE]['src']
        );
    }

    /**
     * Free decides WHETHER a screen carries the admin bundle at all — it
     * matches on the hook suffix `add_menu_page()` returned. Pro decides WHICH.
     * Enqueuing unconditionally would put 140 kB of React on every page of
     * wp-admin.
     */
    public function testAScreenFreeLeftAloneStaysAlone(): void
    {
        self::pro()->hooks();

        do_action('admin_enqueue_scripts');

        $this->assertSame([], self::enqueued());
    }

    /**
     * ========================================================================
     * THE HANDLE IS DEREGISTERED AS WELL AS DEQUEUED.
     * ========================================================================
     * `wp_dequeue_script()` alone takes it out of the queue and leaves the
     * handle REGISTERED — and WordPress prints the registered dependencies of
     * anything that is queued. So one third-party script declaring
     * `wconvert-admin` as a dependency would put free's app back on a screen
     * that already has Pro's: two React roots fighting over one mount node.
     */
    public function testTheFreeHandleIsGoneRatherThanMerelyUnqueued(): void
    {
        self::freeEnqueuesItsAdmin();
        self::pro()->hooks();

        do_action('admin_enqueue_scripts');

        $this->assertFalse(
            wp_script_is(AdminMenu::SCRIPT_HANDLE, 'registered'),
            'still registered, so a dependent could bring it back'
        );
        $this->assertFalse(wp_script_is(AdminMenu::SCRIPT_HANDLE, 'enqueued'));
    }

    /**
     * **And so does the stylesheet.** `ViteHelper` registers one per handle and
     * Pro's build emits its own, so leaving free's would load two Tailwind
     * sheets that differ only in which tree they were scanned from — the later
     * one winning by cascade rather than by decision.
     */
    public function testFreesStylesheetIsReplacedRatherThanStacked(): void
    {
        self::freeEnqueuesItsAdmin();
        self::pro()->hooks();

        do_action('admin_enqueue_scripts');

        $this->assertSame([ProAdminEnqueue::HANDLE], array_keys($GLOBALS['wconvertTestStyles']['enqueued']));
        $this->assertFalse(wp_style_is(AdminMenu::SCRIPT_HANDLE, 'registered'));
    }

    /**
     * ========================================================================
     * THE SETTINGS SURVIVE THE SWAP, BECAUSE THEY BELONG TO A HANDLE.
     * ========================================================================
     * `wp_add_inline_script()` attaches to a handle, so free's
     * `window.wconvertAdmin` is deregistered along with free's script. A Pro
     * install would then boot the admin with no export URL, no policy link and
     * no inspector door — every one of which fails as a MISSING FEATURE rather
     * than as an error, which is the shape that ships.
     *
     * Pro attaches the same values, read from `AdminMenu::settings()` rather
     * than spelled a second time.
     */
    public function testTheScreensSettingsAreAttachedToTheReplacement(): void
    {
        self::freeEnqueuesItsAdmin();
        self::pro()->hooks();

        do_action('admin_enqueue_scripts');

        $inline = $GLOBALS['wconvertTestInlineScripts'][ProAdminEnqueue::HANDLE] ?? [];
        $settings = array_values(array_filter(
            $inline,
            static fn (array $script): bool => str_contains($script['data'], 'window.wconvertAdmin')
        ));

        $this->assertCount(1, $settings, 'the replacement boots with no settings at all');
        $this->assertSame('before', $settings[0]['position'], 'the settings run after the bundle that reads them');

        foreach (['exportUrl', 'policyUrl', 'homeUrl', 'inspectParam', 'dev'] as $key) {
            $this->assertStringContainsString($key, $settings[0]['data'], $key . ' was lost in the swap');
        }
    }

    /**
     * ========================================================================
     * TWO CATALOGUES ON ONE HANDLE, WHICH IS ALL WORDPRESS ALLOWS ONE OF.
     * ========================================================================
     * Pro's bundle is free's screens plus Pro's, so it holds strings from
     * `wconvert` AND `wconvert-pro`. `wp_set_script_translations()` binds ONE
     * domain to a handle — call it twice and the second replaces the first — so
     * free's is bound (it is almost all of the strings) and Pro's is handed to
     * `wp.i18n` directly.
     *
     * Without this every Pro string renders in English on a translated site,
     * and nothing anywhere says why.
     */
    public function testProsOwnCatalogueArrivesBesideFreesRatherThanInsteadOfIt(): void
    {
        $GLOBALS['wconvertTestScriptCatalogues'][ProAdminEnqueue::HANDLE . '|wconvert-pro'] =
            (string) json_encode(['locale_data' => ['messages' => ['' => [], 'Exit intent' => ['Absicht zu gehen']]]]);

        self::freeEnqueuesItsAdmin();
        self::pro()->hooks();

        do_action('admin_enqueue_scripts');

        $this->assertSame(
            'wconvert',
            $GLOBALS['wconvertTestScriptTranslations'][ProAdminEnqueue::HANDLE] ?? null,
            'free\'s domain is the one bound to the handle'
        );

        $inline = $GLOBALS['wconvertTestInlineScripts'][ProAdminEnqueue::HANDLE] ?? [];
        $locale = array_values(array_filter(
            $inline,
            static fn (array $script): bool => str_contains($script['data'], 'setLocaleData')
        ));

        $this->assertCount(1, $locale, 'Pro\'s own strings have no catalogue on the page');
        $this->assertStringContainsString('wconvert-pro', $locale[0]['data']);
        $this->assertStringContainsString('Absicht zu gehen', $locale[0]['data']);
    }

    /** An untranslated locale has no catalogue, which is normal rather than a fault. */
    public function testAnUntranslatedLocaleAddsNothingRatherThanAnEmptyCall(): void
    {
        self::freeEnqueuesItsAdmin();
        self::pro()->hooks();

        do_action('admin_enqueue_scripts');

        foreach ($GLOBALS['wconvertTestInlineScripts'][ProAdminEnqueue::HANDLE] ?? [] as $script) {
            $this->assertStringNotContainsString('setLocaleData', $script['data']);
        }
    }

    /**
     * ========================================================================
     * A BROKEN PRO DEGRADES TO FREE, NEVER TO NOTHING.
     * ========================================================================
     * An incomplete Pro build — a ZIP that unpacked badly, a partial upload —
     * must not take the merchant's admin screen down with it. Dequeuing free's
     * bundle while pointing at one that is not there renders a blank `<div>`
     * with a 404 in a console nobody has open, and the merchant cannot reach
     * the screen that would tell them to reinstall.
     *
     * So the dequeue is CONDITIONAL ON THE REPLACEMENT EXISTING.
     */
    public function testFreesAdminBundleIsLeftAloneWhenProsOwnBuildIsMissing(): void
    {
        self::freeEnqueuesItsAdmin();
        self::pro(self::PRO_TREE_WITHOUT_A_BUILD)->hooks();

        do_action('admin_enqueue_scripts');

        $this->assertSame([AdminMenu::SCRIPT_HANDLE], self::enqueued());
        $this->assertTrue(wp_script_is(AdminMenu::SCRIPT_HANDLE, 'registered'));
        $this->assertTrue(wp_style_is(AdminMenu::SCRIPT_HANDLE, 'enqueued'));
    }

    /**
     * **Both halves of the split build, not just the entry** (#73).
     *
     * The entry alone booting is not the screen working: the builder, the
     * gallery and the settings panel live in a chunk the entry `import()`s the
     * moment a merchant opens the builder — which is the one moment nobody is
     * reading a build log. A Pro that shipped one and not the other would
     * replace free's working screen with one that fails on the fifth click.
     */
    public function testAProBuildMissingOnlyTheBuilderChunkStillDegradesToFree(): void
    {
        $halfBuilt = sys_get_temp_dir() . '/wconvert-half-built-' . bin2hex(random_bytes(6));
        mkdir($halfBuilt . '/public/admin', 0777, true);
        file_put_contents($halfBuilt . '/public/admin/main-abc12345.js', "console.log('entry');\n");

        try {
            self::freeEnqueuesItsAdmin();
            self::pro($halfBuilt . '/')->hooks();

            do_action('admin_enqueue_scripts');

            $this->assertSame([AdminMenu::SCRIPT_HANDLE], self::enqueued());
        } finally {
            unlink($halfBuilt . '/public/admin/main-abc12345.js');
            rmdir($halfBuilt . '/public/admin');
            rmdir($halfBuilt . '/public');
            rmdir($halfBuilt);
        }
    }

    /**
     * And it says so. A Pro that quietly shows free's screen is
     * indistinguishable from a Pro that is working, so the merchant reads the
     * missing premium screens as a bug in the product rather than as something
     * they can fix — the same reasoning as `BootGuard::noticeRefusal()`.
     *
     * Through free's notices object rather than `admin_notices`, because that
     * hook is emptied on exactly this screen (ADR 0035).
     */
    public function testAMissingProBundleIsReportedRatherThanSwallowed(): void
    {
        $notices = new AdminNotices(new PublishedSet(new FakeOptionStore()));

        self::freeEnqueuesItsAdmin();
        (new ProAdminEnqueue(self::PRO_TREE_WITHOUT_A_BUILD, self::PRO_URL, $notices))->hooks();

        do_action('admin_enqueue_scripts');

        ob_start();
        $notices->render();
        $rendered = (string) ob_get_clean();

        $this->assertStringContainsString('WConvert Pro', $rendered);
    }

    /**
     * And the guard that decides whether to swap at all reads the QUEUE, not
     * the registry. A handle free registered and did not enqueue is a screen
     * free chose to leave alone, and Pro must leave it alone too.
     */
    public function testARegisteredButUnqueuedBundleIsNotAScreenToReplace(): void
    {
        wp_register_script(AdminMenu::SCRIPT_HANDLE, self::FREE_URL . 'public/admin/main-1234abcd.js', [], null);
        self::pro()->hooks();

        do_action('admin_enqueue_scripts');

        $this->assertSame([], self::enqueued());
        $this->assertTrue(wp_script_is(AdminMenu::SCRIPT_HANDLE, 'registered'), 'free\'s registration was taken away from it');
    }
}

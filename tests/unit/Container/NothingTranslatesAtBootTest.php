<?php

namespace WConvert\Tests\Unit\Container;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Container\AdminServiceProvider;
use WConvert\Container\CoreServiceProvider;
use WConvert\Container\PrivacyServiceProvider;
use WConvert\Container\ServiceContainer;
use WConvert\Container\ServiceProvider;
use WConvert\Database\Connection;
use WConvert\Frontend\InlineOptinBlock;
use WConvert\Frontend\InlineOptinShortcode;
use WConvert\Pro\Container\ProServiceProvider;
use WConvert\Queue\Queue;
use WConvert\Rest\BeaconController;
use WConvert\Rest\CaptureController;
use WConvert\Rest\DashboardController;
use WConvert\Rest\MonthlyTargetsController;
use WConvert\Rest\MilestoneController;
use WConvert\Rest\DestinationController;
use WConvert\Rest\GoalController;
use WConvert\Rest\LeadController;
use WConvert\Rest\OptinController;
use WConvert\Rest\PlaybookController;
use WConvert\Rest\PickerController;
use WConvert\Rest\RestController;
use WConvert\Rest\Routes;
use WConvert\Rest\RuleController;
use WConvert\Rest\TemplateController;
use WConvert\Rest\ThemeController;
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
use WConvert\Tests\Unit\Support\PhpSource;
use WP_REST_Request;

/**
 * =============================================================================
 * BOOT HOOKS. IT DOES NOT BUILD, AND IT DOES NOT TRANSLATE.
 * =============================================================================
 * Every provider's `boot()` runs on `plugins_loaded`, which is before `init`,
 * and WordPress refuses to translate before `init`. What that costs is argued
 * once, where the fix lives —
 * {@see \WConvert\Container\CoreServiceProvider::boot()} — and not restated
 * here.
 *
 * What belongs here is why nothing in this suite could see #52. `boot()`
 * resolved all eleven REST controllers to reach the one `add_action` each of
 * them held, and building `PlaybookController` `require`s seven [[Playbook]]
 * files whose every string is wrapped in `__()` (ADR 0013). Fifty-seven
 * translations before `init`, on every request of every install, with the whole
 * suite green — because this suite has no `init` and stubbed `__()` as a
 * passthrough. So it grew the one fact WordPress carries and it did not:
 * `$GLOBALS['wconvertTestInitHasFired']`, which `tests/bootstrap.php` refuses
 * to translate while it is false. This turns it off for the length of a real
 * boot.
 *
 * **THAT IS WHY THIS TEST BOOTS EVERY PROVIDER RATHER THAN THE PLAYBOOK
 * LIBRARY.** The bug was not that Playbooks translate — they must, or the
 * library ships English to every locale. It was WHEN they were asked to. A test
 * aimed at the library would pass while the next constructor that reaches for a
 * word reopens the ticket; this one fails on any of them, in either plugin.
 */
#[CoversClass(CoreServiceProvider::class)]
final class NothingTranslatesAtBootTest extends TestCase
{
    private const ROOT = __DIR__ . '/../../..';

    /**
     * The route each controller is reached by, keyed by the controller.
     *
     * Keyed rather than a bare list so it cannot drift: the keys are asserted
     * against `CoreServiceProvider::REST_CONTROLLERS`, which is itself asserted
     * against `src/Rest`. A twelfth controller therefore fails here by name
     * rather than by a count nobody reads.
     *
     * One route per controller and named rather than counted, because a
     * controller that stops registering should be an absence with a name.
     *
     * @var array<class-string<RestController>, string>
     */
    private const A_ROUTE_PER_CONTROLLER = [
        \WConvert\Rest\JourneyStatsController::class => '/optins/(?P<id>[A-Z0-9]{26})/journey-stats',
        \WConvert\Rest\ProductStatsController::class => "/optins/(?P<id>[A-Z0-9]{26})/product-stats",
        \WConvert\Rest\ProductHealthController::class => '/optins/product-health',
        OptinController::class => '/optins',
        TemplateController::class => '/templates',
        \WConvert\Rest\TemplateCatalogController::class => '/template-catalog',
        \WConvert\Rest\TemplateTransferController::class => '/template-transfer',
        RuleController::class => '/rules',
        ThemeController::class => '/theme',
        GoalController::class => '/goals',
        PlaybookController::class => '/playbooks',
        PickerController::class => '/picker',
        CaptureController::class => '/capture',
        BeaconController::class => '/beacon',
        LeadController::class => '/leads',
        DashboardController::class => '/dashboard',
        MonthlyTargetsController::class => '/monthly-targets',
        MilestoneController::class => '/milestones',
        DestinationController::class => '/destinations',
        \WConvert\Rest\PrivacyController::class => '/privacy/data-map',
        \WConvert\Rest\ProtectionController::class => '/protection',
    ];

    /**
     * Every way WordPress can be asked for a word.
     *
     * The vocabulary is closed and small, so it is written out; what is NOT
     * written out is which of them WConvert uses, because that is the half that
     * changes. {@see self::testEveryTranslatingStubGoesThroughTheGate} reads the
     * shipped source for the ones actually called and holds the bootstrap to
     * gating each.
     *
     * @var list<string>
     */
    private const WAYS_TO_ASK_FOR_A_WORD = [
        '__', '_e', '_n', '_nx', '_x', '_ex', '_n_noop', '_nx_noop', 'translate',
        'esc_html__', 'esc_html_e', 'esc_html_x',
        'esc_attr__', 'esc_attr_e', 'esc_attr_x',
    ];

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestActions'] = [];
        $GLOBALS['wconvertTestFilters'] = [];
        $GLOBALS['wconvertTestRoutes'] = [];
        $GLOBALS['wconvertTestIsAdmin'] = false;
        $GLOBALS['wconvertTestInitHasFired'] = true;
    }

    protected function tearDown(): void
    {
        // Booting Pro registers its filters — the journeys capability among
        // them — and a suite that left them behind would run every later test
        // on a Pro install (ADR 0116).
        $GLOBALS['wconvertTestFilters'] = [];
        $GLOBALS['wconvertTestIsAdmin'] = false;
        $GLOBALS['wconvertTestInitHasFired'] = true;
    }

    /**
     * @return array<string, array{bool}>
     */
    public static function requests(): array
    {
        // Both sides of the one branch the providers take. The notice was
        // REPORTED under WP-CLI and wp-admin, and it fires on a front-end page
        // load too — so a test that only booted one side would have watched
        // half the installs it affects.
        return ['a front-end request' => [false], 'a wp-admin request' => [true]];
    }

    #[DataProvider('requests')]
    public function testBootingTheProvidersAsksForNoTranslation(bool $isAdmin): void
    {
        $GLOBALS['wconvertTestIsAdmin'] = $isAdmin;

        $this->boot();

        // Reaching here is the assertion — a translation on the boot path
        // throws from the stub, naming the string and the line that asked. The
        // hook below is what boot is FOR, so it is asserted in the same breath
        // rather than left as an untested consequence of a passing negative.
        $this->assertArrayHasKey(
            'rest_api_init',
            $GLOBALS['wconvertTestActions'],
            'boot registered nothing on rest_api_init, so no WConvert route can ever exist'
        );
    }

    /**
     * ========================================================================
     * THE BLOCK AND THE SHORTCODE, ON `init`, ON BOTH SIDES.
     * ========================================================================
     * `register_block_type()` reads `block.json` and translates its `title`
     * and `description` through the i18n schema, so it is a #52 in waiting:
     * registered from `boot()` it would ask WordPress for a word on
     * `plugins_loaded`, on every request of every install. That half is
     * asserted by the negative above — a translation there throws from the
     * stub — and this is the positive it needs beside it, because a
     * registration deferred to a hook that is never added translates nothing
     * either.
     *
     * **Both sides of `is_admin()`, and that is the regression worth naming.**
     * Every other front-end thing in this provider sits behind `if
     * (!is_admin())`, so the shape of this file invites a fourth. It cannot be
     * one: the block's editor script is enqueued in wp-admin while its
     * `render_callback` runs on the visitor's page, and the shortcode is
     * parsed on the front end while the classic editor needs the tag to exist
     * in wp-admin. Behind `is_admin()` in either direction, half of each
     * surface silently stops working.
     */
    #[DataProvider('requests')]
    public function testTheInlineOptinSurfacesRegisterOnInitOnEitherSide(bool $isAdmin): void
    {
        $GLOBALS['wconvertTestIsAdmin'] = $isAdmin;
        $GLOBALS['wconvertTestBlocks'] = [];
        $GLOBALS['wconvertTestShortcodes'] = [];

        $this->boot();

        $this->assertSame(
            [],
            $GLOBALS['wconvertTestBlocks'],
            'a block was registered on plugins_loaded, which is where block.json asks to be translated'
        );

        do_action('init');

        $this->assertArrayHasKey(
            InlineOptinBlock::NAME,
            $GLOBALS['wconvertTestBlocks'],
            'no block registered on init, so an inline Optin cannot be placed from the block editor'
        );

        $this->assertArrayHasKey(
            InlineOptinShortcode::TAG,
            $GLOBALS['wconvertTestShortcodes'],
            'no shortcode registered on init, so an inline Optin cannot be placed anywhere the block is not'
        );
    }

    public function testNoRouteIsBuiltUntilOneIsServed(): void
    {
        $this->boot();

        $this->assertSame(
            [],
            $GLOBALS['wconvertTestRoutes'],
            'a route was registered on plugins_loaded, which means its controller was built there too'
        );

        do_action('rest_api_init');

        $registered = array_column($GLOBALS['wconvertTestRoutes'], 'route');

        $this->assertSame(
            CoreServiceProvider::REST_CONTROLLERS,
            array_keys(self::A_ROUTE_PER_CONTROLLER),
            'a controller is on the provider list with no route named for it here, so nothing below covers it'
        );

        foreach (self::A_ROUTE_PER_CONTROLLER as $controller => $route) {
            $this->assertContains(
                $route,
                $registered,
                sprintf('%s registered no route on rest_api_init', $controller)
            );
        }

        $this->assertSame(
            [Routes::NAMESPACE],
            array_values(array_unique(array_column($GLOBALS['wconvertTestRoutes'], 'namespace'))),
            'every WConvert route shares one namespace'
        );
    }

    public function testRegisteringRoutesAndServingABeaconNeverReadsTheAuthoringCatalog(): void
    {
        $this->boot();
        $GLOBALS['wconvertTestInitHasFired'] = false;
        $hadRemoteAddress = array_key_exists('REMOTE_ADDR', $_SERVER);
        $remoteAddress = $_SERVER['REMOTE_ADDR'] ?? null;
        $_SERVER['REMOTE_ADDR'] = '198.51.100.24';

        try {
            do_action('rest_api_init');

            $beacon = null;
            foreach ($GLOBALS['wconvertTestRoutes'] as $registered) {
                if ($registered['route'] === '/beacon') {
                    $beacon = $registered['args'][0]['callback'];
                    break;
                }
            }

            $this->assertIsCallable($beacon, 'the public beacon route was not registered');
            $request = new WP_REST_Request('POST', '/wconvert/v1/beacon');
            $request->set_header('user-agent', 'Mozilla/5.0');
            $request->set_body('{"events":[]}');
            $response = $beacon($request);

            $this->assertSame(204, $response->get_status());
        } finally {
            $GLOBALS['wconvertTestInitHasFired'] = true;
            if ($hadRemoteAddress) {
                $_SERVER['REMOTE_ADDR'] = $remoteAddress;
            } else {
                unset($_SERVER['REMOTE_ADDR']);
            }
        }
    }

    public function testAuthoringRoutesLoadTheCombinedFreeAndProCatalogOnDemand(): void
    {
        // A Pro install that knows it is one: free sends no locked design at
        // all (ADR 0116), so Pro's designs only appear where Pro is the rung.
        $this->boot(new FakeProPresence(\WConvert\Support\Tier::Elite));
        do_action('rest_api_init');

        $callbacks = [];
        foreach ($GLOBALS['wconvertTestRoutes'] as $registered) {
            if (in_array($registered['route'], ['/templates', '/playbooks'], true)) {
                $callbacks[$registered['route']] = $registered['args'][0]['callback'];
            }
        }

        $this->assertIsCallable($callbacks['/templates'] ?? null);
        $templates = $callbacks['/templates']()->get_data()['templates'];
        $templateIds = array_column($templates, 'id');
        $this->assertContains('reading-slip', $templateIds, 'free designs disappeared from the composed gallery');
        $this->assertContains('fullscreen-editorial', $templateIds, 'Pro designs were not composed into the gallery');

        $this->assertIsCallable($callbacks['/playbooks'] ?? null);
        $request = new WP_REST_Request('GET', '/wconvert/v1/playbooks');
        $request->set_param('goal', 'grow_email_list');
        $playbooks = $callbacks['/playbooks']($request)->get_data();
        $this->assertContains('welcome-discount', array_column($playbooks, 'id'));
        $this->assertContains('fullscreen-newsletter', array_column($playbooks, 'id'));
    }

    /**
     * A controller that is not on the list registers no route at all — and a
     * route that does not exist fails as a 404 from the admin screen calling
     * it, which names nothing. So the list is checked against the directory
     * rather than trusted.
     */
    public function testEveryRestControllerIsOnTheList(): void
    {
        $listed = CoreServiceProvider::REST_CONTROLLERS;

        $this->assertSame($listed, array_values(array_unique($listed)), 'a controller is listed twice');

        // The whole of free's tree, not `src/Rest` alone. A controller filed
        // somewhere else is still a controller, and a sweep of the one
        // directory would let it register nothing while reporting that nothing
        // is missing — the exact failure this test exists to prevent.
        //
        // Pro's tree is deliberately NOT swept: Pro binds its own services into
        // the container free created (ADR 0015), so a Pro controller belongs on
        // Pro's provider and demanding it here would be free naming Pro.
        $found = [];
        // `phpUnder()` answers in real paths and ROOT is written with `..`, so
        // the prefix the PSR-4 name is cut from has to be resolved too.
        $src = (string) realpath(self::ROOT . '/src') . '/';

        foreach (self::phpUnder(self::ROOT . '/src') as $file) {
            $name = basename($file, '.php');

            // A file that declares no class of its own name is not a PSR-4
            // class file — `src/constants.php` is the one that exists — and
            // asking `is_subclass_of()` about it would autoload it, which for
            // that file means running it. Checked in the source rather than
            // guessed from the filename's case.
            if (preg_match('/\bclass\s+' . preg_quote($name, '/') . '\b/', PhpSource::code($file)) !== 1) {
                continue;
            }

            $class = 'WConvert\\' . str_replace('/', '\\', substr($file, strlen($src), -4));

            if (is_subclass_of($class, RestController::class)) {
                $found[] = $class;
            }
        }

        $this->assertNotEmpty($found, 'src/ holds no controllers — nothing was inspected, so nothing is proven');

        sort($found);
        $sorted = $listed;
        sort($sorted);

        $this->assertSame($sorted, $found, 'CoreServiceProvider::REST_CONTROLLERS and src/Rest disagree');
    }

    /**
     * The gate is only worth what it covers.
     *
     * Everything above rests on the bootstrap's `__()` refusing before `init`.
     * A stub that translates without asking is a hole the whole file cannot
     * see, and the hole arrives the ordinary way: someone needs `_x()` for a
     * string with context, copies the passthrough two stubs up, and #52 comes
     * back with every test green.
     *
     * So which functions must be gated is read off the shipped source rather
     * than listed — the same instrument as
     * {@see self::testEveryRestControllerIsOnTheList}, pointed at the other
     * list this file depends on.
     */
    public function testEveryTranslatingStubGoesThroughTheGate(): void
    {
        $used = [];

        foreach (self::shippedSources() as $file) {
            $used = array_merge($used, self::asksForAWordIn($file));
        }

        $used = array_values(array_unique($used));
        sort($used);

        $this->assertNotEmpty($used, 'no translation call was found in src/ — nothing was inspected, so nothing is proven');

        $bootstrap = PhpSource::code(__DIR__ . '/../../bootstrap.php');

        foreach ($used as $function) {
            // The stub, from its signature to the closing brace of the `if`
            // block it sits in — enough to see whether the gate is called and
            // small enough not to reach the next stub down.
            $found = preg_match(
                sprintf('/function %s\s*\([^)]*\)[^{]*\{(.*?)\n\}/s', preg_quote($function, '/')),
                $bootstrap,
                $body
            );

            $this->assertSame(1, $found, sprintf('%s() is called by WConvert and tests/bootstrap.php does not stub it', $function));
            $this->assertStringContainsString(
                'wconvert_test_translate',
                $body[1],
                sprintf('%s() translates without going through the gate, so a call to it before `init` passes', $function)
            );
        }
    }

    /**
     * Which of {@see self::WAYS_TO_ASK_FOR_A_WORD} this file calls.
     *
     * Tokenised rather than grepped, for the reason {@see PhpSource} gives:
     * this codebase writes at length about `__()` in comments, and a scan that
     * could not tell a comment from a call would demand a gate for a word that
     * was only ever discussed. A method or class constant of the same name is
     * excluded for the same reason.
     *
     * @return list<string>
     */
    private static function asksForAWordIn(string $file): array
    {
        $tokens = array_values(array_filter(
            token_get_all((string) file_get_contents($file)),
            static fn ($token): bool => !is_array($token)
                || !in_array($token[0], [T_COMMENT, T_DOC_COMMENT, T_WHITESPACE], true)
        ));

        $found = [];

        foreach ($tokens as $i => $token) {
            if (!is_array($token) || $token[0] !== T_STRING || !in_array($token[1], self::WAYS_TO_ASK_FOR_A_WORD, true)) {
                continue;
            }

            $before = $tokens[$i - 1] ?? null;
            $isMember = is_array($before) && in_array($before[0], [T_OBJECT_OPERATOR, T_DOUBLE_COLON, T_FUNCTION], true);

            if (($tokens[$i + 1] ?? null) === '(' && !$isMember) {
                $found[] = $token[1];
            }
        }

        return $found;
    }

    /**
     * Every PHP file that ships, in both plugins.
     *
     * @return list<string>
     */
    private static function shippedSources(): array
    {
        $files = array_merge(self::phpUnder(self::ROOT . '/src'), self::phpUnder(self::ROOT . '/pro/src'));

        // The bundled Playbooks are where #52's fifty-seven calls live, and
        // they are data rather than classes — so they are outside `src/` and
        // would be missed by a sweep that only walked it.
        foreach ((array) glob(self::ROOT . '/resources/playbooks/*.php') as $playbook) {
            $files[] = (string) $playbook;
        }

        return $files;
    }

    /**
     * Every `.php` file under a directory, sorted, as absolute paths.
     *
     * @return list<string>
     */
    private static function phpUnder(string $directory): array
    {
        $files = [];

        /** @var iterable<\SplFileInfo> $iterator */
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $files[] = (string) $file->getRealPath();
            }
        }

        sort($files);

        return $files;
    }

    /**
     * Every provider on the site, registered and booted with `init` declared
     * not to have fired.
     *
     * The three free ones go exactly as {@see \WConvert\Bootstrap::init()} does
     * it — every one registered before any one is booted. **Pro's is here too**,
     * because the rule is the plugin's rather than free's: Pro hangs its own
     * `plugins_loaded` callback at priority 20 and binds into this same
     * container (ADR 0015), so a boot path that translates is a boot path that
     * translates whichever tree wrote it. It boots LAST, which is the order a
     * site loads them in.
     *
     * Only the leaves that reach WordPress itself are replaced. Everything
     * above them is the real object graph off the real manifests and the real
     * Playbook directory, because a boot that built fakes would prove nothing
     * about what the shipped one builds.
     */
    private function boot(?ProPresence $pro = null): ServiceContainer
    {
        $container = self::container();

        /** @var list<ServiceProvider> $providers */
        $providers = [];

        $registrations = [
            CoreServiceProvider::class,
            PrivacyServiceProvider::class,
            AdminServiceProvider::class,
            ProServiceProvider::class,
        ];

        foreach ($registrations as $class) {
            $provider = new $class();
            $provider->register($container);
            $providers[] = $provider;
        }

        $container->register(Connection::class, static fn (): Connection => new FakeConnection());
        $container->register(OptionStore::class, static fn (): OptionStore => new FakeOptionStore());
        $container->register(TransientStore::class, static fn (): TransientStore => new FakeTransientStore());
        $container->register(Queue::class, static fn (): Queue => new FakeQueue());
        $container->register(ProPresence::class, static fn (): ProPresence => $pro ?? new FakeProPresence());
        $container->register(SitePresence::class, static fn (): SitePresence => new FakeSitePresence());

        $GLOBALS['wconvertTestInitHasFired'] = false;

        try {
            foreach ($providers as $provider) {
                $provider->boot($container);
            }
        } finally {
            // `init` has fired by the time anything a provider hooked runs, so
            // it is put back before the test touches one — including this
            // file's own `rest_api_init`, where translating is correct.
            $GLOBALS['wconvertTestInitHasFired'] = true;
        }

        return $container;
    }

    /**
     * A container of this test's own.
     *
     * {@see ServiceContainer} is a singleton because a site has one, and Pro
     * binds into it rather than standing up a second (ADR 0015). A test wants
     * a fresh one per case, and the constructor it cannot call is empty.
     */
    private static function container(): ServiceContainer
    {
        /** @var ServiceContainer $container */
        $container = (new \ReflectionClass(ServiceContainer::class))->newInstanceWithoutConstructor();

        return $container;
    }
}

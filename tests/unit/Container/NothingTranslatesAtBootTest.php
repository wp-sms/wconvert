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
use WConvert\Queue\Queue;
use WConvert\Rest\RestController;
use WConvert\Rest\Routes;
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

/**
 * =============================================================================
 * BOOT HOOKS. IT DOES NOT BUILD, AND IT DOES NOT TRANSLATE.
 * =============================================================================
 * Every provider's `boot()` runs on `plugins_loaded`, which is **before
 * `init`** — and WordPress refuses to translate before `init`. A `__()` there
 * makes it load a text domain early, which since 6.7 prints
 * `_load_textdomain_just_in_time was called incorrectly` DURING
 * `plugins_loaded`: output begins before `<!DOCTYPE html>`, nothing after it
 * can set a header, and the request breaks in ways that have nothing to do
 * with WConvert. The string does not come back translated either, because it
 * was asked for before there was a domain to translate it against.
 *
 * #52 was exactly that, and nothing in this suite could see it. `boot()`
 * resolved all eleven REST controllers in order to reach the one
 * `add_action('rest_api_init', …)` each of them held, and building
 * `PlaybookController` `require`s seven [[Playbook]] files whose every string
 * is wrapped in `__()` (ADR 0013). Fifty-seven translations before `init`, on
 * every request of every install, with the whole suite green — because this
 * suite has no `init` and stubbed `__()` as a passthrough.
 *
 * So the suite grew the one fact WordPress carries and it did not:
 * `$GLOBALS['wconvertTestInitHasFired']`, which the stubs in
 * `tests/bootstrap.php` refuse to translate while it is false. This turns it
 * off for the length of a real boot.
 *
 * **THAT IS WHY THIS TEST BOOTS EVERYTHING RATHER THAN THE PLAYBOOK LIBRARY.**
 * The bug was not that Playbooks translate — they must, or the library ships
 * English to every locale. It was WHEN they were asked to. A test aimed at the
 * library would pass while the next constructor that reaches for a word
 * reopens the ticket; this one fails on any of them.
 */
#[CoversClass(CoreServiceProvider::class)]
final class NothingTranslatesAtBootTest extends TestCase
{
    /**
     * The route each of the eleven controllers is reached by.
     *
     * One per controller and written here rather than derived, so a controller
     * that stops registering is a named absence rather than a smaller number.
     */
    private const A_ROUTE_PER_CONTROLLER = [
        '/optins',
        '/templates',
        '/rules',
        '/theme',
        '/goals',
        '/playbooks',
        '/capture',
        '/beacon',
        '/leads',
        '/dashboard',
        '/destinations',
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

        foreach (self::A_ROUTE_PER_CONTROLLER as $route) {
            $this->assertContains($route, $registered, sprintf('%s is not registered on rest_api_init', $route));
        }

        $this->assertSame(
            [Routes::NAMESPACE],
            array_values(array_unique(array_column($GLOBALS['wconvertTestRoutes'], 'namespace'))),
            'every WConvert route shares one namespace'
        );
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

        $found = [];

        foreach ((array) glob(__DIR__ . '/../../../src/Rest/*.php') as $file) {
            $class = 'WConvert\\Rest\\' . basename((string) $file, '.php');

            if (is_subclass_of($class, RestController::class)) {
                $found[] = $class;
            }
        }

        $this->assertNotEmpty($found, 'src/Rest holds no controllers — nothing was inspected, so nothing is proven');

        sort($found);
        $sorted = $listed;
        sort($sorted);

        $this->assertSame($sorted, $found, 'CoreServiceProvider::REST_CONTROLLERS and src/Rest disagree');
    }

    /**
     * The three free providers, registered and booted exactly as
     * {@see \WConvert\Bootstrap::init()} does it — every one registered before
     * any one is booted — with `init` declared not to have fired.
     *
     * Only the leaves that reach WordPress itself are replaced. Everything
     * above them is the real object graph off the real manifests and the real
     * Playbook directory, because a boot that built fakes would prove nothing
     * about what the shipped one builds.
     */
    private function boot(): ServiceContainer
    {
        $container = self::container();

        /** @var list<ServiceProvider> $providers */
        $providers = [];

        foreach ([CoreServiceProvider::class, PrivacyServiceProvider::class, AdminServiceProvider::class] as $class) {
            $provider = new $class();
            $provider->register($container);
            $providers[] = $provider;
        }

        $container->register(Connection::class, static fn (): Connection => new FakeConnection());
        $container->register(OptionStore::class, static fn (): OptionStore => new FakeOptionStore());
        $container->register(TransientStore::class, static fn (): TransientStore => new FakeTransientStore());
        $container->register(Queue::class, static fn (): Queue => new FakeQueue());
        $container->register(ProPresence::class, static fn (): ProPresence => new FakeProPresence());
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

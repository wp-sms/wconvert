<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\DashboardController;
use WConvert\Rest\Routes;
use WConvert\Rules\RuleVocabulary;
use WConvert\Stats\Dashboard;
use WConvert\Stats\StatRange;
use WConvert\Stats\StatsRepository;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * The analytics route's REGISTRATION, which is where two of its guarantees
 * live and nowhere else.
 *
 * **The caller sends days or a month, never its own current date.** The screen says
 * "Today", and that has to mean the merchant's today (ADR 0019) — a browser
 * asked for a date would answer with the VISITOR's day, and a merchant abroad
 * would be handed yesterday's window and told it was today's. So `days` is the
 * rolling window; `month` names a calendar month capped by the site's yesterday
 * (ADR 0090). The absence of a caller-supplied `from` and `to` is the thing
 * being asserted.
 *
 * **And it is read-only.** A counter cannot be recomputed, so a write route
 * here is one that can destroy a merchant's history permanently (ADR 0019).
 * That is invisible to any test that goes through the controller's one method.
 */
#[CoversClass(DashboardController::class)]
final class DashboardRouteTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];

        $db = new FakeConnection();

        (new DashboardController(new Dashboard(
            new StatsRepository($db),
            new OptinRepository(
                $db,
                new PublishedSet(new FakeOptionStore()),
                RuleVocabulary::fromManifest(__DIR__ . '/../../..'),
                new MilestoneStore(new FakeOptionStore()
            ))
        )))->registerRoutes();
    }

    /**
     * @return array{namespace: string, route: string, args: array<mixed>}
     */
    private static function dashboardRoute(): array
    {
        /** @var list<array{namespace: string, route: string, args: array<mixed>}> $routes */
        $routes = $GLOBALS['wconvertTestRoutes'];

        foreach ($routes as $route) {
            if ($route['route'] === '/dashboard') {
                return $route;
            }
        }

        self::fail('the dashboard route was never registered');
    }

    public function testItRegistersOneRouteInTheOneNamespace(): void
    {
        /** @var list<array<string, mixed>> $routes */
        $routes = $GLOBALS['wconvertTestRoutes'];

        $this->assertCount(1, $routes);
        $this->assertSame(Routes::NAMESPACE, self::dashboardRoute()['namespace']);
    }

    /**
     * **Read-only, with no exception.** The only writer of a counter is the
     * beacon counting one act, and a counter cannot be recomputed if a route
     * here got it wrong (ADR 0019).
     */
    public function testTheAnalyticsRouteReadsAndNothingElse(): void
    {
        /** @var list<array{methods: string}> $handlers */
        $handlers = self::dashboardRoute()['args'];

        $this->assertSame(['GET'], array_column($handlers, 'methods'));
    }

    /**
     * Every WConvert route is an administration surface, and this one has no
     * structural reason to be an exception the way the capture endpoint and
     * the beacon do.
     */
    public function testItIsBehindTheOneCapability(): void
    {
        /** @var list<array{permission_callback: mixed}> $handlers */
        $handlers = self::dashboardRoute()['args'];

        $this->assertSame([Routes::class, 'canManage'], $handlers[0]['permission_callback']);
    }

    /**
     * ========================================================================
     * THE ASSERTION THIS FILE EXISTS FOR.
     * ========================================================================
     * There is no `from` and no `to`. A date parameter is how the merchant's
     * today would quietly become the visitor's browser's today, and the window
     * can only ever end on the day the SERVER says it is.
     */
    public function testTheWindowIsAskedForInDaysAndNeverInDates(): void
    {
        /** @var list<array{args: array<string, mixed>}> $handlers */
        $handlers = self::dashboardRoute()['args'];

        $this->assertSame(['complete', 'month', 'days'], array_keys($handlers[0]['args']));
    }

    public function testNamedMonthOverridesRollingDaysAndRejectsFutureMonths(): void
    {
        $db = new FakeConnection();
        $options = new FakeOptionStore();
        $controller = new DashboardController(new Dashboard(new StatsRepository($db), new OptinRepository(
            $db, new PublishedSet($options), RuleVocabulary::fromManifest(__DIR__ . '/../../..'), new MilestoneStore($options)
        )));
        $request = new \WP_REST_Request();
        $request->set_param('month', '2024-02');
        $request->set_param('days', 7);
        $response = $controller->index($request);
        self::assertInstanceOf(\WP_REST_Response::class, $response);
        $report = $response->get_data();
        self::assertSame(['2024-02', '2024-02-01', '2024-02-29', 29], [$report['month'], $report['from'], $report['to'], $report['days']]);
        self::assertTrue($report['complete_days']);
        $request->set_param('month', '9999-01');
        $error = $controller->index($request);
        self::assertInstanceOf(\WP_Error::class, $error);
        self::assertSame(400, $error->get_error_data()['status']);
    }

    /**
     * The cap is {@see StatRange}'s, read off it rather than restated — it is
     * the number that keeps a scan of the counters a scan of one year, and a
     * second spelling here would be one to keep in step.
     */
    public function testTheWindowIsBoundedByTheSameNumberTheRangeEnforces(): void
    {
        /** @var list<array{args: array<string, array<string, mixed>>}> $handlers */
        $handlers = self::dashboardRoute()['args'];
        $days = $handlers[0]['args']['days'];

        $this->assertSame('integer', $days['type']);
        $this->assertSame(1, $days['minimum']);
        $this->assertSame(StatRange::MAX_DAYS, $days['maximum']);
        $this->assertSame(StatRange::DEFAULT_DAYS, $days['default']);
    }
}

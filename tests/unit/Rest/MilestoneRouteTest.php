<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Milestone\Milestones;
use WConvert\Milestone\MilestoneStore;
use WConvert\Rest\MilestoneController;
use WConvert\Rest\Routes;
use WConvert\Stats\StatsRepository;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * The milestone route's REGISTRATION, which is where its two guarantees live
 * and nowhere else.
 *
 * **It takes nothing.** Every argument the dashboard route makes for asking in
 * days rather than dates applies here by not applying at all: a milestone has
 * no window, so there is nothing a caller could narrow and nothing anybody can
 * move. A `days` parameter creeping onto this route would be the first step
 * towards a "first conversion" that changed when somebody switched from 30
 * days to 7.
 *
 * **And it is read-only.** Two of the five cannot be recomputed from anything
 * (ADR 0019) and the other two are recorded once by design, so a write route
 * here is one that can destroy the only copy of a fact.
 */
#[CoversClass(MilestoneController::class)]
final class MilestoneRouteTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];

        $options = new FakeOptionStore();

        (new MilestoneController(new Milestones(
            new MilestoneStore($options),
            new StatsRepository(new FakeConnection()),
            new HealthStore($options),
            new DestinationStore($options)
        )))->registerRoutes();
    }

    /**
     * @return array{namespace: string, route: string, args: array<mixed>}
     */
    private static function milestoneRoute(): array
    {
        /** @var list<array{namespace: string, route: string, args: array<mixed>}> $routes */
        $routes = $GLOBALS['wconvertTestRoutes'];

        foreach ($routes as $route) {
            if ($route['route'] === '/milestones') {
                return $route;
            }
        }

        self::fail('the milestone route was never registered');
    }

    public function testItRegistersOneRouteInTheOneNamespace(): void
    {
        /** @var list<array<string, mixed>> $routes */
        $routes = $GLOBALS['wconvertTestRoutes'];

        $this->assertCount(1, $routes);
        $this->assertSame(Routes::NAMESPACE, self::milestoneRoute()['namespace']);
    }

    public function testTheMilestoneRouteReadsAndNothingElse(): void
    {
        /** @var list<array{methods: string}> $handlers */
        $handlers = self::milestoneRoute()['args'];

        $this->assertSame(['GET'], array_column($handlers, 'methods'));
    }

    public function testItIsBehindTheOneCapability(): void
    {
        /** @var list<array{permission_callback: mixed}> $handlers */
        $handlers = self::milestoneRoute()['args'];

        $this->assertSame([Routes::class, 'canManage'], $handlers[0]['permission_callback']);
    }

    /**
     * ========================================================================
     * THE ASSERTION THIS FILE EXISTS FOR.
     * ========================================================================
     * A milestone is all-time, so the route declares no arguments at all —
     * not a window, not a date, not an Optin id. There is nothing here for a
     * caller to choose.
     */
    public function testItTakesNoParametersAtAll(): void
    {
        /** @var list<array<string, mixed>> $handlers */
        $handlers = self::milestoneRoute()['args'];

        $this->assertArrayNotHasKey('args', $handlers[0]);
    }
}

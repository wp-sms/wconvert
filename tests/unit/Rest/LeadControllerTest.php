<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Lead\LeadLog;
use WConvert\Lead\LeadRepository;
use WConvert\Rest\LeadController;
use WConvert\Rest\Routes;
use WConvert\Retention\RetentionPeriod;
use WConvert\Tests\Unit\Optin\FakeConnection;
use WConvert\Tests\Unit\Optin\FakeOptionStore;

/**
 * The lead log's route REGISTRATION, which is where two of its guarantees live
 * and nowhere else.
 *
 * **There is no write route over Leads.** A Lead has exactly one origin — a
 * visitor submitting a form, in one request, on a page WConvert served
 * (ADR 0031) — and no lifecycle to edit (ADR 0002). A `POST /leads` would be
 * the admin entry screen ADR 0031 forecloses, arriving as a REST route because
 * nobody thought of the route as a screen.
 *
 * **Grouping is one route's parameter, not a route of its own.** A second
 * endpoint is a second resource, and the resource a `/leads/people` would name
 * is the one ADR 0021 says this system cannot honestly produce.
 */
#[CoversClass(LeadController::class)]
final class LeadControllerTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];

        $controller = new LeadController(
            new LeadLog(new LeadRepository(new FakeConnection())),
            new RetentionPeriod(new FakeOptionStore())
        );

        $controller->registerRoutes();
    }

    /**
     * @return list<array{namespace: string, route: string, args: array<mixed>}>
     */
    private static function routes(): array
    {
        /** @var list<array{namespace: string, route: string, args: array<mixed>}> $routes */
        $routes = $GLOBALS['wconvertTestRoutes'];

        return $routes;
    }

    /**
     * @return list<string>
     */
    private static function methodsOn(string $route): array
    {
        foreach (self::routes() as $registered) {
            if ($registered['route'] === $route) {
                /** @var list<array{methods: string}> $handlers */
                $handlers = $registered['args'];

                return array_map(static fn (array $handler): string => $handler['methods'], $handlers);
            }
        }

        return [];
    }

    public function testTheLogIsOneReadOnlyRouteInWConvertsNamespace(): void
    {
        $this->assertSame(['GET'], self::methodsOn('/leads'));
        $this->assertSame(Routes::NAMESPACE, self::routes()[0]['namespace']);
    }

    /**
     * The whole point of this file. A write route over Leads is the admin
     * entry screen ADR 0031 forecloses, arriving by a door nobody watches.
     */
    public function testNoRouteHereWritesDeletesOrOtherwiseMutatesALead(): void
    {
        foreach (self::methodsOn('/leads') as $method) {
            $this->assertSame('GET', $method, 'ADR 0031: a Lead has exactly one origin, and it is not this');
        }
    }

    public function testGroupingIsAParameterOfTheLogRatherThanARouteOfItsOwn(): void
    {
        $paths = array_map(static fn (array $route): string => $route['route'], self::routes());

        $this->assertContains('/leads', $paths);
        $this->assertNotContains('/leads/groups', $paths);
        $this->assertNotContains('/leads/people', $paths);

        /** @var array<string, array<string, mixed>> $args */
        $args = self::routes()[0]['args'][0]['args'];

        $this->assertArrayHasKey('grouped', $args);
        $this->assertFalse($args['grouped']['default'], 'the log opens ungrouped, because submissions is the number');
    }

    /**
     * A page size the caller can raise without bound is a `fields` blob per
     * row times whatever they asked for (ADR 0001), so the cap is declared at
     * the route as well as clamped in {@see LeadLog}.
     */
    public function testThePageSizeIsCappedAtTheRoute(): void
    {
        /** @var array<string, array<string, mixed>> $args */
        $args = self::routes()[0]['args'][0]['args'];

        $this->assertSame(LeadLog::MAX_ROWS, $args['per_page']['maximum']);
    }

    /**
     * Retention is a site setting, so it is read and written — the one thing
     * on this controller that is.
     */
    public function testRetentionIsReadableAndWritable(): void
    {
        $this->assertSame(['GET', 'POST'], self::methodsOn('/leads/retention'));
    }

    /**
     * **Null is a legal period**, and it is keep-forever — what clearing the
     * field means, and what WConvert ships as (ADR 0018). A schema of
     * `integer` alone would coerce it to 0, which this reads as keep-forever
     * anyway, but only by accident of two rules agreeing.
     */
    public function testKeepForeverIsExpressibleAsNull(): void
    {
        foreach (self::routes() as $route) {
            if ($route['route'] !== '/leads/retention') {
                continue;
            }

            /** @var array<string, array<string, mixed>> $args */
            $args = $route['args'][1]['args'];

            $this->assertSame(['integer', 'null'], $args['days']['type']);
        }
    }

    public function testEveryRouteHereRequiresTheManageCapability(): void
    {
        foreach (self::routes() as $route) {
            /** @var list<array{permission_callback: mixed}> $handlers */
            $handlers = $route['args'];

            foreach ($handlers as $handler) {
                $this->assertSame([Routes::class, 'canManage'], $handler['permission_callback']);
            }
        }
    }
}

<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Lead\LeadLog;
use WP_Error;
use WP_REST_Request;
use WConvert\Lead\LeadRepository;
use WConvert\Destination\DeliveryFailures;
use WConvert\Privacy\LeadErasure;
use WConvert\Rest\LeadController;
use WConvert\Rest\Routes;
use WConvert\Retention\RetentionPeriod;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;

/**
 * The lead log's route REGISTRATION, which is where two of its guarantees live
 * and nowhere else.
 *
 * **There is no create or update route over Leads.** A Lead has exactly one origin — a
 * visitor submitting a form, in one request, on a page WConvert served
 * (ADR 0031) — and no lifecycle to edit (ADR 0002). A `POST /leads` would be
 * the admin entry screen ADR 0031 forecloses, arriving as a REST route because
 * nobody thought of the route as a screen. Exact-identifier erasure is the one
 * destructive route and deletes capture events without giving one a lifecycle
 * (ADR 0018, ADR 0093).
 *
 * **Grouping is one route's parameter, not a route of its own.** A second
 * endpoint is a second resource, and the resource a `/leads/people` would name
 * is the one ADR 0021 says this system cannot honestly produce.
 */
#[CoversClass(LeadController::class)]
final class LeadControllerTest extends TestCase
{
    private static function controller(?FakeConnection $db = null): LeadController
    {
        $db ??= new FakeConnection();
        $options = new FakeOptionStore();
        $leads = new LeadRepository($db);

        return new LeadController(
            new LeadLog($leads),
            new RetentionPeriod($options),
            new LeadErasure($leads, new DeliveryFailures($options))
        );
    }

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];

        $controller = self::controller();

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
        $this->assertSame(['POST'], self::methodsOn('/leads/query'));
        $this->assertSame(Routes::NAMESPACE, self::routes()[0]['namespace']);
    }

    /**
     * The whole point of this file. A write route over Leads is the admin
     * entry screen ADR 0031 forecloses, arriving by a door nobody watches.
     */
    public function testTheLogRouteNeverCreatesOrUpdatesALead(): void
    {
        foreach (self::methodsOn('/leads') as $method) {
            $this->assertSame('GET', $method, 'ADR 0031: a Lead has exactly one origin, and it is not this');
        }
    }

    public function testPersonalSearchValuesAreAcceptedOnlyInThePrivatePostBody(): void
    {
        /** @var array<string, array<string, mixed>> $getArgs */
        $getArgs = self::routes()[0]['args'][0]['args'];
        /** @var array<string, array<string, mixed>> $postArgs */
        $postArgs = self::routes()[1]['args'][0]['args'];

        foreach (['lead_id', 'identifier', 'search', 'group_identifier'] as $personal) {
            $this->assertArrayNotHasKey($personal, $getArgs);
            $this->assertArrayHasKey($personal, $postArgs);
        }

        $request = new WP_REST_Request('GET', '/wconvert/v1/leads');
        $request->set_param('identifier', 'sarah@example.com');
        $response = self::controller()->index($request);

        $this->assertInstanceOf(WP_Error::class, $response);
        $this->assertSame('wconvert_personal_query_in_url', $response->get_error_code());
    }

    public function testExactIdentifierErasureIsASeparateDestructiveRoute(): void
    {
        $this->assertSame(['DELETE'], self::methodsOn('/leads/identifier'));
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
    public function testAnInvalidCalendarDateReturnsAnActionableBadRequest(): void
    {
        $db = new FakeConnection();
        $controller = self::controller($db);
        $request = new WP_REST_Request('GET', '/wconvert/v1/leads');
        $request->set_param('from', '2026-02-29');
        $response = $controller->index($request);
        $this->assertInstanceOf(WP_Error::class, $response);
        $this->assertSame('wconvert_invalid_lead_query', $response->get_error_code());
        $this->assertSame(['status' => 400], $response->get_error_data());
        $this->assertSame([], $db->reads, 'Invalid filters must never fall through to a broader query.');
    }

    public function testDefaultReadIsBoundedAndCarriesItsPagingSnapshot(): void
    {
        $db = new FakeConnection();
        $db->answers = [[], []];
        $controller = self::controller($db);
        $response = $controller->index(new WP_REST_Request('GET', '/wconvert/v1/leads'));
        $this->assertNotInstanceOf(WP_Error::class, $response);
        $payload = $response->get_data();
        $this->assertNull($payload['next_cursor']);
        $this->assertIsString($payload['snapshot']);
        $this->assertSame(51, $db->reads[1]['params'][1], '50 visible rows and one lookahead.');
    }


    public function testErasureRequiresTheSameCanonicalIdentifierToBeConfirmedBeforeDeleting(): void
    {
        $db = new FakeConnection();
        $controller = self::controller($db);
        $request = new WP_REST_Request('DELETE', '/wconvert/v1/leads/identifier');
        $request->set_param('identifier', '+968 9912 3456');
        $request->set_param('confirmed_identifier', '+968 9900 0000');

        $response = $controller->eraseIdentifier($request);

        $this->assertInstanceOf(WP_Error::class, $response);
        $this->assertSame('wconvert_invalid_erasure_identifier', $response->get_error_code());
        $this->assertSame([], $db->deletes);
    }

    public function testConfirmedPhoneErasureDeletesEveryDirectMatch(): void
    {
        $db = new FakeConnection();
        $db->removes = 4;
        $controller = self::controller($db);
        $request = new WP_REST_Request('DELETE', '/wconvert/v1/leads/identifier');
        $request->set_param('identifier', '+968 9912 3456');
        $request->set_param('confirmed_identifier', '+96899123456');

        $response = $controller->eraseIdentifier($request);

        $this->assertNotInstanceOf(WP_Error::class, $response);
        $this->assertSame(['identifier' => '+96899123456', 'removed' => 4], $response->get_data());
        $this->assertSame('DELETE FROM %i WHERE phone = %s', $db->deletes[0]['sql']);
    }

}

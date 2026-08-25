<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\BeaconController;
use WConvert\Rest\RateLimit;
use WConvert\Rest\Routes;
use WConvert\Stats\StatsRepository;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeTransientStore;

/**
 * The beacon route's REGISTRATION, which is where this endpoint's shape lives
 * and nowhere else.
 *
 * Same division as {@see CaptureControllerTest}: what the controller DOES is
 * three collaborators that each have their own tests
 * ({@see \WConvert\Stats\BeaconTraffic}, {@see RateLimit},
 * {@see \WConvert\Stats\Beacon}), and what it IS — one public POST route in
 * WConvert's namespace, declaring no schema — is only visible here.
 *
 * The route end to end, dispatched through WordPress with real headers and
 * landing a real row, is `bin/verify-stats.php`. A `WP_REST_Request` faithful
 * enough to prove anything about dispatch is a WordPress install with extra
 * steps.
 */
#[CoversClass(BeaconController::class)]
#[CoversClass(Routes::class)]
final class BeaconControllerTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];

        $controller = new BeaconController(
            new PublishedSet(new FakeOptionStore()),
            new StatsRepository(new FakeConnection()),
            new RateLimit(new FakeTransientStore())
        );

        $controller->registerRoutes();
    }

    /**
     * @return array{namespace: string, route: string, args: array<mixed>}
     */
    private static function beaconRoute(): array
    {
        /** @var list<array{namespace: string, route: string, args: array<mixed>}> $routes */
        $routes = $GLOBALS['wconvertTestRoutes'];

        self::assertCount(1, $routes, 'the controller registers exactly one route');

        return $routes[0];
    }

    public function testItRegistersOnePublicPostRouteInWConvertsNamespace(): void
    {
        $route = self::beaconRoute();

        $this->assertSame(Routes::NAMESPACE, $route['namespace']);
        $this->assertSame('/beacon', $route['route']);
        $this->assertSame('POST', $route['args'][0]['methods']);
    }

    /**
     * **Public, and there is nothing here a gate would be protecting.**
     *
     * The page it fires from is served byte-identically to every visitor by the
     * full-page cache, so a nonce in it is the same nonce for everyone for the
     * cache's lifetime (ADR 0004). And the beacon is stateless — no visitor id,
     * no device id, no hashed fingerprint (ADR 0017) — so there is also no
     * consent gate on it at all.
     */
    public function testTheBeaconRouteIsPublicAndSaysSo(): void
    {
        $permission = self::beaconRoute()['args'][0]['permission_callback'];

        $this->assertSame([Routes::class, 'canBeacon'], $permission);
        $this->assertTrue(Routes::canBeacon());
    }

    /**
     * **No declared schema, deliberately.**
     *
     * A declared `'type'` runs `rest_sanitize_value_from_schema`, which
     * COERCES — and every field of this body is already checked more strictly
     * than it could be: the id against `Ulid::isOne()`, the kind against a
     * closed enum of four. A coercing layer in front of an exact one can only
     * widen what gets through, which is the same trap the capture route's
     * `consent` avoids (ADR 0032).
     */
    public function testItDeclaresNoSchemaToCoerceTheBodyWith(): void
    {
        $this->assertSame([], self::beaconRoute()['args'][0]['args']);
    }

    /**
     * **Two public permissions, and exactly two.**
     *
     * Everything else WConvert exposes is an administration surface behind
     * `manage_options`. Counting them by reflection rather than naming them is
     * what makes this an assertion about the class rather than about the two
     * somebody remembered: a third `can*` returning true unconditionally is a
     * third public route, and it should have to argue for itself here.
     */
    public function testWConvertHasExactlyTwoPublicPermissions(): void
    {
        $source = (string) file_get_contents(__DIR__ . '/../../../src/Rest/Routes.php');

        preg_match_all('/public static function (\w+)\(\): bool\s*\{\s*return true;/', $source, $matches);

        $this->assertSame(['canCapture', 'canBeacon'], $matches[1]);
    }
}

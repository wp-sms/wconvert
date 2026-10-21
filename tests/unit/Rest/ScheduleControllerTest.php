<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\Schedule;
use WConvert\Rest\Routes;
use WConvert\Rest\ScheduleController;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

#[CoversClass(ScheduleController::class)]
final class ScheduleControllerTest extends TestCase
{
    protected function tearDown(): void
    {
        unset($GLOBALS['wconvertTestTimezoneString']);
    }

    public function testResolutionIsAManageOnlyRead(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];
        (new ScheduleController())->registerRoutes();
        $route = $GLOBALS['wconvertTestRoutes'][0];
        self::assertSame('/schedule/resolve', $route['route']);
        self::assertSame(Routes::NAMESPACE, $route['namespace']);
        self::assertSame('GET', $route['args'][0]['methods']);
        self::assertSame([Routes::class, 'canManage'], $route['args'][0]['permission_callback']);
    }

    /** @return iterable<string, array{string, string, string}> */
    public static function deadlines(): iterable
    {
        yield 'UTC' => ['UTC', '2026-10-31 23:59', '2026-10-31 23:59'];
        yield 'fixed offset' => ['+04:00', '2026-10-31 23:59', '2026-10-31 19:59'];
        yield 'NY summer' => ['America/New_York', '2026-07-01 12:00', '2026-07-01 16:00'];
        yield 'NY winter' => ['America/New_York', '2026-12-01 12:00', '2026-12-01 17:00'];
        yield 'NY repeated hour' => ['America/New_York', '2026-11-01 01:30', '2026-11-01 05:30'];
        yield 'Berlin repeated hour' => ['Europe/Berlin', '2026-10-25 02:30', '2026-10-25 01:30'];
        yield 'spring gap' => ['America/New_York', '2026-03-08 02:30', '2026-03-08 07:30'];
        yield 'expired' => ['UTC', '2000-01-01 00:00', '2000-01-01 00:00'];
    }

    #[DataProvider('deadlines')]
    public function testMatchesThePublishedSchedule(string $zone, string $wall, string $utc): void
    {
        $GLOBALS['wconvertTestTimezoneString'] = $zone;
        $request = new WP_REST_Request();
        $request->set_param('ends_at', $wall);
        $response = (new ScheduleController())->resolve($request);
        self::assertInstanceOf(WP_REST_Response::class, $response);
        $expected = (new \DateTimeImmutable($utc, new \DateTimeZone('UTC')))->getTimestamp() * 1000;
        self::assertSame(['ends_at' => $expected], $response->get_data());
        self::assertSame(Schedule::windowIn(['ends_at' => $wall], new \DateTimeZone($zone)), $response->get_data());
    }

    public function testMissingAndInvalidDatesAreDifferent(): void
    {
        $request = new WP_REST_Request();
        $request->set_param('ends_at', '');
        $response = (new ScheduleController())->resolve($request);
        self::assertInstanceOf(WP_REST_Response::class, $response);
        self::assertSame(['ends_at' => null], $response->get_data());
        $request->set_param('ends_at', '2026-02-31 12:00');
        $response = (new ScheduleController())->resolve($request);
        self::assertInstanceOf(WP_Error::class, $response);
        self::assertSame(400, $response->get_error_data()['status']);
    }
}

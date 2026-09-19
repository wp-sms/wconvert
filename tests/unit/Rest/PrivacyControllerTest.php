<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Privacy\DataMap;
use WConvert\Privacy\PrivacyGuidance;
use WConvert\Rest\PrivacyController;
use WConvert\Rest\Routes;
use WConvert\Retention\RetentionPeriod;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;
use WP_REST_Request;

#[CoversClass(PrivacyController::class)]
final class PrivacyControllerTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];
    }

    public function testTheDataMapAndGuidancePreferenceAreAdminRoutes(): void
    {
        $options = new FakeOptionStore();
        $controller = new PrivacyController(new DataMap(
            new RetentionPeriod($options),
            new DestinationStore($options),
            new DestinationRegistry(new FakeProPresence(), new FakeSitePresence())
        ), new PrivacyGuidance($options));
        $controller->registerRoutes();

        /** @var list<array{namespace: string, route: string, args: array<mixed>}> $routes */
        $routes = $GLOBALS['wconvertTestRoutes'];
        $this->assertCount(2, $routes);
        $this->assertSame(Routes::NAMESPACE, $routes[0]['namespace']);
        $this->assertSame('/privacy/data-map', $routes[0]['route']);
        $this->assertSame('GET', $routes[0]['args']['methods']);
        $this->assertSame([Routes::class, 'canManage'], $routes[0]['args']['permission_callback']);

        $response = $controller->show();
        $this->assertNull($response->get_data()['retention_days']);
        $this->assertSame([], $response->get_data()['destinations']);

        $this->assertSame('/privacy/guidance', $routes[1]['route']);
        $this->assertCount(2, $routes[1]['args']);
        $this->assertSame('GET', $routes[1]['args'][0]['methods']);
        $this->assertSame('POST', $routes[1]['args'][1]['methods']);
        $this->assertSame([Routes::class, 'canManage'], $routes[1]['args'][0]['permission_callback']);
        $this->assertTrue($controller->showGuidance()->get_data()['enabled']);

        $request = new WP_REST_Request('POST', '/wconvert/v1/privacy/guidance');
        $request->set_param('enabled', false);
        $this->assertFalse($controller->updateGuidance($request)->get_data()['enabled']);
    }
}

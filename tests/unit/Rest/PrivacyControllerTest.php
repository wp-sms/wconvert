<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Privacy\DataMap;
use WConvert\Rest\PrivacyController;
use WConvert\Rest\Routes;
use WConvert\Retention\RetentionPeriod;
use WConvert\Tests\Unit\Support\FakeOptionStore;
use WConvert\Tests\Unit\Support\FakeProPresence;
use WConvert\Tests\Unit\Support\FakeSitePresence;

#[CoversClass(PrivacyController::class)]
final class PrivacyControllerTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestRoutes'] = [];
    }

    public function testTheDataMapIsAReadOnlyAdminRoute(): void
    {
        $options = new FakeOptionStore();
        $controller = new PrivacyController(new DataMap(
            new RetentionPeriod($options),
            new DestinationStore($options),
            new DestinationRegistry(new FakeProPresence(), new FakeSitePresence())
        ));
        $controller->registerRoutes();

        /** @var list<array{namespace: string, route: string, args: array<mixed>}> $routes */
        $routes = $GLOBALS['wconvertTestRoutes'];
        $this->assertCount(1, $routes);
        $this->assertSame(Routes::NAMESPACE, $routes[0]['namespace']);
        $this->assertSame('/privacy/data-map', $routes[0]['route']);
        $this->assertSame('GET', $routes[0]['args']['methods']);
        $this->assertSame([Routes::class, 'canManage'], $routes[0]['args']['permission_callback']);

        $response = $controller->show();
        $this->assertNull($response->get_data()['retention_days']);
        $this->assertSame([], $response->get_data()['destinations']);
    }
}

<?php

namespace WConvert\Tests\Unit\Onboarding;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Onboarding\ChecklistDismissal;
use WConvert\Rest\GettingStartedController;
use WConvert\Rest\Routes;

#[CoversClass(ChecklistDismissal::class)]
#[CoversClass(GettingStartedController::class)]
final class ChecklistDismissalTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestUserMeta'] = [];
        $GLOBALS['wconvertTestRoutes'] = [];
        $GLOBALS['wconvertTestUserId'] = 7;
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['wconvertTestUserId']);
    }

    public function testHidingIsPerUser(): void
    {
        $dismissal = new ChecklistDismissal();
        $dismissal->hide(7);

        $this->assertTrue($dismissal->hidden(7));
        $this->assertFalse($dismissal->hidden(8));
        $this->assertFalse($dismissal->hidden(0), 'Nobody logged in has no checklist to hide.');
    }

    public function testTheRouteHidesItForTheCurrentUserOnly(): void
    {
        $controller = new GettingStartedController(new ChecklistDismissal());
        $controller->registerRoutes();

        $route = $GLOBALS['wconvertTestRoutes'][0];
        $this->assertSame('/getting-started/hide', $route['route']);
        $this->assertSame('POST', $route['args']['methods']);
        $this->assertSame([Routes::class, 'canManage'], $route['args']['permission_callback']);

        $this->assertTrue($controller->hide()->get_data()['hidden']);
        $this->assertTrue((new ChecklistDismissal())->hidden(7));
    }
}

<?php

namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\TestCase;
use WConvert\Rest\MonthlyTargetsController;
use WConvert\Rest\Routes;
use WConvert\Stats\MonthlyTargets;
use WConvert\Stats\Dashboard;
use WConvert\Stats\StatsRepository;
use WConvert\Stats\StatDay;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Milestone\MilestoneStore;
use WConvert\Rules\RuleVocabulary;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Tests\Unit\Support\FakeOptionStore;

final class MonthlyTargetsRouteTest extends TestCase
{
    public function testReadAndSaveRequireManagementAndRejectInvalidOrStaleTargets(): void
    {
        $db = new FakeConnection();
        $options = new FakeOptionStore();
        $controller = new MonthlyTargetsController(new MonthlyTargets($options, new Dashboard(new StatsRepository($db), new OptinRepository(
            $db, new PublishedSet($options), RuleVocabulary::fromManifest(__DIR__ . '/../../..'), new MilestoneStore($options)
        ))));
        $GLOBALS['wconvertTestRoutes'] = [];
        $controller->registerRoutes();
        $route = $GLOBALS['wconvertTestRoutes'][0];
        self::assertSame('/monthly-targets', $route['route']);
        foreach ($route['args'] as $handler) self::assertSame([Routes::class, 'canManage'], $handler['permission_callback']);
        $request = new \WP_REST_Request();
        $request->set_param('month', substr(StatDay::today(), 0, 7));
        $request->set_param('targets', ['leads' => 100]);
        $saved = $controller->save($request);
        self::assertInstanceOf(\WP_REST_Response::class, $saved);
        self::assertSame(200, $saved->get_status());
        self::assertSame(100, $controller->read()->get_data()['metrics'][0]['target']);
        $request->set_param('targets', ['leads' => 0]);
        $invalid = $controller->save($request);
        self::assertInstanceOf(\WP_Error::class, $invalid);
        self::assertSame(400, $invalid->get_error_data()['status']);
        $request->set_param('month', '2000-01');
        $stale = $controller->save($request);
        self::assertInstanceOf(\WP_Error::class, $stale);
        self::assertSame(409, $stale->get_error_data()['status']);
        self::assertSame([], $db->writes);
    }
}

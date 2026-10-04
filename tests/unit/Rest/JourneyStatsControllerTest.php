<?php
namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\TestCase;
use WConvert\Rest\JourneyStatsController;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Stats\StatDay;
use WConvert\Stats\StatRange;

final class JourneyStatsControllerTest extends TestCase
{
    public function testJourneyReportUsesTheSameCompleteWindowAndBoundedQuery(): void
    {
        $db = new FakeConnection();
        $db->answers = [[]];
        $request = new \WP_REST_Request('GET', '/');
        $request->set_param('id', 'a');
        $request->set_param('days', 7);
        $request->set_param('complete', true);
        $result = (new JourneyStatsController($db))->read($request);
        self::assertInstanceOf(\WP_REST_Response::class, $result);
        $response = $result->get_data();
        $range = StatRange::completeDays(7, StatDay::today());
        self::assertSame($range->from, $response['from']);
        self::assertSame($range->to, $response['to']);
        self::assertSame(7, $response['days']);
        self::assertStringContainsString('BETWEEN', implode(' ', $db->statements));
    }
}

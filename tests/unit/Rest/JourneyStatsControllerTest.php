<?php
namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\TestCase;
use WConvert\Rest\JourneyStatsController;
use WConvert\Tests\Unit\Support\FakeConnection;
use WConvert\Stats\StatDay;
use WConvert\Stats\StatRange;
use WConvert\Support\Ulid;

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

    /**
     * The interests window is a primary-key range, not a `created_at` one.
     * Both name the same Leads (ADR 0033), but only the key can be ranged:
     * on `created_at` a quiet Campaign walked the whole log (1.6 s at 1M rows).
     */
    public function testInterestsBoundTheWindowByThePrimaryKey(): void
    {
        $db = new FakeConnection();
        $db->answers = [[]];
        $request = new \WP_REST_Request('GET', '/');
        $request->set_param('id', '01J0000000AAAAAAAAAAAAAAAA');
        $request->set_param('from', '2026-09-01');
        $request->set_param('to', '2026-09-30');
        (new JourneyStatsController($db))->interests($request);
        $read = $db->reads[0];
        self::assertStringNotContainsString('created_at', $read['sql']);
        self::assertStringContainsString('optin_id = %s AND id >= %s AND id < %s', $read['sql']);
        // The site is UTC under test: September opens at 1788220800 and October at 1790812800.
        self::assertSame(['01J0000000AAAAAAAAAAAAAAAA', Ulid::floorAt(1_788_220_800_000), Ulid::floorAt(1_790_812_800_000)], $read['params']);
    }
}

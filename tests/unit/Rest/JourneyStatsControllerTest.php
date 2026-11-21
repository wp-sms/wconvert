<?php
namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\TestCase;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\JourneyStatsController;
use WConvert\Storage\WpOptionStore;
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
        $result = (new JourneyStatsController($db, new PublishedSet(new WpOptionStore())))->read($request);
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
     * on `created_at` a quiet Optin walked the whole log (1.6 s at 1M rows).
     */
    public function testInterestsBoundTheWindowByThePrimaryKey(): void
    {
        $db = new FakeConnection();
        $db->answers = [[]];
        $request = new \WP_REST_Request('GET', '/');
        $request->set_param('id', '01J0000000AAAAAAAAAAAAAAAA');
        $request->set_param('from', '2026-09-01');
        $request->set_param('to', '2026-09-30');
        (new JourneyStatsController($db, new PublishedSet(new WpOptionStore())))->interests($request);
        $read = $db->reads[0];
        self::assertStringNotContainsString('created_at', $read['sql']);
        self::assertStringContainsString('optin_id = %s AND id >= %s AND id < %s', $read['sql']);
        // The site is UTC under test: September opens at 1788220800 and October at 1790812800.
        self::assertSame(['01J0000000AAAAAAAAAAAAAAAA', Ulid::floorAt(1_788_220_800_000), Ulid::floorAt(1_790_812_800_000)], $read['params']);
    }

    /**
     * The screen names a report labels its rows with are merchant text, so
     * they are stored as ASCII JSON (#424) and have to come back as the list
     * they were, emoji and all, not as the string that is in the table.
     */
    public function testScreenNamesComeBackAsTheyWerePublished(): void
    {
        $GLOBALS['wconvertTestOptionTable'] = [];
        $GLOBALS['wconvertTestOptionCharset'] = 'utf8mb3';
        $revision = str_repeat('a', 64);
        $id = '01J0000000AAAAAAAAAAAAAAAA';
        $published = new PublishedSet(new WpOptionStore());
        $published->replaceWith([['id' => $id, 'payload' => [
            'capture_contract' => $revision,
            'template' => ['tree' => ['steps' => [['id' => 'ask', 'name' => 'Ask 😀']]]],
        ]]]);
        wconvertTestOptionsAccept();

        $db = new FakeConnection();
        $db->answers = [[['scope' => 'screen:' . $revision . ':ask', 'kind' => 'screen_view', 'total' => '3']]];
        $request = new \WP_REST_Request('GET', '/');
        $request->set_param('id', $id);
        $request->set_param('days', 7);
        $result = (new JourneyStatsController($db, $published))->read($request);

        self::assertInstanceOf(\WP_REST_Response::class, $result);
        self::assertSame([$revision => ['ask' => ['name' => 'Ask 😀', 'order' => 0]]], $result->get_data()['definitions']);
        $GLOBALS['wconvertTestOptionTable'] = [];
    }
}

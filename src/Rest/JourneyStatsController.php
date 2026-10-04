<?php
namespace WConvert\Rest;

use WConvert\Database\Connection;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/** Anonymous daily journey totals; separate from Campaign headline arithmetic. */
final class JourneyStatsController implements RestController
{
    public function __construct(private readonly Connection $db) {}
    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/optins/(?P<id>[A-Z0-9]{26})/journey-stats', [
            'methods' => 'GET', 'callback' => [$this, 'read'],
            'permission_callback' => [Routes::class, 'canManage'],
            'args' => ReportWindow::args(),
        ]);
        register_rest_route(Routes::NAMESPACE, '/optins/(?P<id>[A-Z0-9]{26})/interests', [
            'methods' => 'GET', 'callback' => [$this, 'interests'],
            'permission_callback' => [Routes::class, 'canManage'], 'args' => ReportWindow::args(),
        ]);
    }
    public function read(WP_REST_Request $request): WP_REST_Response|\WP_Error
    {
        $id = (string) $request->get_param('id');
        try { $range = ReportWindow::read($request); }
        catch (\InvalidArgumentException) { return new \WP_Error('wconvert_report_range', __('Choose a current or earlier month.', 'wconvert'), ['status' => 400]); }
        $rows = $range->days() === 0 ? [] : $this->db->results(Connection::TABLE_STATS,
            'SELECT scope, kind, SUM(`count`) AS total FROM %i WHERE optin_id = %s AND stat_date BETWEEN %s AND %s AND scope <> %s GROUP BY scope, kind ORDER BY scope, kind LIMIT 5001', $id, $range->from, $range->to, '');
        $truncated = count($rows) > 5000;
        $rows = array_slice($rows, 0, 5000);
        $definitions = [];
        foreach ($rows as $row) {
            if (preg_match('/^screen:([a-f0-9]{64}):([a-z][a-z0-9_-]{0,47})$/D', (string) $row['scope'], $match)) {
                if (!isset($definitions[$match[1]])) $definitions[$match[1]] = get_option('wconvert_flow_' . $id . '_' . $match[1], []);
            }
        }
        return new WP_REST_Response(['rows' => $rows, 'definitions' => $definitions, 'from' => $range->from, 'to' => $range->to, 'days' => $range->days(), 'truncated' => $truncated], 200);
    }
    public function interests(WP_REST_Request $request): WP_REST_Response|\WP_Error
    {
        try { $range = ReportWindow::read($request); }
        catch (\InvalidArgumentException) { return new \WP_Error('wconvert_report_range', __('Choose a current or earlier month.', 'wconvert'), ['status' => 400]); }
        // Lead created_at uses current_time('mysql'), the site's local clock.
        $zone = wp_timezone();
        $start = (new \DateTimeImmutable($range->from, $zone))->format('Y-m-d H:i:s');
        $end = (new \DateTimeImmutable($range->to, $zone))->modify('+1 day')->format('Y-m-d H:i:s');
        $rows = $range->days() === 0 ? [] : $this->db->results(Connection::TABLE_LEADS,
            'SELECT fields FROM %i WHERE optin_id = %s AND created_at >= %s AND created_at < %s ORDER BY id DESC LIMIT 1001', (string) $request->get_param('id'), $start, $end);
        return new WP_REST_Response(\WConvert\Stats\Interests::summarize(array_slice($rows, 0, 1000)) + [
            'from' => $range->from, 'to' => $range->to, 'truncated' => count($rows) > 1000, 'retained' => min(count($rows), 1000),
        ]);
    }
}

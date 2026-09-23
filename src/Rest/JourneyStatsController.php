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
            'permission_callback' => static fn (): bool => current_user_can('manage_options'),
        ]);
    }
    public function read(WP_REST_Request $request): WP_REST_Response
    {
        $id = (string) $request->get_param('id');
        $from = (new \DateTimeImmutable('now', wp_timezone()))->modify('-29 days')->format('Y-m-d');
        $rows = $this->db->results(Connection::TABLE_STATS,
            'SELECT scope, kind, SUM(`count`) AS total FROM %i WHERE optin_id = %s AND stat_date >= %s AND scope <> %s GROUP BY scope, kind', $id, $from, '');
        $definitions = [];
        foreach ($rows as $row) {
            if (preg_match('/^screen:([a-f0-9]{64}):([a-z][a-z0-9_-]{0,47})$/D', (string) $row['scope'], $match)) {
                if (!isset($definitions[$match[1]])) $definitions[$match[1]] = get_option('wconvert_flow_' . $id . '_' . $match[1], []);
            }
        }
        return new WP_REST_Response(['rows' => $rows, 'definitions' => $definitions, 'from' => $from], 200);
    }
}

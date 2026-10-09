<?php
namespace WConvert\Rest;

use WConvert\Stats\{ProductStats, StatDay};
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/** Historical product activity remains readable after a tier downgrade. */
final class ProductStatsController implements RestController
{
    public function __construct(private readonly ProductStats $stats) {}
    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/optins/(?P<id>[A-Z0-9]{26})/product-stats', [
            'methods' => 'GET', 'callback' => [$this, 'read'],
            'permission_callback' => [Routes::class, 'canManage'], 'args' => ReportWindow::args(),
        ]);
    }
    public function read(WP_REST_Request $request): WP_REST_Response|\WP_Error
    {
        try { $range = ReportWindow::read($request); }
        catch (\InvalidArgumentException) { return new \WP_Error('wconvert_report_range', __('Choose a current or earlier month.', 'wconvert'), ['status' => 400]); }
        $id = (string) $request->get_param('id');
        $since = get_option(ProductStats::PREFIX . $id, null);
        return new WP_REST_Response($this->stats->report($id, $range, StatDay::today(), is_string($since) ? $since : null));
    }
}

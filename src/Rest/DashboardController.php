<?php

namespace WConvert\Rest;

use WConvert\Stats\Dashboard;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * REST reporting: one read-only route, optional complete-period comparison.
 *
 * ============================================================================
 * THE CALLER NAMES A WINDOW, NEVER THE SITE'S CURRENT DAY.
 * ============================================================================
 * The screen says "Today", and that has to mean the merchant's today
 * (ADR 0019). A browser asked for a date would answer with the VISITOR's day:
 * a merchant in Tokyo checking their numbers from a hotel in Los Angeles would
 * be handed yesterday's window and told it was today's, and the numbers would
 * be right about the wrong day. So `days` names the length, and the
 * one end that is a date is {@see StatDay::today()} — read here, on the
 * server, against the site's own `timezone_string`.
 *
 * That also makes the range unspoofable in the direction that matters: the
 * server chooses today, or yesterday and its adjacent comparison when
 * `complete` is enabled. A named calendar month supports stable target links;
 * its end is still capped at the site's yesterday (ADR 0090). There is no
 * caller-supplied "as at" date.
 *
 * **Read-only, with no exception**, and for a sharper reason than the [[Lead]]
 * log's. A counter cannot be recomputed — there is no raw data behind it
 * (ADR 0019) — so a write route here is a route that can destroy a merchant's
 * history permanently, and the only writer is the beacon counting one act.
 *
 * @since 0.1.0
 */
final class DashboardController implements RestController
{
    public function __construct(
        private readonly Dashboard $dashboard,
    ) {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/dashboard', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'index'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => ReportWindow::args(),
            ],
        ]);
    }

    public function index(WP_REST_Request $request): WP_REST_Response|\WP_Error
    {
        try { $range = ReportWindow::read($request); }
        catch (\InvalidArgumentException) {
            return new \WP_Error('wconvert_invalid_report_month', __('Choose a current or earlier calendar month.', 'wconvert'), ['status' => 400]);
        }
        $month = $request->get_param('month');
        $complete = $request->get_param('complete') || (is_string($month) && $month !== '');
        $data = $complete ? $this->dashboard->compare($range) : $this->dashboard->read($range);
        if (is_string($month) && $month !== '') $data['month'] = $month;
        return new WP_REST_Response($data);
    }
}

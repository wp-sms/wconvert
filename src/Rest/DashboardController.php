<?php

namespace WConvert\Rest;

use WConvert\Stats\Dashboard;
use WConvert\Stats\StatDay;
use WConvert\Stats\StatRange;
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
                'args' => [
                    'complete' => ['type' => 'boolean', 'default' => false],
                    'month' => ['type' => 'string', 'pattern' => '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'],
                    // A window, in days, ending today. `1` is today alone,
                    // which is what a merchant means by "Today" — a window of
                    // one day rather than a window of none.
                    //
                    // The maximum is the same one {@see StatRange} enforces,
                    // read off it rather than restated: it is the number that
                    // keeps a scan of the counters a scan of one year, and a
                    // second spelling here would be one to keep in step.
                    'days' => [
                        'type' => 'integer',
                        'default' => StatRange::DEFAULT_DAYS,
                        'minimum' => 1,
                        'maximum' => StatRange::MAX_DAYS,
                    ],
                ],
            ],
        ]);
    }

    public function index(WP_REST_Request $request): WP_REST_Response|\WP_Error
    {
        $month = $request->get_param('month');
        if (is_string($month) && $month !== '') {
            try { $range = StatRange::calendarMonth($month, StatDay::today()); }
            catch (\InvalidArgumentException) {
                return new \WP_Error('wconvert_invalid_report_month', __('Choose a current or earlier calendar month.', 'wconvert'), ['status' => 400]);
            }
            return new WP_REST_Response($this->dashboard->compare($range) + ['month' => $month]);
        }
        if ($request->get_param('complete')) {
            return new WP_REST_Response($this->dashboard->compare(StatRange::completeDays((int) $request->get_param('days'), StatDay::today())));
        }
        return new WP_REST_Response(
            $this->dashboard->read(StatRange::lastDays((int) $request->get_param('days'), StatDay::today()))
        );
    }
}

<?php

namespace WConvert\Rest;

use WConvert\Stats\Dashboard;
use WConvert\Stats\StatDay;
use WConvert\Stats\StatRange;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * REST for the analytics screen: one read-only route, one window.
 *
 * ============================================================================
 * THE CALLER SENDS A NUMBER OF DAYS AND NEVER A DATE.
 * ============================================================================
 * The screen says "Today", and that has to mean the merchant's today
 * (ADR 0019). A browser asked for a date would answer with the VISITOR's day:
 * a merchant in Tokyo checking their numbers from a hotel in Los Angeles would
 * be handed yesterday's window and told it was today's, and the numbers would
 * be right about the wrong day. So `days` is the whole of the query, and the
 * one end that is a date is {@see StatDay::today()} — read here, on the
 * server, against the site's own `timezone_string`.
 *
 * That also makes the range unspoofable in the direction that matters: the
 * window can only ever end today, so there is no "as at" a caller can move.
 *
 * **Read-only, with no exception**, and for a sharper reason than the [[Lead]]
 * log's. A counter cannot be recomputed — there is no raw data behind it
 * (ADR 0019) — so a write route here is a route that can destroy a merchant's
 * history permanently, and the only writer is the beacon counting one act.
 *
 * @since 0.1.0
 */
final class DashboardController
{
    public function __construct(
        private readonly Dashboard $dashboard,
    ) {
    }

    public function hooks(): void
    {
        add_action('rest_api_init', [$this, 'registerRoutes']);
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/dashboard', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'index'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
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

    public function index(WP_REST_Request $request): WP_REST_Response
    {
        return new WP_REST_Response(
            $this->dashboard->read(StatRange::lastDays((int) $request->get_param('days'), StatDay::today()))
        );
    }
}

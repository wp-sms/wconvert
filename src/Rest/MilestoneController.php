<?php

namespace WConvert\Rest;

use WConvert\Milestone\Milestones;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * REST for the milestones: one read-only route, no query at all.
 *
 * ============================================================================
 * NO PARAMETERS, BECAUSE A MILESTONE IS ALL-TIME.
 * ============================================================================
 * {@see DashboardController} takes a number of days, and every argument about
 * why it takes days rather than a date applies here by not applying at all: a
 * milestone has no window. There is nothing a caller could narrow, so there is
 * nothing to validate and nothing anybody can move.
 *
 * **A route of its own rather than fields on the dashboard's payload**, for
 * the reason {@see \WConvert\Stats\StatsRepository::firstDays()} keeps its
 * read separate from `inRange()`. Two routes is what makes the mistake
 * unexpressible rather than merely avoided.
 *
 * **Read-only, with no exception**, for the same reason
 * {@see DashboardController} is and one more. Two of these five cannot be
 * recomputed from anything (ADR 0019), and the other two are recorded once by
 * design — so a write route here is a route that can destroy the only copy of
 * a fact, and there is no repair path behind it.
 *
 * @since 0.1.0
 */
final class MilestoneController implements RestController
{
    public function __construct(
        private readonly Milestones $milestones,
    ) {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/milestones', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'index'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
        ]);
    }

    public function index(): WP_REST_Response
    {
        return new WP_REST_Response($this->milestones->read());
    }
}

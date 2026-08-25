<?php

namespace WConvert\Rest;

use WConvert\Goal\Goal;
use WConvert\Goal\GoalRegistry;
use WP_Error;

defined('ABSPATH') || exit;

/**
 * Reading a [[Goal]] off a request, once.
 *
 * Two controllers ask the same question — the creation flow reads one to
 * filter the gallery and to prefill, and {@see OptinController} reads one to
 * write. They had the same `tryFrom()`-then-`isSettable()` cascade twice, with
 * the same two sentences and, less forgivably, **two different HTTP statuses
 * for one error code**: an unknown Goal was a 400 on one route and a 404 on
 * the other, so a client could not tell from the code what had happened.
 *
 * Both are 400. In neither case is the Goal the resource being addressed — it
 * is a value in a query string or a body, and a value the vocabulary does not
 * have is a bad request rather than a missing page.
 *
 * @since 0.1.0
 */
final class RequestedGoal
{
    /**
     * The Goal a merchant may act under, or the error that says why they may
     * not.
     *
     * **A Goal this install cannot serve is refused rather than served
     * empty.** The goal screen never offers one, so a request naming it did
     * not come from the flow — and a screen is not an enforcement mechanism
     * anyway: every WConvert route is reachable by anyone holding
     * `manage_options`, and the REST API is scriptable (ADR 0026).
     *
     * **What is checked is the Goal being SET, never the one already held.**
     * An Optin whose Goal became `unavailable` when WooCommerce was
     * deactivated keeps it, and keeps every number it already counted: the
     * Goal is read at report time and never frozen (ADR 0020).
     *
     * @return Goal|WP_Error
     */
    public static function settable(GoalRegistry $goals, string $value)
    {
        $goal = Goal::tryFrom($value);

        if ($goal === null) {
            return new WP_Error('wconvert_goal_not_found', __('No such Goal.', 'wconvert'), ['status' => 400]);
        }

        if (!$goals->isSettable($goal)) {
            return new WP_Error(
                'wconvert_goal_unavailable',
                __('This install cannot serve that Goal.', 'wconvert'),
                ['status' => 400]
            );
        }

        return $goal;
    }
}

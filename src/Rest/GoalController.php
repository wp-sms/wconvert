<?php

namespace WConvert\Rest;

use WConvert\Goal\GoalRegistry;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * REST for the [[Goal]] registry: read-only, because the set is closed
 * (ADR 0019's fifth refusal) and there is nothing to author.
 *
 * **Every Goal travels, whatever its [[Availability]].** The three states name
 * *why* a member is absent; *how* that absence renders is a property of the
 * surface, and the two surfaces render it oppositely — a settings list the
 * merchant went hunting through explains the gap, and the goal screen, being
 * the front door of a creation flow, hides it (ADR 0026). An endpoint that
 * filtered would have decided that for both, and would put the rule in the
 * one place neither surface can see.
 *
 * The labels come from PHP rather than being spelled again in the admin
 * bundle. They are translatable strings, and `wp i18n make-pot` cannot see a
 * JavaScript string it did not build — the same reasoning that puts bundled
 * [[Playbook]]s in PHP files (ADR 0013).
 *
 * @since 0.1.0
 */
final class GoalController implements RestController
{
    public function __construct(
        private readonly GoalRegistry $goals,
    ) {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/goals', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'index'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
        ]);
    }

    public function index(): WP_REST_Response
    {
        return new WP_REST_Response($this->goals->toArray());
    }
}

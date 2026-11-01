<?php

namespace WConvert\Rest;

use WConvert\Onboarding\ChecklistDismissal;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * The one write behind the getting-started checklist: hide it for the
 * current user (ADR 0176). The checklist's progress is read from the
 * milestones and the campaign list, so there is nothing else to store.
 */
final class GettingStartedController implements RestController
{
    public function __construct(private readonly ChecklistDismissal $dismissal)
    {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/getting-started/hide', [
            'methods' => 'POST',
            'callback' => [$this, 'hide'],
            'permission_callback' => [Routes::class, 'canManage'],
        ]);
    }

    public function hide(): WP_REST_Response
    {
        $this->dismissal->hide(get_current_user_id());

        return new WP_REST_Response(['hidden' => true]);
    }
}

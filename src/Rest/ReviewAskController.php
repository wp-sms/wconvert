<?php

namespace WConvert\Rest;

use WConvert\Onboarding\ReviewAsk;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * The one write behind the review card: what the current user chose
 * (ADR 0191). Whether the card shows is read at boot, so there is no GET.
 */
final class ReviewAskController implements RestController
{
    public function __construct(private readonly ReviewAsk $ask)
    {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/review-ask', [
            'methods' => 'POST',
            'callback' => [$this, 'record'],
            'permission_callback' => [Routes::class, 'canManage'],
            'args' => [
                'choice' => ['type' => 'string', 'required' => true, 'enum' => ReviewAsk::CHOICES],
            ],
        ]);
    }

    public function record(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $choice = $request->get_param('choice');

        // The schema refuses these first; this keeps a direct call honest too.
        if (!is_string($choice) || !in_array($choice, ReviewAsk::CHOICES, true)) {
            return new WP_Error('wconvert_review_choice', __('Unknown choice.', 'wconvert'), ['status' => 400]);
        }

        $this->ask->record(get_current_user_id(), $choice, time());

        return new WP_REST_Response(['choice' => $choice]);
    }
}

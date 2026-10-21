<?php

namespace WConvert\Rest;

use WConvert\Optin\InvalidSchedule;
use WConvert\Optin\Schedule;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/** Read an unsaved deadline using the same timezone resolution as published campaigns. */
final class ScheduleController implements RestController
{
    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/schedule/resolve', [[
            'methods' => 'GET',
            'callback' => [$this, 'resolve'],
            'permission_callback' => [Routes::class, 'canManage'],
            'args' => ['ends_at' => ['type' => 'string', 'default' => '']],
        ]]);
    }

    public function resolve(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        try {
            $window = Schedule::fromArray(['ends_at' => $request->get_param('ends_at')])->resolve(wp_timezone());
        } catch (InvalidSchedule $error) {
            return new WP_Error('wconvert_invalid_deadline', __('Choose a valid countdown date and time.', 'wconvert'), ['status' => 400]);
        }
        return new WP_REST_Response(['ends_at' => $window['ends_at'] ?? null]);
    }
}

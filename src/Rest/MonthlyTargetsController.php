<?php

namespace WConvert\Rest;

use WConvert\Stats\MonthlyTargets;
use WConvert\Stats\StatDay;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/** Target settings have their own write route; dashboard counters stay read-only. */
final class MonthlyTargetsController implements RestController
{
    public function __construct(private readonly MonthlyTargets $targets)
    {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/monthly-targets', [
            ['methods' => 'GET', 'callback' => [$this, 'read'], 'permission_callback' => [Routes::class, 'canManage']],
            [
                'methods' => 'POST', 'callback' => [$this, 'save'], 'permission_callback' => [Routes::class, 'canManage'],
                'args' => ['month' => ['type' => 'string', 'required' => true], 'targets' => ['type' => 'object', 'required' => true]],
            ],
        ]);
    }

    public function read(): WP_REST_Response
    {
        return new WP_REST_Response($this->targets->read(StatDay::today()));
    }

    public function save(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        $today = StatDay::today();
        try {
            $this->targets->save((string) $request->get_param('month'), (array) $request->get_param('targets'), $today);
        } catch (\DomainException) {
            return new WP_Error('wconvert_target_month_changed', __('The month changed. Close this dialog and refresh targets before saving the new month.', 'wconvert'), ['status' => 409]);
        } catch (\InvalidArgumentException) {
            return new WP_Error('wconvert_invalid_targets', __('Use whole positive counts for supported target metrics.', 'wconvert'), ['status' => 400]);
        } catch (\RuntimeException) {
            return new WP_Error('wconvert_targets_not_saved', __('Targets could not be saved. Please try again.', 'wconvert'), ['status' => 500]);
        }
        return new WP_REST_Response($this->targets->read($today));
    }
}

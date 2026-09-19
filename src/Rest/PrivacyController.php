<?php

namespace WConvert\Rest;

use WConvert\Privacy\DataMap;
use WConvert\Privacy\PrivacyGuidance;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/** The current install's personal-data map and privacy-authoring preference. */
final class PrivacyController implements RestController
{
    public function __construct(
        private readonly DataMap $map,
        private readonly PrivacyGuidance $guidance,
    ) {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/privacy/data-map', [
            'methods' => 'GET',
            'callback' => [$this, 'show'],
            'permission_callback' => [Routes::class, 'canManage'],
        ]);

        register_rest_route(Routes::NAMESPACE, '/privacy/guidance', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'showGuidance'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
            [
                'methods' => 'POST',
                'callback' => [$this, 'updateGuidance'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => [
                    'enabled' => ['type' => 'boolean', 'required' => true],
                ],
            ],
        ]);
    }

    public function show(): WP_REST_Response
    {
        return new WP_REST_Response($this->map->summary());
    }

    public function showGuidance(): WP_REST_Response
    {
        return new WP_REST_Response(['enabled' => $this->guidance->enabled()]);
    }

    public function updateGuidance(WP_REST_Request $request): WP_REST_Response
    {
        $this->guidance->set((bool) $request->get_param('enabled'));

        return $this->showGuidance();
    }
}

<?php

namespace WConvert\Rest;

use WConvert\Privacy\DataMap;
use WP_REST_Response;

defined('ABSPATH') || exit;

/** The current install's read-only personal-data map. */
final class PrivacyController implements RestController
{
    public function __construct(private readonly DataMap $map)
    {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/privacy/data-map', [
            'methods' => 'GET',
            'callback' => [$this, 'show'],
            'permission_callback' => [Routes::class, 'canManage'],
        ]);
    }

    public function show(): WP_REST_Response
    {
        return new WP_REST_Response($this->map->summary());
    }
}

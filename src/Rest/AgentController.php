<?php

namespace WConvert\Rest;

use WConvert\Agent\AgentPublishing;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/** Settings → Connections & destinations → AI agents: whether agents may publish (ADR 0154 §7). */
final class AgentController implements RestController
{
    public function __construct(private readonly AgentPublishing $publishing)
    {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/agents/publishing', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'show'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
            [
                'methods' => 'POST',
                'callback' => [$this, 'update'],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => ['enabled' => ['type' => 'boolean', 'required' => true]],
            ],
        ]);
    }

    public function show(): WP_REST_Response
    {
        return new WP_REST_Response(['enabled' => $this->publishing->enabled()]);
    }

    public function update(WP_REST_Request $request): WP_REST_Response
    {
        $this->publishing->set((bool) $request->get_param('enabled'));

        return $this->show();
    }
}

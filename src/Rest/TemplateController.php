<?php

namespace WConvert\Rest;

use WConvert\Template\TemplateLibrary;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * REST for the Template gallery: read-only, because a Template is shipped
 * rather than authored here.
 *
 * The admin needs the entries because gallery cards and the live preview
 * render the REAL template through the same dependency-free renderer the
 * loader imports — there are no static thumbnails to produce or to let go
 * stale (ADR 0010). The gallery itself, and the settings panel that edits an
 * Optin's copy of one, arrive in their own ticket.
 *
 * @since 0.1.0
 */
final class TemplateController
{
    public function __construct(
        private readonly TemplateLibrary $templates,
    ) {
    }

    public function hooks(): void
    {
        add_action('rest_api_init', [$this, 'registerRoutes']);
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/templates', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'index'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
        ]);
    }

    public function index(): WP_REST_Response
    {
        return new WP_REST_Response(array_values($this->templates->all()));
    }
}

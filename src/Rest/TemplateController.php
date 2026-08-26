<?php

namespace WConvert\Rest;

use WConvert\Template\TemplateLabels;
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
 * stale (ADR 0010).
 *
 * @since 0.1.0
 */
final class TemplateController implements RestController
{
    public function __construct(
        private readonly TemplateLibrary $templates,
    ) {
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

    /**
     * The gallery, and the vocabulary's words beside it.
     *
     * Two keys rather than two routes, because the settings panel reads both
     * together and neither is a fact about the install. The WORDS are here at
     * all for the reason ADR 0013 gives about [[Playbook]]s: `wp i18n
     * make-pot` cannot see a string inside JSON, so a [[Slot Role]] that used
     * to be a key two programs agreed on and nobody read has to acquire a
     * translatable name now that it is the heading over a control
     * ({@see TemplateLabels}).
     */
    public function index(): WP_REST_Response
    {
        return new WP_REST_Response([
            'templates' => array_values($this->templates->all()),
            'labels' => TemplateLabels::all(),
        ]);
    }
}

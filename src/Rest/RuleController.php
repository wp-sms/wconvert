<?php

namespace WConvert\Rest;

use WConvert\Rules\RuleCatalogue;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * REST for the rule vocabulary: the three axes, as the builder needs them.
 *
 * Read-only, because the vocabulary is CLOSED (ADR 0005): there is nothing to
 * add to it from a screen. What the response carries beyond
 * `resources/rules/manifest.json` — the words, and this install's
 * [[Availability]] — is {@see RuleCatalogue}'s, which is where it can be
 * tested without WordPress's REST classes.
 *
 * @since 0.1.0
 */
final class RuleController implements RestController
{
    public function __construct(
        private readonly RuleCatalogue $catalogue,
    ) {
    }

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/rules', [
            [
                'methods' => 'GET',
                'callback' => [$this, 'index'],
                'permission_callback' => [Routes::class, 'canManage'],
            ],
        ]);
    }

    public function index(): WP_REST_Response
    {
        return new WP_REST_Response($this->catalogue->all());
    }
}

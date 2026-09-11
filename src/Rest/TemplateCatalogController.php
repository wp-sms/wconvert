<?php

namespace WConvert\Rest;

use WConvert\Template\Catalog\TemplateCatalog;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

final class TemplateCatalogController implements RestController
{
    public function __construct(private readonly TemplateCatalog $catalog)
    {
    }

    public function registerRoutes(): void
    {
        foreach (['' => 'GET', '/refresh' => 'POST', '/preview' => 'POST', '/install' => 'POST'] as $suffix => $method) {
            register_rest_route(Routes::NAMESPACE, '/template-catalog' . $suffix, [
                'methods' => $method,
                'callback' => [$this, $suffix === '' ? 'index' : substr($suffix, 1)],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => in_array($suffix, ['/preview', '/install'], true) ? [
                    'id' => ['type' => 'string', 'required' => true],
                    'digest' => ['type' => 'string', 'required' => $suffix === '/install'],
                    'installed' => ['type' => 'boolean', 'default' => false],
                ] : [],
            ]);
        }
    }

    public function index(): WP_REST_Response
    {
        return new WP_REST_Response($this->catalog->status());
    }

    public function refresh(): WP_REST_Response|WP_Error
    {
        return $this->respond(fn (): array => $this->catalog->refresh());
    }

    public function preview(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        return $this->respond(fn (): array => $this->catalog->preview((string) $request->get_param('id'), (bool) $request->get_param('installed')));
    }

    public function install(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        return $this->respond(fn (): array => $this->catalog->install((string) $request->get_param('id'), (string) $request->get_param('digest')));
    }

    /** @param callable(): array<string, mixed> $action */
    private function respond(callable $action): WP_REST_Response|WP_Error
    {
        try {
            return new WP_REST_Response($action());
        } catch (\RuntimeException $error) {
            return new WP_Error('wconvert_catalog_failed', $error->getMessage(), ['status' => 400]);
        }
    }
}

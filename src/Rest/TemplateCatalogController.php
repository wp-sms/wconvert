<?php

namespace WConvert\Rest;

use WConvert\Template\Catalog\TemplateCatalog;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * The hosted library's admin routes (ADR 0156). Every one is an explicit
 * administrator request; reading status never touches the network.
 */
final class TemplateCatalogController implements RestController
{
    private const OBJECT_ARGS = [
        'id' => ['type' => 'string', 'required' => true, 'pattern' => '^[a-z0-9][a-z0-9-]{0,59}$'],
        'sha256' => ['type' => 'string', 'required' => true, 'pattern' => '^[a-f0-9]{64}$'],
    ];

    public function __construct(private readonly TemplateCatalog $catalog)
    {
    }

    public function registerRoutes(): void
    {
        $routes = [
            '' => ['GET', 'index', []],
            '/refresh' => ['POST', 'refresh', ['if_stale' => ['type' => 'boolean', 'default' => false]]],
            '/consent' => ['POST', 'consent', ['allowed' => ['type' => 'boolean', 'required' => true]]],
            '/preview' => ['POST', 'preview', ['id' => self::OBJECT_ARGS['id']]],
            '/install' => ['POST', 'install', self::OBJECT_ARGS],
            '/setup' => ['POST', 'setup', self::OBJECT_ARGS],
        ];
        foreach ($routes as $suffix => [$method, $callback, $args]) {
            register_rest_route(Routes::NAMESPACE, '/template-catalog' . $suffix, [
                'methods' => $method,
                'callback' => [$this, $callback],
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => $args,
            ]);
        }
    }

    public function index(): WP_REST_Response
    {
        return new WP_REST_Response($this->catalog->status());
    }

    /** `if_stale` is what opening the picker sends; it is a no-op inside twelve hours. */
    public function refresh(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        return $this->respond(fn (): array => $this->catalog->refresh((bool) $request->get_param('if_stale')));
    }

    public function consent(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        return $this->respond(fn (): array => $this->catalog->setConsent((bool) $request->get_param('allowed')));
    }

    public function preview(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        return $this->respond(fn (): array => $this->catalog->preview((string) $request->get_param('id')));
    }

    public function install(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        return $this->respond(fn (): array => $this->catalog->install((string) $request->get_param('id'), (string) $request->get_param('sha256')));
    }

    public function setup(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        return $this->respond(fn (): array => $this->catalog->installSetup((string) $request->get_param('id'), (string) $request->get_param('sha256')));
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

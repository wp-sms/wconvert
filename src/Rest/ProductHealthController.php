<?php
namespace WConvert\Rest;

use WConvert\Optin\OptinRepository;
use WConvert\Support\Ulid;
use WConvert\Template\CommerceSupport;
use WConvert\Template\JourneySupport;
use WConvert\Template\ProductHealth;

defined('ABSPATH') || exit;

final class ProductHealthController implements RestController
{
    public function __construct(private readonly OptinRepository $optins) {}

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/optins/product-health', [
            'methods' => 'GET', 'callback' => [$this, 'read'], 'permission_callback' => [Routes::class, 'canManage'],
            'args' => ['ids' => ['required' => true, 'type' => 'array', 'items' => ['type' => 'string'], 'minItems' => 1, 'maxItems' => 12]],
        ]);
    }

    public function read(\WP_REST_Request $request): \WP_REST_Response|\WP_Error
    {
        $ids = $request->get_param('ids');
        if (!is_array($ids) || $ids === [] || count($ids) > 12) return new \WP_Error('wconvert_product_checks', __('Choose up to twelve campaigns.', 'wconvert'), ['status' => 400]);
        foreach ($ids as $id) if (!is_string($id) || !preg_match('/^' . Ulid::PATTERN . '$/D', $id)) return new \WP_Error('wconvert_product_checks', __('Invalid campaign ID.', 'wconvert'), ['status' => 400]);
        $rows = [];
        // Neither module that puts a product in a campaign is here, so there is
        // nothing to check — and a free install names no product (ADR 0116).
        if (!JourneySupport::active() && !CommerceSupport::active()) {
            foreach (array_unique($ids) as $id) $rows[] = ['id' => $id, 'basis' => 'draft', 'checks' => []];
            return new \WP_REST_Response($rows, 200, ['Cache-Control' => 'private, no-store']);
        }
        foreach (array_unique($ids) as $id) {
            $optin = $this->optins->find($id);
            if (!$optin || $optin->isDeleted()) {
                $rows[] = ['id' => $id, 'basis' => 'draft', 'checks' => [['label' => __('Campaign', 'wconvert'), 'state' => 'unknown', 'message' => __('Campaign unavailable. Refresh the campaign list.', 'wconvert')]]];
                continue;
            }
            $published = $optin->isPublished() && $optin->publishedConfig !== null;
            $rows[] = ['id' => $id, 'basis' => $published ? 'published' : 'draft', 'checks' => (new ProductHealth())->inspect($published ? $optin->publishedConfig : $optin->config)];
        }
        return new \WP_REST_Response($rows, 200, ['Cache-Control' => 'private, no-store']);
    }
}

<?php
namespace WConvert\Pro\Module\Journeys;

use WConvert\Template\ProductHealth;
use WConvert\Template\ResultProductSource;

defined('ABSPATH') || exit;

/**
 * What a quiz result's product cards need beyond the journey itself: the
 * category route they read, the payload attribute that names it, and the
 * merchant's product check. Free carries none of it (ADR 0127) — a
 * result with products exists only where this module does.
 */
final class ResultProducts
{
    public static function hooks(): void
    {
        add_action('rest_api_init', static fn () => (new ProductMatchesController())->registerRoutes());
        add_filter('wconvert_payload_attributes', [self::class, 'attributes'], 10, 2);
        // After cart-recovery's 10, which answers for every kind where it
        // shipped; this reads the catalog only when nothing has answered.
        add_filter('wconvert_check_products', [self::class, 'check'], 20, 3);
    }

    /** @param array<string, string> $attributes
     * @param list<array<string, mixed>> $entries
     * @return array<string, string> */
    public static function attributes(array $attributes, array $entries): array
    {
        foreach ($entries as $entry) {
            $steps = $entry['template']['tree']['steps'] ?? [];
            if (!is_array($steps)) continue;
            foreach ($steps as $step) foreach ($step['results'] ?? [] as $result) {
                if (isset($result['product_filter'])) return $attributes + ['data-product-matches' => esc_url_raw(rest_url('wconvert/v1/product-matches'))];
            }
        }
        return $attributes;
    }

    /** @param array<string, mixed> $node
     * @return array{state: string, message: string}|mixed */
    public static function check(mixed $previous, array $node, string $kind): mixed
    {
        return $previous === null && $kind === 'result' ? self::quiz($node) : $previous;
    }

    /** @param array<string, mixed> $result
     * @return array{state: string, message: string} */
    private static function quiz(array $result): array
    {
        if (($result['product_action'] ?? 'link') !== 'link') return ProductHealth::check('unknown', __('Activate WConvert Pro to check cart buttons.', 'wconvert'));
        $ids = array_values(array_slice($result['product_ids'] ?? [], 0, 6));
        $filtered = isset($result['product_filter']);
        if ($filtered && !ResultProductSource::available($result['product_filter'])) return ProductHealth::check('warning', __('A category or attribute is missing. Update this result’s filters.', 'wconvert'));
        if (!$filtered && $ids === []) return ProductHealth::selection([], []);
        $read = new \WP_REST_Request('GET', '/wc/store/v1/products');
        if ($filtered) {
            $read->set_param('filter', wp_json_encode($result['product_filter']));
            $response = (new ProductMatchesController())->matches($read);
        } else {
            foreach (['include' => $ids, 'catalog_visibility' => 'visible', 'per_page' => count($ids)] as $key => $value) $read->set_param($key, $value);
            $response = rest_do_request($read);
        }
        if ($response instanceof \WP_Error || $response->get_status() >= 400 || !is_array($response->get_data())) return ProductHealth::check('unknown', __('Products could not be checked. Try again.', 'wconvert'));
        $rows = array_filter($response->get_data(), static fn ($row): bool => is_array($row) && ($row['is_purchasable'] ?? false) === true && ($row['is_in_stock'] ?? false) === true && ($row['is_password_protected'] ?? false) !== true);
        if ($filtered && ResultProductSource::missingPins($result['product_filter'], array_column($rows, 'id'))) return ProductHealth::check('warning', __('A pinned product is unavailable or does not match. Review this result’s pins.', 'wconvert'));
        return $filtered ? ProductHealth::check($rows ? 'ok' : 'warning', $rows ? __('Matching products are available.', 'wconvert') : __('No available products match. Review this result’s filters.', 'wconvert')) : ProductHealth::selection($ids, array_column($rows, 'id'));
    }
}

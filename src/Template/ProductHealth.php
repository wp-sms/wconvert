<?php
namespace WConvert\Template;

use WConvert\Rest\ProductMatchesController;

defined('ABSPATH') || exit;

/** Current catalog advice, never a publication gate or a visitor eligibility decision. */
final class ProductHealth
{
    /** @param array<string, mixed> $config
     * @return list<array{label: string, state: string, message: string}> */
    public function inspect(array $config): array
    {
        $sources = [];
        foreach ($config['template']['tree']['steps'] ?? [] as $screen) {
            foreach (CaptureJourney::nodes($screen['content'] ?? []) as $node) {
                if (($node['type'] ?? '') === 'products' && !($node['hidden'] ?? false)) $sources[] = ['node' => $node, 'kind' => 'recommendations', 'label' => __('Recommendations', 'wconvert')];
            }
            foreach ($screen['results'] ?? [] as $index => $result) {
                $required = ($screen['products_required'] ?? false) && $index < count($screen['results']) - 1;
                if (empty($result['product_ids']) && !isset($result['product_filter']) && !$required && ($result['product_action'] ?? 'link') !== 'add_to_cart') continue;
                $sources[] = ['node' => $result, 'kind' => 'result', 'label' => trim(wp_strip_all_tags((string) ($result['heading'] ?? ''))) ?: __('Quiz result', 'wconvert')];
            }
        }
        $checks = [];
        // Published designs allow six results or one recommendation block. Bound drafts too.
        foreach (array_slice($sources, 0, 8) as $source) {
            try {
                if (!class_exists('WooCommerce')) $check = self::check('unknown', __('Activate WooCommerce to check products.', 'wconvert'));
                elseif ($source['kind'] === 'result' && !JourneySupport::active()) $check = self::check('unknown', __('Product checks need the quiz feature to be active.', 'wconvert'));
                else {
                    $check = apply_filters('wconvert_check_products', null, $source['node'], $source['kind']);
                    if ($check === null) $check = $source['kind'] === 'result' ? $this->quiz($source['node']) : self::check('unknown', __('Activate WConvert Pro to check recommendations.', 'wconvert'));
                    if (!is_array($check) || !in_array($check['state'] ?? null, ['ok', 'warning', 'unknown', 'context'], true) || !is_string($check['message'] ?? null)) $check = self::check('unknown', __('Products could not be checked. Try again.', 'wconvert'));
                }
            } catch (\Throwable) {
                $check = self::check('unknown', __('Products could not be checked. Try again.', 'wconvert'));
            }
            $checks[] = ['label' => $source['label'], 'state' => $check['state'], 'message' => $check['message']];
        }
        if (count($sources) > 8) $checks[] = ['label' => __('More selections', 'wconvert')] + self::check('unknown', __('This design has too many product selections to check. Review it in the editor.', 'wconvert'));
        return $checks;
    }

    /** @return array{state: string, message: string} */
    public static function check(string $state, string $message): array { return ['state' => $state, 'message' => $message]; }

    /** @param list<int> $selected
     * @param list<int> $available
     * @return array{state: string, message: string} */
    public static function selection(array $selected, array $available): array
    {
        if ($selected === []) return self::check('warning', __('No products selected. Choose products in the editor.', 'wconvert'));
        $missing = array_values(array_diff(array_unique($selected), $available));
        if ($missing === []) return self::check('ok', __('Selected products are available.', 'wconvert'));
        $names = array_map(static function (int $id): string {
            $product = wc_get_product($id);
            return $product ? wp_strip_all_tags($product->get_name()) : sprintf(__('Product #%d', 'wconvert'), $id);
        }, $missing);
        return self::check('warning', sprintf(__('Unavailable: %s. Review these products in the editor.', 'wconvert'), implode(', ', $names)));
    }

    /** @param array<string, mixed> $result
     * @return array{state: string, message: string} */
    private function quiz(array $result): array
    {
        if (($result['product_action'] ?? 'link') !== 'link') return self::check('unknown', __('Activate WConvert Pro to check cart buttons.', 'wconvert'));
        $ids = array_values(array_slice($result['product_ids'] ?? [], 0, 6));
        $filtered = isset($result['product_filter']);
        if ($filtered && !ResultProductSource::available($result['product_filter'])) return self::check('warning', __('A category or attribute is missing. Update this result’s filters.', 'wconvert'));
        if (!$filtered && $ids === []) return self::selection([], []);
        $read = new \WP_REST_Request('GET', '/wc/store/v1/products');
        if ($filtered) {
            $read->set_param('filter', wp_json_encode($result['product_filter']));
            $response = (new ProductMatchesController())->matches($read);
        } else {
            foreach (['include' => $ids, 'catalog_visibility' => 'visible', 'per_page' => count($ids)] as $key => $value) $read->set_param($key, $value);
            $response = rest_do_request($read);
        }
        if ($response instanceof \WP_Error || $response->get_status() >= 400 || !is_array($response->get_data())) return self::check('unknown', __('Products could not be checked. Try again.', 'wconvert'));
        $rows = array_filter($response->get_data(), static fn ($row): bool => is_array($row) && ($row['is_purchasable'] ?? false) === true && ($row['is_in_stock'] ?? false) === true && ($row['is_password_protected'] ?? false) !== true);
        if ($filtered && ResultProductSource::missingPins($result['product_filter'], array_column($rows, 'id'))) return self::check('warning', __('A pinned product is unavailable or does not match. Review this result’s pins.', 'wconvert'));
        return $filtered ? self::check($rows ? 'ok' : 'warning', $rows ? __('Matching products are available.', 'wconvert') : __('No available products match. Review this result’s filters.', 'wconvert')) : self::selection($ids, array_column($rows, 'id'));
    }
}

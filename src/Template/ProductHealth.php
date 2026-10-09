<?php
namespace WConvert\Template;

use WConvert\Support\Tier;
use WConvert\Support\WpProPresence;

defined('ABSPATH') || exit;

/**
 * Current catalog advice, never a publication gate or a visitor eligibility decision.
 *
 * Core owns the seam and Pro's modules fill it: `wconvert_check_products`
 * answers for each product selection, the journeys module for a quiz result and
 * cart-recovery for recommendations and cart buttons. Nothing here reads a
 * catalog itself.
 */
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
                    if ($check === null) $check = self::check('unknown', self::unchecked());
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

    /** No module answered. A free install names no product (ADR 0116 §3). */
    private static function unchecked(): string
    {
        return (new WpProPresence())->installedTier() === Tier::Free
            ? __('This design uses elements this site can’t display.', 'wconvert')
            : __('Activate WConvert Pro to check recommendations.', 'wconvert');
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
            /* translators: %d: a WooCommerce product ID. */
            return $product ? wp_strip_all_tags($product->get_name()) : sprintf(__('Product #%d', 'wconvert'), $id);
        }, $missing);
        /* translators: %s: product names, already joined with commas. */
        return self::check('warning', sprintf(__('Unavailable: %s. Review these products in the editor.', 'wconvert'), implode(', ', $names)));
    }
}

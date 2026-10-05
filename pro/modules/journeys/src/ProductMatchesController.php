<?php

namespace WConvert\Pro\Module\Journeys;

use WConvert\Rest\RestController;
use WConvert\Rest\Routes;
use WConvert\Template\JourneySupport;
use WConvert\Template\ResultProductSource;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * Bounded public catalog read. No visitor data, cart writes or statistics.
 *
 * Pro's, not free's (ADR 0123, amended): only a category result reads it, and
 * a category result exists only where this module does — free suspends the
 * Campaign instead, so no visitor of a free install could reach the route.
 */
final class ProductMatchesController implements RestController
{
    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/product-matches', [
            'methods' => 'GET', 'callback' => [$this, 'matches'], 'permission_callback' => '__return_true',
            'args' => ['filter' => ['required' => true, 'type' => 'string', 'maxLength' => 1024]],
        ]);
        register_rest_route(Routes::NAMESPACE, '/product-filters', [
            'methods' => 'GET', 'callback' => [$this, 'options'], 'permission_callback' => [Routes::class, 'canManage'],
            'args' => ['taxonomy' => ['type' => 'string', 'default' => 'product_cat', 'maxLength' => 32],
                'search' => ['type' => 'string', 'default' => '', 'maxLength' => 100],
                'selected' => ['type' => 'string', 'default' => '', 'maxLength' => 32]],
        ]);
    }

    public function matches(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        if (!JourneySupport::active() || !class_exists('WooCommerce')) return new WP_Error('wconvert_products_unavailable', __('Product results need WooCommerce and an active journeys module.', 'wconvert'), ['status' => 503]);
        $source = json_decode((string) $request->get_param('filter'), true);
        if (!ResultProductSource::available($source)) return new WP_Error('wconvert_product_filter', __('Choose an existing category and attribute values.', 'wconvert'), ['status' => 400]);
        [$orderby, $order] = match ($source['order'] ?? 'oldest') {
            'newest' => ['date', 'desc'], 'price_low' => ['price', 'asc'], 'price_high' => ['price', 'desc'],
            default => ['id', 'asc'],
        };
        $params = [
            'category' => (string) $source['category_id'], 'catalog_visibility' => 'visible',
            'stock_status' => ['instock'], 'orderby' => $orderby, 'order' => $order, 'per_page' => 12,
            'attributes' => array_map(static fn (array $filter): array => ['attribute' => $filter['taxonomy'], 'term_id' => [$filter['term_id']], 'operator' => 'in'], $source['attributes']),
            'attribute_relation' => 'and',
        ];
        $excluded = $source['excluded_ids'] ?? [];
        $pins = array_values(array_diff($source['pinned_ids'] ?? [], $excluded));
        $selected = [];
        if ($pins !== []) {
            $rows = $this->query(array_replace($params, ['include' => $pins, 'per_page' => count($pins), 'orderby' => 'include']));
            if ($rows instanceof WP_Error) return $rows;
            $byId = array_column($rows, null, 'id');
            foreach ($pins as $id) if (isset($byId[$id])) $selected[$id] = $byId[$id];
        }
        if (count($selected) < 3) {
            $rows = $this->query($params + ['exclude' => array_values(array_unique([...$excluded, ...$pins]))]);
            if ($rows instanceof WP_Error) return $rows;
            foreach ($rows as $row) if (!in_array($row['id'], $excluded, true) && !in_array($row['id'], $pins, true)) $selected[$row['id']] = $row;
        }
        return new WP_REST_Response(array_slice(array_values($selected), 0, 3), 200, ['Cache-Control' => 'no-store']);
    }

    /** @param array<string, mixed> $params
     * @return list<array<string, mixed>>|WP_Error */
    private function query(array $params): array|WP_Error
    {
        $read = new WP_REST_Request('GET', '/wc/store/v1/products');
        foreach ($params as $key => $value) $read->set_param($key, $value);
        $response = rest_do_request($read);
        if ($response->get_status() >= 400 || !is_array($response->get_data())) return new WP_Error('wconvert_product_read', __('Products could not load. Try again.', 'wconvert'), ['status' => 503]);
        return array_values(array_filter($response->get_data(), static fn ($row): bool => is_array($row) && is_int($row['id'] ?? null) && ($row['is_purchasable'] ?? false) === true
            && ($row['is_in_stock'] ?? false) === true && ($row['is_password_protected'] ?? false) !== true));
    }

    /** Search up to 40 choices, plus the saved selection, so large catalogs remain usable. */
    public function options(WP_REST_Request $request): WP_REST_Response|WP_Error
    {
        if (!class_exists('WooCommerce')) return new WP_Error('wconvert_products_unavailable', __('Activate WooCommerce to choose products.', 'wconvert'), ['status' => 503]);
        $taxonomy = (string) $request->get_param('taxonomy');
        $search = (string) $request->get_param('search');
        $selected = (string) $request->get_param('selected');
        if ($taxonomy === 'attributes') {
            $choices = [];
            foreach (get_object_taxonomies('product') as $name) {
                $object = get_taxonomy($name);
                if (!$object) continue;
                if (str_starts_with($name, 'pa_') && ($name === $selected || stripos($object->labels->singular_name, $search) !== false)) $choices[] = ['id' => $name, 'name' => $object->labels->singular_name];
            }
            usort($choices, static fn (array $a, array $b): int => strcasecmp($a['name'], $b['name']));
            $chosen = array_values(array_filter($choices, static fn (array $choice): bool => $choice['id'] === $selected));
            return new WP_REST_Response(['items' => array_values(array_unique(array_merge($chosen, array_slice($choices, 0, 40)), SORT_REGULAR)), 'more' => count($choices) > 40]);
        }
        if ($taxonomy !== 'product_cat' && (!str_starts_with($taxonomy, 'pa_') || !is_object_in_taxonomy('product', $taxonomy))) return new WP_Error('wconvert_product_taxonomy', __('Choose an existing attribute.', 'wconvert'), ['status' => 400]);
        $terms = get_terms(['taxonomy' => $taxonomy, 'hide_empty' => false, 'number' => 41, 'search' => $search, 'orderby' => 'name', 'order' => 'ASC']);
        if ($terms instanceof WP_Error) return $terms;
        $chosen = $selected !== '' ? get_term((int) $selected, $taxonomy) : null;
        $more = count($terms) > 40;
        $terms = array_slice($terms, 0, 40);
        if ($chosen instanceof \WP_Term) array_unshift($terms, $chosen);
        $items = [];
        foreach ($terms as $term) $items[$term->term_id] = ['id' => (string) $term->term_id, 'name' => $term->name];
        return new WP_REST_Response(['items' => array_values($items), 'more' => $more]);
    }
}

<?php
/** TEST ONLY: mount in the disposable Playground. */
defined('ABSPATH') || exit;
add_action('template_redirect', static function (): void {
    if (!isset($_GET['wconvert_recommendations_fixture'])) return;
    update_option('woocommerce_coming_soon', 'no');
    $base = get_option('wconvert_commerce_fixture');
    if (!$base) wp_send_json_error('Initialize commerce fixture first', 400);
    $container = \WConvert\Bootstrap::container();
    $repository = $container->get(\WConvert\Optin\OptinRepository::class);
    $fixture = get_option('wconvert_product_recommendations_fixture');
    if (!$fixture) {
        $fixture = ['block_theme' => get_stylesheet(), 'campaigns' => []];
        foreach (['page', 'page_cross', 'cart_main', 'add'] as $mode) {
            $template = json_decode(file_get_contents(WCONVERT_PRO_DIR . 'modules/cart-recovery/templates/cart-accessories.json'), true);
            $node = &$template['tree']['steps'][0]['content']['children'][3];
            $node['context'] = $mode === 'cart_main' ? 'cart' : 'product';
            $node['main_product_id'] = $base['products'][0];
            $node['action'] = $mode === 'add' ? 'add_to_cart' : 'link';
            $node['source'] = in_array($mode, ['page', 'add'], true) ? 'selected' : 'cross_sells';
            $node['product_ids'] = $base['products']; // Includes self: the runtime must exclude it.
            unset($node);
            $config = ['display_type' => 'inline', 'display_rules' => ['audience' => ['mode' => 'everyone'], 'opening' => ['mode' => 'immediate']], 'template' => $template,
                'frequency' => ['stopAfterConversion' => false, 'stopAfterDismiss' => false], 'targeting' => ['include' => [['type' => 'singular', 'value' => 'product']]]];
            if ($mode === 'page') $config['inline_placement'] = ['position' => 'after_product_summary'];
            $campaign = $repository->create('Product accessories ' . $mode, $mode === 'add' ? 'increase_basket_value' : 'promote_offer', $config);
            if (!$repository->publish($campaign->id)) wp_die('Product fixture publication failed');
            $fixture['campaigns'][$mode] = $campaign->id;
        }
        $post = wp_insert_post(['post_type' => 'wp_template', 'post_status' => 'publish', 'post_name' => 'single-product', 'post_title' => 'Recommendation block fixture',
            'post_content' => '<!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group"><!-- wp:post-title {"level":1} /--><!-- wp:paragraph --><p>Manual campaign block in a real product template.</p><!-- /wp:paragraph --><!-- wp:wconvert/inline-optin {"optinId":"' . $fixture['campaigns']['page'] . '"} /--></div><!-- /wp:group -->']);
        wp_set_object_terms($post, $fixture['block_theme'], 'wp_theme');
        update_option('wconvert_product_recommendations_fixture', $fixture);
    }
    if (isset($_GET['options_required'])) update_option('wconvert_test_options_required', $_GET['options_required'] === '1');
    if (isset($_GET['add_published'])) { if ($_GET['add_published'] === '0') $repository->unpublish($fixture['campaigns']['add']); else $repository->publish($fixture['campaigns']['add']); }
    global $wpdb;
    $counts = $wpdb->get_results($wpdb->prepare("SELECT kind, SUM(count) AS total FROM {$wpdb->prefix}wconvert_stats WHERE optin_id = %s AND scope = '' GROUP BY kind", $fixture['campaigns']['add']), ARRAY_A);
    if (isset($_GET['login'])) { wp_set_current_user(1); wp_set_auth_cookie(1); }
    if (isset($_GET['theme'])) switch_theme($_GET['theme'] === 'classic' ? 'recommendations-classic' : $fixture['block_theme']);
    if (isset($_GET['addition_demo'])) {
        $add = $repository->find($fixture['campaigns']['add']);
        $config = $add->config;
        $config['inline_placement'] = ['position' => 'after_product_summary'];
        $repository->saveDraft($add->id, null, null, $config);
        $repository->publish($add->id);
        $repository->unpublish($fixture['campaigns']['page']);
        $templates = get_posts(['post_type' => 'wp_template', 'name' => 'single-product', 'posts_per_page' => 1]);
        if ($templates) wp_update_post(['ID' => $templates[0]->ID, 'post_content' => '<!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group"><!-- wp:woocommerce/mini-cart /--><!-- wp:post-title {"level":1} /--><!-- wp:paragraph --><p>Direct additions in a real block product template.</p><!-- /wp:paragraph --><!-- wp:wconvert/inline-optin {"optinId":"' . $add->id . '"} /--></div><!-- /wp:group -->']);
        update_option('wconvert_rc_addition_demo', true);
    }
    $revisions = [];
    foreach ($container->get(\WConvert\Optin\PublishedSet::class)->all() as $entry) $revisions[$entry['id']] = \WConvert\Pro\Module\CartRecovery\CommerceContext::revision($entry['payload']);
    $id = $base['products'][0];
    wp_send_json($fixture + ['runtime' => ['wordpress' => get_bloginfo('version'), 'php' => PHP_VERSION, 'woocommerce' => WC_VERSION], 'products' => $base['products'], 'variable' => $base['variable'], 'sold_out' => $base['sold_out'], 'draft' => $base['draft_accessory'], 'private' => $base['private_accessory'],
        'counts' => array_column($counts, 'total', 'kind'), 'cart_items' => array_values(array_map(static fn (array $item): array => ['id' => $item['product_id'], 'quantity' => $item['quantity']], WC()->cart->get_cart())), 'revisions' => $revisions, 'product_url' => get_permalink($id), 'other_url' => get_permalink($base['products'][1]), 'nonce' => current_user_can('manage_options') ? wp_create_nonce('wp_rest') : '',
        'main_token' => $id . ':' . wp_hash('wconvert-product:' . $id),
        'private_token' => $base['private_accessory'] . ':' . wp_hash('wconvert-product:' . $base['private_accessory']),
        'themes' => array_keys(wp_get_themes())]);
}, 25);

add_action('init', static function (): void { if (get_option('wconvert_test_options_required')) add_filter('woocommerce_add_to_cart_validation', '__return_false'); });
add_action('wp_footer', static function (): void {
    if (!get_option('wconvert_rc_addition_demo') || !is_singular('product') || wp_is_block_theme()) return;
    wp_enqueue_script('wc-cart-fragments');
    echo '<aside class="widget_shopping_cart" style="padding:24px"><h2>Classic mini-cart</h2><div class="widget_shopping_cart_content">';
    woocommerce_mini_cart();
    echo '</div></aside>';
}, 5);

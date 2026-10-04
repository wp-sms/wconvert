<?php
/** Disposable WooCommerce fixture. Mount only in the isolated commerce test site. */
add_action('template_redirect', static function (): void {
    if (!isset($_GET['wconvert_commerce_fixture']) || !class_exists('WooCommerce')) return;
    $container = \WConvert\Bootstrap::container();
    $repository = $container->get(\WConvert\Optin\OptinRepository::class);
    $fixture = get_option('wconvert_commerce_fixture');
    if (!$fixture) {
        $ids = [];
        foreach (['Coffee machine', 'Reusable coffee filters', 'Coffee cleaning brush', 'Coffee storage jar'] as $i => $name) {
            $product = new WC_Product_Simple(); $product->set_name($name); $product->set_status('publish');
            $product->set_regular_price((string) [100, 15, 8, 12][$i]); $product->set_stock_status('instock'); $ids[] = $product->save();
        }
        $template = json_decode(file_get_contents(WCONVERT_PRO_DIR . 'modules/cart-recovery/templates/cart-accessories.json'), true);
        $template['tree']['steps'][0]['content']['children'][3]['product_ids'] = array_slice($ids, 1);
        $plan = ['audience' => ['mode' => 'groups', 'groups' => [['id' => 'g1', 'match' => 'all', 'rules' => [['id' => 'r1', 'type' => 'cart_products', 'operator' => 'any', 'ids' => [$ids[0]]]]]]], 'opening' => ['mode' => 'immediate']];
        $campaign = $repository->create('Coffee accessories', 'promote_offer', ['display_type' => 'inline', 'display_rules' => $plan, 'template' => $template]);
        if (!$repository->publish($campaign->id)) wp_die('Commerce fixture publication failed');
        $fixture = ['id' => $campaign->id, 'products' => $ids]; update_option('wconvert_commerce_fixture', $fixture);
    }
    if (isset($_GET['login'])) { wp_set_current_user(1); wp_set_auth_cookie(1); }
    if (isset($_GET['checks'])) {
        $parent = new WC_Product_Variable(); $parent->set_name('Coffee filter options'); $parent->set_status('publish'); $parent->save();
        $variation = new WC_Product_Variation(); $variation->set_parent_id($parent->get_id()); $variation->set_status('publish'); $variation->set_regular_price('15'); $variation->save();
        $template = json_decode(file_get_contents(WCONVERT_PRO_DIR . 'modules/cart-recovery/templates/cart-accessories.json'), true);
        $config = ['template' => $template];
        $config['template']['tree']['steps'][0]['content']['children'][3]['product_ids'] = [$variation->get_id()];
        $unsupported = apply_filters('wconvert_publish_issues', [], $config);
        $config['template']['tree']['steps'][0]['content']['children'][3]['product_ids'] = [$parent->get_id(), $fixture['products'][1]];
        $supported = apply_filters('wconvert_publish_issues', [], $config);
        unset($config['template']);
        $config['display_rules'] = ['audience' => ['mode' => 'groups', 'groups' => [['id' => 'g1', 'match' => 'all', 'rules' => [['id' => 'r1', 'type' => 'cart_products', 'operator' => 'any', 'ids' => [$variation->get_id()]]]]]], 'opening' => ['mode' => 'immediate']];
        $cartRule = apply_filters('wconvert_publish_issues', [], $config);
        $draft = $container->get(\WConvert\Playbook\Prefill::class)->fromPlaybook('recommend-accessory');
        $variation->delete(true); $parent->delete(true);
        wp_send_json(['unsupported' => $unsupported, 'supported' => $supported, 'cart_rule' => $cartRule, 'targeting' => $draft['config']['targeting'] ?? [], 'checkout' => wc_get_page_id('checkout')]);
    }
    if (isset($_GET['basket'])) {
        WC()->cart->empty_cart();
        foreach (explode(',', (string) $_GET['basket']) as $index) if ($index !== '' && isset($fixture['products'][(int) $index])) WC()->cart->add_to_cart($fixture['products'][(int) $index]);
        WC()->cart->calculate_totals(); WC()->cart->set_session(); WC()->session->set_customer_session_cookie(true);
    }
    if (isset($_GET['json'])) wp_send_json($fixture);
    $cartMarkup = isset($_GET['blocks']) ? do_blocks((string) get_post_field('post_content', wc_get_page_id('cart'))) : '';
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html dir="' . (isset($_GET['rtl']) ? 'rtl' : 'ltr') . '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Commerce fixture</title>';
    wp_head();
    echo '<style>body{font:16px system-ui;margin:0;padding:16px}main{max-width:900px;margin:32px auto}</style></head><body><main><h1>Your coffee setup</h1><p>Real WooCommerce cart with selected accessories.</p>';
    echo do_shortcode('[wconvert_optin id="' . esc_attr($fixture['id']) . '"]');
    echo $cartMarkup;
    echo '<button id="host-button">Continue shopping</button></main>';
    wp_footer(); echo '</body></html>'; exit;
}, 30);

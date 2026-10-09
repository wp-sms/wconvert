<?php
/** Disposable integration fixture. Never packaged or installed on a saved site. */
if (!function_exists('wp_has_consent')) {
    function wp_has_consent($category) { return ($_COOKIE['wcv_test_consent'] ?? '') === 'allow'; }
}
add_filter('wp_get_consent_type', static fn ($type) => isset($_COOKIE['wcv_test_consent']) ? 'optin' : $type);
add_action('template_redirect', static function (): void {
    $action = $_GET['wconvert_revenue_fixture'] ?? '';
    if (!$action || !function_exists('WC')) return;
    $container = \WConvert\Bootstrap::container();
    $hooks = new \WConvert\Pro\Module\Analytics\RevenueHooks(
        $container->get(\WConvert\Storage\OptionStore::class), $container->get(\WConvert\Optin\PublishedSet::class),
        $container->get(\WConvert\Lead\LeadRepository::class), $container->get(\WConvert\Rest\RateLimit::class),
        $container->get(\WConvert\Rules\Degradation::class));
    if ($action === 'seed') {
        $repo = $container->get(\WConvert\Optin\OptinRepository::class);
        $draft = $container->get(\WConvert\Playbook\Prefill::class)->fromScratch(\WConvert\Goal\Goal::PromoteOffer);
        $draft['config']['template'] = json_decode(file_get_contents(WCONVERT_DIR . 'resources/templates/library/flash-offer.json'), true);
        $link = static function (array &$node) use (&$link): void { if (($node['action'] ?? '') === 'link') $node['href'] = home_url('/shop'); foreach ($node['children'] ?? [] as $key => $child) $link($node['children'][$key]); };
        $link($draft['config']['template']['tree']['steps'][0]['content']);
        $campaign = $repo->create('Fixture offer', $draft['goal'], $draft['config']);
        $published = $repo->publish($campaign->id);
        update_option('wconvert_revenue', ['enabled' => true, 'home' => home_url('/'), 'since' => gmdate('c')], false);
        wp_send_json(['id' => $campaign->id, 'published' => $published !== null]);
    }
    if ($action === 'state') wp_send_json(['pending' => WC()->session ? WC()->session->get('wconvert_attribution') : null]);
    if ($action === 'expired' && WC()->session) {
        $value = WC()->session->get('wconvert_attribution'); $value['at'] = time() - 1801;
        WC()->session->set('wconvert_attribution', $value); WC()->session->save_data(); wp_send_json(['ok' => true]);
    }
    if ($action === 'cart') {
        $product = new WC_Product_Simple(); $product->set_name('Checkout fixture'); $product->set_regular_price('20'); $product->set_virtual(true); $product->set_status('publish'); $product->save();
        update_option('woocommerce_cod_settings', ['enabled' => 'yes', 'title' => 'Test cash on delivery', 'enable_for_virtual' => 'yes']);
        WC()->cart->add_to_cart($product->get_id()); WC()->cart->calculate_totals(); WC()->session->save_data();
        wp_send_json(['nonce' => wp_create_nonce('woocommerce-process_checkout'), 'store_nonce' => wp_create_nonce('wc_store_api')]);
    }
    if ($action === 'credit') { $order = wc_get_order((int) $_GET['order']); wp_send_json(['credit' => $order->get_meta('_wconvert_attribution')]); }
    if ($action === 'checkout') {
        $order = wc_create_order();
        $item = new WC_Order_Item_Product(); $item->set_name('Fixture product'); $item->set_quantity(1); $item->set_subtotal(120); $item->set_total(100); $order->add_item($item);
        if (isset($_GET['old'])) $order->set_date_created(time() - DAY_IN_SECONDS);
        $order->set_currency($_GET['currency'] ?? 'USD'); $order->calculate_totals(false); $order->save();
        do_action(($_GET['blocks'] ?? '') === '1' ? 'woocommerce_store_api_checkout_order_processed' : 'woocommerce_checkout_order_created', $order);
        $credit = $order->get_meta('_wconvert_attribution');
        // Replayed hook must not bind again or modify provenance.
        do_action('woocommerce_checkout_order_created', $order);
        if (($_GET['paid'] ?? '') !== '0') { $order->payment_complete(); $order->set_date_paid(time() - DAY_IN_SECONDS); $order->save(); }
        wp_send_json(['id' => $order->get_id(), 'credit' => $credit, 'again' => $order->get_meta('_wconvert_attribution'), 'item' => $item->get_id()]);
    }
    if ($action === 'refund') {
        $order = wc_get_order((int) $_GET['order']);
        $lines = ($_GET['allocated'] ?? '') === '1' ? [(int) $_GET['item'] => ['qty' => 0, 'refund_total' => 25, 'refund_tax' => []]] : [];
        $refund = wc_create_refund(['order_id' => $order->get_id(), 'amount' => 25, 'line_items' => $lines, 'refund_payment' => false]);
        wp_send_json(['ok' => !is_wp_error($refund)]);
    }
    if ($action === 'report') wp_send_json((new \WConvert\Pro\Module\Analytics\RevenueReport())->read(\WConvert\Stats\StatRange::completeDays(7, \WConvert\Stats\StatDay::today()), $_GET['campaign'] ?? ''));
    if ($action === 'erase') { $order = wc_get_order((int) $_GET['order']); do_action('woocommerce_privacy_remove_order_personal_data', $order); wp_send_json(['credit' => wc_get_order($order->get_id())->get_meta('_wconvert_attribution')]); }
    if ($action === 'storage') {
        $sync = wc_get_container()->get(\Automattic\WooCommerce\Internal\DataStores\Orders\DataSynchronizer::class);
        for ($batch = 0; $batch < 10; $batch++) { $ids = $sync->get_next_batch_to_process(100); if (!$ids) break; $sync->process_batch($ids); }
        update_option('woocommerce_custom_orders_table_enabled', ($_GET['hpos'] ?? '') === '1' ? 'yes' : 'no');
        wp_send_json(['ok' => true, 'hpos' => get_option('woocommerce_custom_orders_table_enabled')]);
    }
    wp_send_json(['error' => 'unknown'], 400);
});

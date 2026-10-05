<?php
/** THROWAWAY. Test-only auth/fixtures; mount only in the disposable spike server. */
add_action('template_redirect', static function (): void {
    if (!isset($_GET['wconvert_rc_status'])) return;
    $fixture = get_option('wconvert_product_recommendations_fixture');
    $repository = \WConvert\Bootstrap::container()->get(\WConvert\Optin\OptinRepository::class);
    global $wpdb;
    $campaigns = [];
    foreach ($fixture['campaigns'] ?? [] as $key => $id) {
        $campaign = $repository->find($id);
        $campaigns[$key] = ['id' => $id, 'snapshot' => hash('sha256', wp_json_encode([$campaign->goal, $campaign->config, $campaign->publishedConfig])),
            'stats' => $wpdb->get_results($wpdb->prepare("SELECT kind, SUM(count) AS total FROM {$wpdb->prefix}wconvert_stats WHERE optin_id = %s GROUP BY kind ORDER BY kind", $id), ARRAY_A)];
    }
    wp_send_json(['runtime' => ['wordpress' => get_bloginfo('version'), 'php' => PHP_VERSION, 'woocommerce' => defined('WC_VERSION') ? WC_VERSION : null],
        'addition_available' => class_exists(\WConvert\Pro\Module\CartRecovery\CartAddition::class), 'campaigns' => $campaigns]);
}, 1);
defined('ABSPATH') || exit;
add_action('wc_ajax_wconvert_spike_tokens', static function (): void {
    nocache_headers();
    wp_send_json(['nonce' => wp_create_nonce('wc_store_api'), 'rest' => wp_create_nonce('wp_rest'), 'logged_in' => is_user_logged_in()]);
});
add_action('wp_footer', static function (): void {
    if (!isset($_GET['wconvert_commerce_fixture'])) return;
    $fixture = get_option('wconvert_commerce_fixture');
    if (!$fixture) return;
    wp_enqueue_script('wc-cart-fragments');
    if (!isset($_GET['blocks'])) {
        echo '<aside class="widget_shopping_cart"><h2>Classic mini-cart</h2><div class="widget_shopping_cart_content">';
        woocommerce_mini_cart();
        echo '</div></aside>';
    }
    // Footer placement of the spike controls leaves real WooCommerce Blocks visible above.
    echo '<section style="padding:20px;border:2px solid #126d78;margin:20px"><h2>Disposable add-to-cart spike</h2><p>These buttons change only this disposable fixture basket.</p><button id="spike-api">Add filter through Store API</button> <button id="spike-blocks">Add brush through Blocks store</button><pre id="spike-result" role="status"></pre></section>';
    ?>
    <script>
    (() => {
      const ids = <?php echo wp_json_encode($fixture['products']); ?>;
      const output = document.getElementById('spike-result');
      let pending = false;
      const perform = async mode => {
        if (pending) return;
        pending = true;
        output.textContent = 'Adding…';
        try {
          if (mode === 'blocks') {
            await window.wp.data.dispatch('wc/store/cart').addItemToCart(ids[2], 1);
          } else {
            const tokens = await (await fetch('/?wc-ajax=wconvert_spike_tokens', { method: 'POST' })).json();
            const result = await fetch('/?rest_route=/wc/store/v1/cart/add-item', { method: 'POST', headers: { 'Content-Type': 'application/json', Nonce: tokens.nonce, 'X-WP-Nonce': tokens.rest }, body: JSON.stringify({ id: ids[1], quantity: 1 }) });
            const cart = await result.json();
            if (!result.ok) throw new Error(cart.message || 'Rejected');
            if (window.wp?.data?.dispatch('wc/store/cart')?.receiveCart) window.wp.data.dispatch('wc/store/cart').receiveCart(cart);
            window.jQuery?.(document.body).trigger('wc_fragment_refresh');
            document.dispatchEvent(new Event('wc-blocks_added_to_cart'));
          }
          const cart = await (await fetch('/?wc-ajax=wconvert_spike_tokens', { method: 'POST' })).json();
          output.textContent = 'Confirmed by WooCommerce. ' + (cart.logged_in ? 'Authenticated' : 'Guest') + ' session. Check the cart above.';
        } catch (error) { output.textContent = 'Not confirmed: ' + error.message; }
        finally { pending = false; }
      };
      document.getElementById('spike-api').onclick = () => perform('api');
      document.getElementById('spike-blocks').onclick = () => perform('blocks');
    })();
    </script>
    <?php
}, 5);

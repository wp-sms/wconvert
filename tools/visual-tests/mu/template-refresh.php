<?php
/** Disposable WordPress only: current template compatibility and commerce review. */
add_action('template_redirect', static function (): void {
    if (!isset($_GET['wconvert_template_refresh'])) return;
    if (!defined('WCONVERT_DS_SECRET') || !in_array(wp_parse_url(home_url(), PHP_URL_HOST), ['127.0.0.1', 'localhost'], true)) wp_die('Disposable local site required.');
    $container = \WConvert\Bootstrap::container();
    $library = $container->get(\WConvert\Template\TemplateLibrary::class);
    $prefill = $container->get(\WConvert\Playbook\Prefill::class);
    $repository = $container->get(\WConvert\Optin\OptinRepository::class);
    $fixture = get_option('wconvert_commerce_fixture');
    if (!$fixture) wp_die('Seed the disposable commerce fixture first.');
    $selection = (string) $_GET['wconvert_template_refresh'];
    if ($selection === 'registration') {
        $collection = json_decode(file_get_contents(WCONVERT_DIR . 'tools/design-library/pilot/collection.json'), true);
        $checks = [];
        foreach ($collection['entries'] as $entry) {
            $draft = $prefill->fromPlaybook($entry['id']);
            if (!$draft || !$library->find($draft['config']['template_id'])) wp_die('Missing current setup: ' . esc_html($entry['id']));
            $normal = $container->get(\WConvert\Template\TemplateVocabulary::class)->normalize($draft['config']['template']);
            if ($normal != $draft['config']['template']) wp_die('Prepared design loses data: ' . esc_html($entry['id']));
            $checks[] = $entry['id'];
        }
        wp_send_json(['php' => PHP_VERSION, 'root' => WCONVERT_DIR, 'prepared' => count($checks), 'setups' => $checks]);
    }
    $ids = ['add-useful-extras', 'recommend-accessory', 'shopping-guidance', 'explore-compatible-extras', 'basket-cross-sells', 'coffee-taste-finder', 'finish-the-set'];
    if (!in_array($selection, $ids, true)) wp_die('Unknown review setup');
    $saved = get_option('wconvert_template_refresh', []);
    foreach ($repository->summaries() as $row) {
        if ($row['published_at'] !== null && $row['id'] !== ($saved[$selection] ?? null)) $repository->unpublish($row['id']);
    }
    if (isset($_GET['refresh']) && isset($saved[$selection])) {
        $repository->delete($saved[$selection]);
        unset($saved[$selection]);
        update_option('wconvert_template_refresh', $saved);
    }
    if (!isset($saved[$selection])) {
        $draft = $prefill->fromPlaybook($selection);
        if (!$draft) wp_die('Setup missing');
        $config = $draft['config'];
        if ($selection === 'shopping-guidance') {
            $guide = get_page_by_path('collection-review-shopping-guide');
            $guideId = wp_insert_post(['ID' => $guide?->ID ?? 0, 'post_type' => 'page', 'post_status' => 'publish', 'post_name' => 'collection-review-shopping-guide', 'post_title' => 'Choosing accessories', 'post_content' => '<p>Check the brewer model, filter size and material before adding accessories. These reusable filters suit the demonstration coffee brewer.</p>']);
            $guideUrl = get_permalink($guideId);
            $config['template'] = \WConvert\Template\TemplateTree::rewrittenIn(['template' => $config['template']], static function (array $node) use ($guideUrl): array {
                if (($node['type'] ?? '') === 'button' && ($node['action'] ?? '') === 'link') $node['href'] = $guideUrl;
                return $node;
            })['template'];
        }

        $config['inline_placement'] = ['position' => 'manual'];
        // A popup's own delay is not what this review checks; show it on arrival.
        if ($selection === 'finish-the-set') $config['display_rules'] = \WConvert\Rules\DisplayPlan::immediate();
        $config['template']['tree'] = \WConvert\Template\TemplateTree::rewrittenIn(['template' => ['tree' => $config['template']['tree']]], static function (array $node) use ($fixture): array {
            if (($node['type'] ?? '') === 'products') {
                if (($node['context'] ?? '') === 'product' || array_key_exists('main_product_id', $node)) $node['main_product_id'] = $fixture['products'][0];
                if (($node['source'] ?? 'selected') === 'selected') $node['product_ids'] = [$fixture['products'][1], $fixture['products'][2]];
            }
            return $node;
        })['template']['tree'];
        if ($selection === 'coffee-taste-finder') {
            $categories = [];
            foreach (['Bright coffee', 'Smooth coffee', 'Explore coffee'] as $i => $name) {
                $term = wp_insert_term($name, 'product_cat');
                $termId = is_wp_error($term) ? (int) $term->get_error_data('term_exists') : $term['term_id'];
                $product = new WC_Product_Simple(); $product->set_name($name); $product->set_status('publish'); $product->set_regular_price('12'); $product->set_category_ids([$termId]); $product->save();
                $categories[] = $termId;
            }
            foreach ($config['template']['tree']['steps'] as &$screen) if ($screen['kind'] === 'result') {
                foreach ($screen['results'] as $i => &$result) {
                    $result['product_filter']['category_id'] = $categories[$i];
                    $result['href'] = home_url('/shop/'); $result['link_label'] = 'Browse all coffees';
                }
                unset($result);
            }
            unset($screen);
        }
        $campaign = $repository->create($draft['name'], $draft['goal'], $config);
        if (!$repository->publish($campaign->id)) wp_die('Could not publish prepared example: ' . esc_html($selection));
        $saved[$selection] = $campaign->id; update_option('wconvert_template_refresh', $saved);
    }
    if (isset($_GET['basket'])) {
        WC()->cart->empty_cart();
        if ($_GET['basket'] !== '') WC()->cart->add_to_cart($fixture['products'][0]);
        WC()->cart->set_session();
    }
    if (isset($_GET['json'])) wp_send_json(['campaign' => $saved[$selection], 'url' => add_query_arg('wconvert_template_refresh', $selection, get_permalink($fixture['products'][0])), 'products' => $fixture['products']]);
    echo '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Commerce template review</title>';
    wp_head();
    echo '<style>body{font:16px/1.5 system-ui;margin:0;padding:16px;background:#f2f4ef;color:#273c32}main{max-width:960px;margin:24px auto}h1{font-size:24px}</style></head><body><main><h1>Disposable shop: ' . esc_html($draft['name'] ?? $selection) . '</h1>';
    echo do_shortcode('[wconvert_optin id="' . esc_attr($saved[$selection]) . '"]');
    echo '</main>'; wp_footer(); echo '</body></html>'; exit;
}, 31);

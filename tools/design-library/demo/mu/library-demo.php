<?php
/** Disposable practical-review site. Never install this MU plugin on a saved site. */
declare(strict_types=1);
if (!defined('WCONVERT_LIBRARY_DEMO') || WCONVERT_LIBRARY_DEMO !== true) return;
wp_register_plugin_realpath(WP_CONTENT_DIR . '/plugins/wconvert/wconvert.php');
wp_register_plugin_realpath(WP_CONTENT_DIR . '/plugins/wconvert-pro/wconvert-pro.php');
require_once WP_CONTENT_DIR . '/plugins/wconvert/wconvert.php';
require_once WP_CONTENT_DIR . '/plugins/wconvert-pro/wconvert-pro.php';
require_once __DIR__ . '/resources.php';
require_once __DIR__ . '/scenarios.php';
require_once __DIR__ . '/decision-support.php';

add_action('init', static function (): void {
    if (get_option('wconvert_demo_installed')) return;
    \WConvert\Bootstrap::container()->get(\WConvert\Database\Installer::class)->install();
    update_option('wconvert_demo_installed', true, false);
}, 0);

// Exercise WordPress mail handoff, but keep every message in this local outbox.
// A recorded message proves local handoff, never inbox delivery.
add_filter('pre_wp_mail', static function ($return, array $mail): bool {
    $messages = get_option('wconvert_demo_outbox', []);
    $messages[] = $mail;
    update_option('wconvert_demo_outbox', array_slice($messages, -100), false);
    return true;
}, 10, 2);
add_filter('action_scheduler_allow_async_request_runner', '__return_false');

function wconvert_demo_rest(string $method, string $path, array $data = []): array {
    $request = new WP_REST_Request($method, '/wconvert/v1/' . $path);
    $request->set_body_params($data);
    $response = rest_do_request($request);
    if ($response->get_status() >= 400) throw new RuntimeException(wp_json_encode($response->get_data()));
    return $response->get_data();
}

function wconvert_demo_page(string $slug, string $title, string $content): int {
    $existing = get_page_by_path($slug);
    return (int) wp_insert_post(['ID' => $existing?->ID ?? 0, 'post_type' => 'page', 'post_status' => 'publish', 'post_name' => $slug, 'post_title' => $title, 'post_content' => $content]);
}

function wconvert_demo_seed(array $only = []): array {
    $root = WP_CONTENT_DIR . '/plugins/wconvert';
    $briefs = json_decode(file_get_contents($root . '/tools/design-library/pilot/collection.json'), true)['entries'];
    if ($only !== []) {
        $known = array_column($briefs, 'id');
        if (array_diff($only, $known)) throw new InvalidArgumentException('Unknown campaign in review selection');
        $briefs = array_values(array_filter($briefs, static fn (array $brief): bool => in_array($brief['id'], $only, true)));
    }
    $container = \WConvert\Bootstrap::container();
    \WConvert\Optin\PhoneCountry::setSiteDefault('GB');
    $privacy = wconvert_demo_page('demo-privacy', 'Demo privacy notice', '<p>This disposable review site keeps test submissions locally. Use fictional details. Email is recorded in a local outbox; nothing is sent externally.</p>');
    update_option('wp_page_for_privacy_policy', $privacy);
    $shop = wconvert_demo_page('demo-shop', 'Garden & home — sample collection', '<p>Browse our demonstration products. This site takes no payments.</p>');
    update_option('woocommerce_shop_page_id', $shop);
    $cart = wconvert_demo_page('demo-cart', 'Your sample basket', '[woocommerce_cart]');
    update_option('woocommerce_cart_page_id', $cart);
    update_option('woocommerce_currency', 'GBP');
    update_option('woocommerce_default_country', 'GB');
    update_option('woocommerce_coming_soon', 'no');
    if (class_exists('WC_Shipping_Zone') && !get_option('wconvert_demo_shipping')) {
        $zone = new WC_Shipping_Zone();
        $zone->set_zone_name('Demo UK');
        $zone->add_location('GB', 'country');
        $zone->save();
        $flat = $zone->add_shipping_method('flat_rate');
        update_option('woocommerce_flat_rate_' . $flat . '_settings', ['title' => 'UK delivery', 'cost' => '4', 'tax_status' => 'none']);
        $free = $zone->add_shipping_method('free_shipping');
        update_option('woocommerce_free_shipping_' . $free . '_settings', ['title' => 'Free UK delivery', 'requires' => 'min_amount', 'min_amount' => '40.01']);
        update_option('wconvert_demo_shipping', $zone->get_id(), false);
    }
    $packaging = wconvert_demo_page('demo-packaging', 'How we pack your order', '<h2>Protect the product</h2><p>Our sample shop uses a fitted cardboard box and paper padding. Keep the packaging dry and flatten it before recycling where accepted locally.</p><h2>Delivery</h2><p>Sample UK delivery is free for orders over £40; otherwise £4. This review site accepts no payments or orders.</p>');
    $essay = wconvert_demo_page('demo-essay', 'Make room for a second draft', '<p>A first draft helps you discover what you mean. A second draft helps another person understand it.</p><h2>Start with the reader</h2><p>Write down the question your reader brought to the page. Move the sentence that answers it towards the beginning.</p><h2>Give each paragraph a job</h2><p>Read only the opening sentence of each paragraph. Reorder them until the argument is clear, then remove examples that repeat the same point.</p>');
    $membership = wconvert_demo_page('demo-membership', 'About the reader membership', '<h2>Example benefits</h2><p>The full essay archive, a monthly editorial letter and an online discussion of that month’s reading.</p><h2>Illustrative price and terms</h2><p>£5 per month, with monthly renewal and cancellation before the next renewal. These are fictional demonstration terms, not an offer for sale.</p><p>This is an information page for the campaign review. Membership checkout is not enabled and no membership is created.</p>');
    $growing = wconvert_demo_page('demo-growing', 'Getting started with growing', '<h2>Choose a suitable spot</h2><p>Observe the available light and select a plant suited to it.</p><h2>Start small</h2><p>Use one container with drainage and follow the plant’s growing instructions.</p><h2>Check regularly</h2><p>Check soil moisture before watering and adjust care to the plant and season.</p>');
    $everyday = wconvert_demo_page('demo-everyday-care', 'A beginner’s guide to everyday plant care', '<h2>Observe first</h2><p>Check leaves and soil before deciding what the plant needs.</p><h2>Water thoughtfully</h2><p>Follow the plant’s instructions and allow excess water to drain.</p><h2>Keep a short note</h2><p>Record changes in light and watering so you can learn what works in your space.</p>');
    $resource = wconvert_demo_page('demo-care-guide', 'Knitwear care guide', '<h2>Wash gently</h2><p>Follow the care label. Use cool water and a wool-safe detergent when suitable.</p><h2>Dry flat</h2><p>Reshape on a clean towel. Avoid hanging wet knitwear.</p><h2>Store well</h2><p>Store clean and fully dry, folded away from direct light.</p>');
    $planning = wconvert_demo_page('demo-planning-guide', 'Renovation planning checklist', '<h2>Define your project</h2><p>List rooms, priorities and constraints.</p><h2>Prepare your brief</h2><p>Record measurements, photographs and questions for your contractor.</p><h2>Agree next steps</h2><p>Discuss scope, budget, approvals and timing before work begins.</p>');
    $event = wconvert_demo_page('demo-workshop', 'Writing workshop — registration information', '<p>Sample workshop: Saturday, 10:00–11:30, online. Bring one draft and a question for the group.</p><p>This is a demonstration; no real event booking is made.</p>');
    $services = wconvert_demo_page('demo-services', 'Seasonal home services', '<h2>Prepare your home for the season</h2><p>Discuss maintenance, exterior repairs and garden preparation with our sample service team. Enquiries are reviewed before any appointment is confirmed.</p>');
    $products = get_option('wconvert_demo_products', []);
    if ($products === [] && class_exists('WC_Product_Simple')) {
        foreach (['Sunny border planter', 'Compact balcony planter', 'Shade garden pot'] as $name) {
            $product = new WC_Product_Simple();
            $product->set_name($name); $product->set_status('publish'); $product->set_regular_price('24');
            $product->set_description('A sample garden product for reviewing recommendations and basket recovery. No checkout or payments.');
            $products[] = $product->save();
        }
        update_option('wconvert_demo_products', $products, false);
        $coupon = new WC_Coupon(); $coupon->set_code('DEMO10'); $coupon->set_discount_type('percent'); $coupon->set_amount(10); $coupon->set_usage_limit_per_user(1); $coupon->save();
    }
    $saved = get_option('wconvert_demo_campaigns', []);
    foreach ($products as $productId) {
        $product = wc_get_product($productId);
        if (!$product) continue;
        $product->set_description('<p>A fictional sample planter for campaign review. No checkout or payments.</p><h2>Materials and dimensions</h2><p>Glazed ceramic; 20 cm diameter, 18 cm high. Drainage hole and matching saucer.</p><h2>Care</h2><p>Wipe with a damp cloth. Empty excess water from the saucer. Protect from frost.</p>');
        $product->save();
    }
    foreach (['sizing-guide', 'gift-planning-guide', 'project-readiness-guide', 'writing-checklist'] as $resourceKey) {
        $existingResource = get_page_by_path('resource-' . $resourceKey);
        if ($existingResource) wp_update_post(['ID' => $existingResource->ID, 'post_content' => wconvert_demo_resource($resourceKey)]);
    }
    $decisionFixtures = wconvert_demo_decision_fixtures();
    $contextualPages = [];
    foreach (json_decode(file_get_contents(__DIR__ . '/../contextual-fixtures.json'), true) as $key => [$title, $sections]) {
        $contextualPages[$key] = wconvert_demo_page('contextual-' . $key, $title, wconvert_demo_resource($key));
    }
    foreach ($briefs as $brief) {
        $key = $brief['id'];
        try {
            $draft = $container->get(\WConvert\Playbook\Prefill::class)->fromPlaybook($key);
            if ($draft === null) throw new RuntimeException('Playbook unavailable');
            $revision = hash('sha256', 'decision-fixtures-v2:' . wp_json_encode($draft));
            if (($saved[$key]['revision'] ?? '') === $revision) continue;
            $page = wconvert_demo_page('demo-' . $key, $draft['name'], '<p>Practical campaign review. Use fictional contact details; submissions are stored on this disposable site.</p>');
            $config = $draft['config'];
            $config['capture_mode'] = 'local';
            $config['display_rules']['opening'] = ['mode' => 'immediate'];
            $config['frequency'] = ['stopAfterDismiss' => false, 'stopAfterConversion' => false];
            $config['targeting'] = ['mode' => 'selected', 'include' => [['type' => 'post', 'value' => (string) $page]]];
            $guidePage = null;
            if ($draft['goal'] === 'deliver_lead_magnet') {
                $guidePage = $key === 'product-care-guide' ? $resource : ($key === 'project-planning-guide' ? $planning : wconvert_demo_page('resource-' . $key, $draft['name'], wconvert_demo_resource($key)));
            }
            $url = get_permalink(match ($key) {
                'event-registration-link' => $event,
                'packaging-details' => $packaging,
                'related-essay' => $essay,
                'membership-details' => $membership,
                default => $brief['audience'] === 'services' ? $services : $shop,
            });
            if (isset($decisionFixtures['pages'][$key])) $url = get_permalink($decisionFixtures['pages'][$key]);
            if (isset($contextualPages[$key])) $url = get_permalink($contextualPages[$key]);
            // Leave cart links unconfigured so the shipping WooCommerce adapter resolves them.
            if ($draft['goal'] === 'recover_cart') $url = '';
            $config = \WConvert\Template\TemplateTree::rewrittenIn($config, static function (array $node) use ($url, $guidePage): array {
                if (($node['type'] ?? '') === 'button' && ($node['action'] ?? '') === 'link') $node['href'] = $url;
                if (($node['role'] ?? '') === 'success_action' && $guidePage) {
                    $node['href'] = get_permalink($guidePage);
                    $node['hidden'] = false;
                }
                if (($node['type'] ?? '') === 'code') $node['text'] = 'DEMO10';
                return $node;
            });
            foreach ($config['template']['tree']['steps'] as &$step) {
                foreach ($step['results'] ?? [] as $index => $result) {
                    $step['results'][$index]['href'] = $url;
                    $step['results'][$index]['link_label'] = 'Explore the sample collection';
                    if ($key === 'content-guide') {
                        $step['results'][$index]['href'] = get_permalink($result['id'] === 'growing' ? $growing : $everyday);
                        $step['results'][$index]['link_label'] = 'Read the guide';
                    }
                    if ($step['products_required'] ?? false) $step['results'][$index]['product_ids'] = [$products[$index % count($products)]];
                    $decisionResult = wconvert_demo_decision_result($key, $result['id'], $decisionFixtures);
                    if ($decisionResult !== null) $step['results'][$index] = array_replace($step['results'][$index], $decisionResult);
                }
            }
            unset($step);
            if ($draft['goal'] === 'deliver_lead_magnet') {
                unset($config['capture_mode']);
                $destination = $container->get(\WConvert\Destination\DestinationStore::class)->save($saved[$key]['destination'] ?? null, 'lead_magnet_email', 'Demo resource: ' . $key, null, [
                    'file_url' => get_permalink($guidePage),
                    'subject' => 'Your requested guide', 'body' => 'Here is the resource you requested: {link}',
                ]);
                $config['destinations'] = [$destination->id];
            }
            if ($key === 'sale-deadline') $config['schedule'] = ['ends_at' => gmdate('Y-m-d\TH:i', time() + 7 * DAY_IN_SECONDS), 'timezone' => 'UTC'];
            $created = wconvert_demo_rest(isset($saved[$key]) ? 'PATCH' : 'POST', isset($saved[$key]) ? 'optins/' . $saved[$key]['id'] : 'optins', ['name' => 'Demo · ' . $draft['name'], 'goal' => $draft['goal'], 'config' => $config]);
            $id = $created['id'];
            wconvert_demo_rest('POST', 'optins/' . $id . '/publish');
            if ($config['display_type'] === 'inline') wp_update_post(['ID' => $page, 'post_content' => '<p>Read the example, then try the campaign below.</p>[wconvert_optin id="' . $id . '"]']);
            $saved[$key] = ['id' => $id, 'page' => $page, 'name' => $draft['name'], 'type' => $config['display_type'], 'revision' => $revision, 'destination' => $config['destinations'][0] ?? null];
            update_option('wconvert_demo_campaigns', $saved, false);
        } catch (Throwable $error) { $errors[$key] = $error->getMessage(); }
    }
    return $errors ?? [];
}

add_action('template_redirect', static function (): void {
    if (!isset($_GET['library-demo'])) return;
    if (!current_user_can('manage_options')) { auth_redirect(); exit; }
    $errors = [];
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        check_admin_referer('wconvert-library-demo');
        $errors = wconvert_demo_seed();
        if (class_exists('ActionScheduler_QueueRunner')) ActionScheduler_QueueRunner::instance()->run();
    }
    $campaigns = get_option('wconvert_demo_campaigns', []);
    $leads = \WConvert\Bootstrap::container()->get(\WConvert\Lead\LeadRepository::class);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Campaign practical review</title><style>body{font:16px/1.6 system-ui;color:#243650;background:#f5f7fa;max-width:1100px;margin:40px auto;padding:24px}h1{font-size:32px}a{color:#244da1}table{width:100%;border-collapse:collapse}td,th{padding:12px;text-align:left;border-bottom:1px solid #ccd4df}button{font:inherit;padding:12px 20px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><h1>Campaign practical review</h1><p>Real WordPress campaigns, saved leads and a local mail outbox. Test data only. No external email or payments.</p><form method="post">';
    wp_nonce_field('wconvert-library-demo');
    echo '<button>Create missing demos & process queued mail</button></form>';
    foreach ($errors as $key => $error) echo '<p role="alert">' . esc_html($key . ': ' . $error) . '</p>';
    echo '<p><a href="' . esc_url(home_url('/?library-scenarios=1')) . '">Open the three business walkthroughs →</a></p>';
    echo '<table><thead><tr><th>Campaign</th><th>Type</th><th>Leads</th><th>Edit</th></tr></thead><tbody>';
    foreach ($campaigns as $entry) {
        echo '<tr><td><a href="' . esc_url(get_permalink($entry['page'])) . '">' . esc_html($entry['name']) . '</a></td><td>' . esc_html($entry['type']) . '</td><td>' . $leads->submissions($entry['id']) . '</td><td><a href="' . esc_url(admin_url('admin.php?page=wconvert#optins?edit=' . $entry['id'])) . '">Edit campaign</a></td></tr>';
    }
    echo '</tbody></table><h2>Saved lead evidence</h2><pre>' . esc_html(wp_json_encode(array_map(static fn ($lead) => $lead->toArray(), $leads->page(null, 100)), JSON_PRETTY_PRINT)) . '</pre><h2>Local mail outbox — not inbox delivery</h2><pre>' . esc_html(wp_json_encode(get_option('wconvert_demo_outbox', []), JSON_PRETTY_PRINT)) . '</pre></body></html>';
    exit;
});

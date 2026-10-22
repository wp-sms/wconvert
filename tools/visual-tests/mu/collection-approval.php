<?php
/** Configured examples of any studio setup, for its automated checks (setup-checks.mjs). Disposable loopback WordPress only. */
add_filter('pre_wp_mail', static function ($result, array $mail) {
    if (!defined('WCONVERT_DS_SECRET') || !in_array(wp_parse_url(home_url(), PHP_URL_HOST), ['127.0.0.1', 'localhost'], true)) return $result;
    $outbox = get_option('wconvert_collection_review_outbox', []);
    $outbox[] = $mail;
    update_option('wconvert_collection_review_outbox', array_slice($outbox, -50), false);
    return true;
}, 10, 2);
add_action('template_redirect', static function (): void {
    if (!isset($_GET['wconvert_collection_approval'])) return;
    if (!defined('WCONVERT_DS_SECRET') || !in_array(wp_parse_url(home_url(), PHP_URL_HOST), ['127.0.0.1', 'localhost'], true)) wp_die('Disposable review site required.');
    try {
        $studio = json_decode(file_get_contents(WCONVERT_DIR . 'tools/design-library/pilot/collection.json'), true);
        $ids = array_column($studio['entries'], 'id');
        $id = sanitize_key($_GET['wconvert_collection_approval']);
        if (!in_array($id, $ids, true)) wp_die('Unknown studio setup.');
        if (isset($_GET['outbox'])) {
            if (class_exists('ActionScheduler_QueueRunner')) ActionScheduler_QueueRunner::instance()->run();
            wp_send_json(get_option('wconvert_collection_review_outbox', []));
        }
        $container = \WConvert\Bootstrap::container();
        $repository = $container->get(\WConvert\Optin\OptinRepository::class);
        if (isset($_GET['discovery'])) {
            $before = wp_json_encode($repository->summaries());
            wp_set_current_user((int) username_exists('admin'));
            $request = new WP_REST_Request('GET', '/wconvert/v1/picker');
            $response = rest_do_request($request);
            wp_send_json(['status' => $response->get_status(), 'data' => $response->get_data(), 'campaigns_unchanged' => $before === wp_json_encode($repository->summaries())]);
        }
        $draft = $container->get(\WConvert\Playbook\Prefill::class)->fromPlaybook($id);
        if (!$draft) wp_die('Missing setup.');
        $resources = [
            'writing-checklist' => ['Your seven-point writing checklist', '<ol><li>State your point in one sentence.</li><li>Give the reader a reason to continue.</li><li>Order the argument.</li><li>Support claims with sources.</li><li>Remove repetition.</li><li>Read aloud.</li><li>End with a useful next action.</li></ol>'],
            'reading-notes-guide' => ['Keep more of what you read', '<ol><li>Choose one question before reading.</li><li>Mark passages that answer it.</li><li>Summarise one idea in your own words.</li><li>Link it to something you know.</li><li>Return to the note next week.</li></ol>'],
            'excerpt-window' => ['Small Starts workbook', '<ol><li>Name one project.</li><li>Write its first two minutes.</li><li>Choose one shelf rather than the whole room.</li><li>Remove one obstacle.</li><li>Try one small action today.</li><li>Notice what made starting easier.</li></ol>'],
            'specification-sheet' => ['Two tables for everyday spaces', '<h2>Small table</h2><p>35 × 35 cm, beside an armchair. Wipe clean. Example price £45, solid beech.</p><h2>Wide table</h2><p>50 × 40 cm, beside a two-seat sofa. Wipe clean. Example price £70, solid beech.</p>'],
            'lighting-collection' => ['Lighting for quieter evenings', '<h2>Table and floor lighting</h2><p>Sample table lamp £35 and floor lamp £80. Warm light for reading and evening tasks. Check dimensions and bulb requirements before choosing.</p>'],
            'sale-deadline' => ['The sample sale', '<p>This review sale ends in seven days. Selected demonstration items are 10% off; no real purchases are taken.</p>'],
            'first-order-receipt' => ['Your first-order offer', '<p>Use REVIEW10 for 10% off your first demo order. One use per customer, not combinable with other coupons. No payment is taken on this test site.</p>'],
        ];
        [$title, $body] = $resources[$id] ?? [$draft['name'], '<p>We use the submitted details to respond to this request. No appointment or subscription is confirmed here.</p>'];
        $slug = 'collection-review-' . $id;
        $existing = get_page_by_path($slug);
        $page = wp_insert_post(['ID' => $existing?->ID ?? 0, 'post_type' => 'page', 'post_status' => 'publish', 'post_name' => $slug, 'post_title' => $title, 'post_content' => $body]);
        $url = get_permalink($page);
        if ($id === 'first-order-receipt') {
            $coupon = new WC_Coupon(wc_get_coupon_id_by_code('REVIEW10'));
            $coupon->set_code('REVIEW10'); $coupon->set_discount_type('percent'); $coupon->set_amount(10); $coupon->set_individual_use(true); $coupon->set_usage_limit_per_user(1); $coupon->save();
            if (isset($_GET['coupon_check'])) {
                $fixture = get_option('wconvert_commerce_fixture');
                WC()->cart->empty_cart(); WC()->cart->add_to_cart($fixture['products'][0]);
                WC()->cart->apply_coupon('REVIEW10'); WC()->cart->calculate_totals();
                wp_send_json(['discount' => WC()->cart->get_discount_total(), 'subtotal' => WC()->cart->get_subtotal(), 'applied' => WC()->cart->has_discount('REVIEW10')]);
            }
        }
        $config = $draft['config'];
        $config['display_rules'] = \WConvert\Rules\DisplayPlan::immediate();
        $config['targeting'] = ['include' => [], 'exclude' => []];
        $config['capture_mode'] = 'local';
        $config['inline_placement'] = ['position' => 'manual'];
        $config['frequency'] = ['stopAfterDismiss' => false, 'stopAfterConversion' => false];
        if ($draft['goal'] === 'deliver_lead_magnet') {
            $destination = $container->get(\WConvert\Destination\DestinationStore::class)->save(null, 'lead_magnet_email', 'Local review resource', null, [
                'file_url' => $url, 'subject' => 'Your requested resource', 'body' => 'Here is the resource you requested: {link}',
            ]);
            unset($config['capture_mode']);
            $config['destinations'] = [$destination->id];
            update_option('wconvert_collection_review_outbox', [], false);
        }
        $config['template'] = \WConvert\Template\TemplateTree::rewrittenIn(['template' => $config['template']], static function (array $node) use ($url): array {
            if (($node['type'] ?? '') === 'button' && ($node['action'] ?? '') === 'link') $node['href'] = $url;
            if (($node['type'] ?? '') === 'code') $node['text'] = 'REVIEW10';
            return $node;
        })['template'];
        if (str_contains(wp_json_encode($config['template']), '"type":"countdown"')) $config['ends_at'] = wp_date('Y-m-d\TH:i', time() + 7 * DAY_IN_SECONDS);
        // Each run uses a new snapshot and isolates visitor display from other fixtures.
        foreach ($repository->summaries() as $row) if ($row['published_at'] !== null) $repository->unpublish($row['id']);
        $previous = get_option('wconvert_collection_approval_fixture');
        if (is_string($previous)) $repository->delete($previous);
        $campaign = $repository->create('Collection review · ' . $draft['name'], $draft['goal'], $config);
        if (!$repository->publish($campaign->id)) wp_die('Configured example could not publish.');
        update_option('wconvert_collection_approval_fixture', $campaign->id);
        $direction = isset($_GET['rtl']) ? 'rtl' : 'ltr';
        echo '<!doctype html><html dir="' . $direction . '"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Collection approval</title>';
        wp_head();
        echo '<style>body{font:16px/1.5 system-ui;margin:0;background:#f6f4ee;color:#242220}main{max-width:48rem;margin:24px auto;padding:20px}</style></head><body><main><h1>Local campaign review</h1><p>Fictional examples. Submissions stay on this disposable site.</p><a id="configured-resource" href="' . esc_url($url) . '">Open the configured information or resource</a></main>';
        echo \WConvert\Frontend\InlineOptinShortcode::render(['id' => $campaign->id]);
        wp_footer(); echo '</body></html>'; exit;
    } catch (\Throwable $error) { wp_die(esc_html($error->getMessage())); }
}, 32);

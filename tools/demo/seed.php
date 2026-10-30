<?php

/**
 * seed.php — fills demo.wconvert.io's Demo Store.
 *
 *     wp eval-file tools/demo/seed.php
 *
 * Needs WConvert, WConvert Pro and WooCommerce active, and the demo mu-plugin
 * (`wconvert-demo.php`) installed. Safe to run again: the shop and the blog
 * are created once and found by slug or SKU after that, while every WConvert
 * row — Optins, counters, Leads — is wiped and written fresh. That second half
 * is what `reset.sh` re-runs every hour, so the charts always end today.
 *
 * **Optins go through `rest_do_request()`, never the repository.** The
 * repository writes whatever config it is handed; every validation lives in
 * the controller, so a direct write would seed a demo the plugin itself could
 * never have produced. Each one starts from its Playbook's prefill, exactly as
 * the goal-first flow does, with the copy re-bound in the shop's voice.
 *
 * The counters and Leads are the exception, and deliberately: no route writes
 * a day that is not today. They go straight into the existing tables — no
 * schema change.
 */

namespace WConvertDemo\Seed;

use WConvert\Bootstrap;
use WConvert\Database\Installer;
use WConvert\Optin\OptinRepository;
use WConvert\Rules\Degradation;
use WConvert\Support\Ulid;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateVocabulary;

defined('ABSPATH') || exit;

const DAYS = 60;
const DEMO_LOGIN = 'demo';
const DEMO_ROLE = 'wconvert_demo';
/** The exit popup reveals it, and it really works in the cart. */
const COUPON = 'FIRSTBAG10';

function fail(string $message): void
{
    if (class_exists('WP_CLI')) {
        \WP_CLI::error($message);
    }
    echo $message, "\n";
    exit(1);
}

function say(string $message): void
{
    if (class_exists('WP_CLI')) {
        \WP_CLI::log($message);
    } else {
        echo $message, "\n";
    }
}

/** A REST call as the site's administrator; anything but 2xx stops the seed. */
function rest(string $method, string $route, array $body = [], array $query = []): array
{
    $request = new \WP_REST_Request($method, $route);
    if ($query !== []) {
        $request->set_query_params($query);
    }
    if ($body !== []) {
        $request->set_header('content-type', 'application/json');
        $request->set_body((string) wp_json_encode($body));
    }
    $response = rest_do_request($request);
    $data = rest_get_server()->response_to_data($response, false);
    if ($response->is_error() || $response->get_status() >= 300) {
        fail(sprintf('%s %s answered %d: %s', $method, $route, $response->get_status(), wp_json_encode($data)));
    }

    return is_array($data) ? $data : [];
}

// ============================================================================
// PRECONDITIONS
// ============================================================================

if (!class_exists(Bootstrap::class) || !class_exists('WConvert\\Pro\\Bootstrap')) {
    fail('WConvert and WConvert Pro must both be active.');
}
if (!class_exists('WooCommerce')) {
    fail('WooCommerce must be active.');
}

$admins = get_users(['role' => 'administrator', 'number' => 1, 'orderby' => 'ID']);
if ($admins === []) {
    fail('The site has no administrator to seed as.');
}
wp_set_current_user($admins[0]->ID);

$container = Bootstrap::container();
$container->get(Installer::class)->install();

// ============================================================================
// THE SITE: one coffee roaster with a shop and a brewing blog
// ============================================================================

update_option('blogname', 'Northbeam Coffee');
update_option('blogdescription', 'Small-batch coffee, roasted every Tuesday');
update_option('blog_public', '0');
update_option('users_can_register', '0');
update_option('default_comment_status', 'closed');
update_option('default_ping_status', 'closed');
update_option('woocommerce_currency', 'GBP');
update_option('woocommerce_default_country', 'GB');
update_option('woocommerce_coming_soon', 'no');
update_option('woocommerce_store_pages_only', 'no');
update_option('woocommerce_enable_myaccount_registration', 'no');
update_option('woocommerce_enable_signup_and_login_from_checkout', 'no');
update_option('woocommerce_enable_guest_checkout', 'no');
update_option('woocommerce_enable_reviews', 'no');
update_option('woocommerce_allow_tracking', 'no');
update_option('woocommerce_show_marketplace_suggestions', 'no');

// The lean theme WordPress ships with, so the server needs nothing downloaded.
if (wp_get_theme('twentytwentyfive')->exists() && get_stylesheet() !== 'twentytwentyfive') {
    switch_theme('twentytwentyfive');
}

foreach (['hello-world' => 'post', 'sample-page' => 'page'] as $slug => $type) {
    $placeholder = get_page_by_path($slug, OBJECT, $type);
    if ($placeholder !== null) {
        wp_delete_post($placeholder->ID, true);
    }
}

// The shop is the front page, so every popup can be met on the first URL.
$journal = get_page_by_path('journal');
$journalId = $journal !== null ? $journal->ID : wp_insert_post([
    'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'Journal', 'post_name' => 'journal',
]);
update_option('show_on_front', 'page');
update_option('page_on_front', (int) wc_get_page_id('shop'));
update_option('page_for_posts', (int) $journalId);

// ============================================================================
// PRODUCTS
// ============================================================================

/** A plain coffee-bag picture, drawn rather than downloaded. */
function picture(string $name, array $bag, array $ground): int
{
    if (!function_exists('imagecreatetruecolor')) {
        return 0;
    }
    $size = 800;
    $image = imagecreatetruecolor($size, $size);
    imagefill($image, 0, 0, imagecolorallocate($image, ...$ground));
    $shade = imagecolorallocate($image, ...array_map(static fn (int $c): int => (int) ($c * 0.8), $bag));
    $fill = imagecolorallocate($image, ...$bag);
    $label = imagecolorallocate($image, 246, 240, 230);
    imagefilledrectangle($image, 250, 210, 550, 640, $fill);
    imagefilledrectangle($image, 250, 210, 550, 250, $shade);
    imagefilledellipse($image, 400, 430, 170, 170, $label);
    imagefilledellipse($image, 400, 430, 70, 110, $shade);

    $file = wp_tempnam('northbeam') . '.png';
    imagepng($image, $file);
    imagedestroy($image);

    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';
    $id = media_handle_sideload(['name' => sanitize_title($name) . '.png', 'tmp_name' => $file], 0, $name);

    return is_wp_error($id) ? 0 : (int) $id;
}

function category(string $name): int
{
    $term = get_term_by('name', $name, 'product_cat');
    if ($term instanceof \WP_Term) {
        return $term->term_id;
    }
    $made = wp_insert_term($name, 'product_cat');

    return is_wp_error($made) ? 0 : (int) $made['term_id'];
}

$products = [
    ['NB-HOUSE', 'House Blend', '9.50', 'Coffee', 'Chocolate, hazelnut and a little brown sugar. The one we drink all day.', [92, 58, 38]],
    ['NB-YIRGA', 'Ethiopia Yirgacheffe', '12.00', 'Coffee', 'Jasmine, bergamot and lemon tea. A washed coffee from smallholders around Kochere.', [196, 140, 64]],
    ['NB-HUILA-DECAF', 'Colombia Huila Decaf', '11.00', 'Coffee', 'Sugarcane-processed, so it keeps its red-apple sweetness. For the cup after three.', [72, 96, 82]],
    ['NB-ESPRESSO-7', 'Espresso No. 7 (1 kg)', '32.00', 'Coffee', 'Built for milk: cocoa, toffee and a long finish. The café bag.', [40, 34, 32]],
    ['NB-NYERI', 'Kenya Nyeri AA', '13.50', 'Coffee', 'Blackcurrant, tomato vine and a bright, juicy body.', [150, 52, 60]],
    ['NB-DRIPPER', 'Ceramic Pour-Over Dripper', '24.00', 'Brewing gear', 'Hand-glazed in Stoke. Holds heat, brews one to two cups.', [226, 214, 196]],
    ['NB-GRINDER', 'Hand Burr Grinder', '58.00', 'Brewing gear', 'Steel conical burrs, 40 click settings, fits in a rucksack.', [120, 124, 130]],
    ['NB-FILTERS', 'Paper Filters (100)', '5.00', 'Brewing gear', 'Unbleached, rinsed-tasting, sized for our dripper.', [236, 228, 210]],
];

foreach ($products as [$sku, $name, $price, $cat, $text, $colour]) {
    $existing = wc_get_product_id_by_sku($sku);
    $product = $existing ? wc_get_product($existing) : new \WC_Product_Simple();
    $product->set_name($name);
    $product->set_sku($sku);
    $product->set_regular_price($price);
    $product->set_short_description($text);
    $product->set_description($text);
    $product->set_status('publish');
    $product->set_catalog_visibility('visible');
    $product->set_reviews_allowed(false);
    $product->set_category_ids([category($cat)]);
    if (!$product->get_image_id()) {
        $product->set_image_id(picture($name, $colour, [244, 238, 228]));
    }
    $product->save();
}
say(sprintf('Products: %d.', count($products)));

// ============================================================================
// POSTS — the brewing blog
// ============================================================================

$posts = [
    ['dial-in-a-pour-over', 'How to dial in a pour-over in five minutes', 3, [
        'Most bad pour-overs are one adjustment away from good ones. The trick is changing one thing at a time.',
        'Start with 15 g of coffee to 250 g of water, ground like coarse sea salt. Bloom with 40 g of water for 40 seconds, then pour the rest in slow circles.',
        'Aim to finish draining at three minutes. Sour and thin? Grind finer. Bitter and dry? Grind coarser. That is genuinely most of it.',
    ]],
    ['why-we-roast-on-tuesdays', 'Why we roast on Tuesdays', 9, [
        'Every bag we send out was roasted on the Tuesday before it left. People ask why we do not roast every day.',
        'Coffee needs a few days to rest after roasting, while it lets go of carbon dioxide. Roast on Tuesday, pack on Thursday, and it reaches you at its best by the weekend.',
        'It also means one long, focused roasting day instead of five rushed ones. The coffee is better for it, and so are we.',
    ]],
    ['grind-size-explained', 'Grind size, explained with a sugar bowl', 17, [
        'Grind size is the one setting that changes everything, and the vocabulary around it is hopeless. So we use the kitchen.',
        'Espresso is icing sugar. Pour-over is table salt. French press is raw cane sugar. Cold brew is breadcrumbs.',
        'Put a pinch of each next to your grinder for a week and you will never need a chart again.',
    ]],
    ['meet-the-farm-huila', 'Meet the farm: Huila, Colombia', 26, [
        'Our decaf starts on a hillside in Huila, at 1,800 metres, on a farm run by the Ortiz family for three generations.',
        'The beans are decaffeinated with sugarcane rather than solvents, a process that happens just down the road in Manizales.',
        'That is why it still tastes of red apple and panela. Decaf does not have to taste like an apology.',
    ]],
    ['water-matters', 'Water matters more than you think', 38, [
        'A cup of coffee is 98% water, so it is strange how rarely we talk about it.',
        'Very hard water flattens flavour and leaves scale in your kettle. Very soft water makes coffee taste sharp and hollow.',
        'If your tap water is hard, a simple jug filter makes a bigger difference than a new grinder. Try it before you spend money.',
    ]],
    ['decaf-after-three', 'The case for decaf after 3pm', 51, [
        'Caffeine has a half-life of around five hours. An afternoon flat white is still partly with you at bedtime.',
        'We are not here to take your coffee away. We are here to suggest a second one that tastes just as good and lets you sleep.',
        'Try a week of decaf after three and see what happens to your evenings.',
    ]],
];

$brewing = (int) (term_exists('Brewing', 'category')['term_id'] ?? wp_insert_term('Brewing', 'category')['term_id']);

foreach ($posts as [$slug, $title, $daysAgo, $paragraphs]) {
    $content = implode("\n\n", array_map(
        static fn (string $p): string => "<!-- wp:paragraph -->\n<p>" . esc_html($p) . "</p>\n<!-- /wp:paragraph -->",
        $paragraphs
    ));
    // Dates move with "now" on every run, so the blog never looks abandoned.
    $date = gmdate('Y-m-d H:i:s', time() - $daysAgo * DAY_IN_SECONDS);
    $existing = get_page_by_path($slug, OBJECT, 'post');
    wp_insert_post([
        'ID' => $existing !== null ? $existing->ID : 0,
        'post_type' => 'post',
        'post_status' => 'publish',
        'post_name' => $slug,
        'post_title' => $title,
        'post_content' => $content,
        'post_date_gmt' => $date,
        'post_date' => get_date_from_gmt($date),
        'comment_status' => 'closed',
        'ping_status' => 'closed',
        'post_category' => [$brewing],
    ]);
}
say(sprintf('Posts: %d.', count($posts)));

// The code the exit popup reveals, real enough to apply in the cart.
$coupon = new \WC_Coupon(wc_get_coupon_id_by_code(COUPON));
$coupon->set_code(COUPON);
$coupon->set_discount_type('percent');
$coupon->set_amount(10);
$coupon->set_usage_limit_per_user(1);
$coupon->set_description('Demo: revealed by the exit-intent popup.');
$coupon->save();

// Consent and fine print link to the privacy policy, and render no link at
// all while WordPress's own policy page is still the draft it installs.
$privacy = get_page_by_path('privacy-policy');
$privacyId = wp_insert_post([
    'ID' => $privacy !== null ? $privacy->ID : 0,
    'post_type' => 'page',
    'post_status' => 'publish',
    'post_name' => 'privacy-policy',
    'post_title' => 'Privacy Policy',
    'post_content' => "<!-- wp:paragraph -->\n<p>Northbeam Coffee is a demo shop for WConvert. Nothing is sold, no email is sent, and everything typed here is erased within the hour.</p>\n<!-- /wp:paragraph -->",
]);
update_option('wp_page_for_privacy_policy', (int) $privacyId);

// The theme's header lists every page (Checkout, My account, the policy) and
// its footer carries placeholder links. A shop's own menu and footer instead.
foreach (get_posts(['post_type' => 'wp_navigation', 'post_status' => 'any', 'numberposts' => -1]) as $navigation) {
    wp_delete_post($navigation->ID, true);
}
$link = static fn (string $label, string $url): string => '<!-- wp:navigation-link ' . wp_json_encode(['label' => $label, 'url' => $url, 'kind' => 'custom']) . ' /-->';
wp_insert_post([
    'post_type' => 'wp_navigation',
    'post_status' => 'publish',
    'post_title' => 'Header',
    'post_content' => $link('Shop', (string) wc_get_page_permalink('shop')) . $link('Journal', (string) get_permalink((int) $journalId)),
]);

$footer = get_posts(['post_type' => 'wp_template_part', 'name' => 'footer', 'post_status' => 'any', 'numberposts' => 1, 'tax_query' => [['taxonomy' => 'wp_theme', 'field' => 'name', 'terms' => get_stylesheet()]]]);
$footerId = wp_insert_post([
    'ID' => $footer !== [] ? $footer[0]->ID : 0,
    'post_type' => 'wp_template_part',
    'post_status' => 'publish',
    'post_name' => 'footer',
    'post_title' => 'Footer',
    // Wide, like the theme's header, rather than the narrow column of a post.
    'post_content' => '<!-- wp:group {"align":"full","className":"has-global-padding","layout":{"type":"constrained"}} --><div class="wp-block-group alignfull has-global-padding">'
        . '<!-- wp:group {"align":"wide","layout":{"type":"default"}} --><div class="wp-block-group alignwide">'
        . '<!-- wp:separator {"className":"is-style-wide"} --><hr class="wp-block-separator has-alpha-channel-opacity is-style-wide"/><!-- /wp:separator -->'
        . '<!-- wp:site-title {"level":0} /-->'
        . '<!-- wp:paragraph --><p>Small-batch coffee, roasted every Tuesday. A demo shop for WConvert: nothing here is for sale.</p><!-- /wp:paragraph -->'
        . '<!-- wp:spacer {"height":"48px"} --><div style="height:48px" aria-hidden="true" class="wp-block-spacer"></div><!-- /wp:spacer -->'
        . '</div><!-- /wp:group --></div><!-- /wp:group -->',
]);
wp_set_object_terms((int) $footerId, get_stylesheet(), 'wp_theme');
wp_set_object_terms((int) $footerId, 'footer', 'wp_template_part_area');

// Set on the live rewrite object too, or the flush writes the old structure's rules.
global $wp_rewrite;
$wp_rewrite->set_permalink_structure('/%postname%/');
flush_rewrite_rules(false);

// ============================================================================
// THE DEMO USER — a role that can run WConvert and nothing else
// ============================================================================
// Not an administrator. `manage_options` is what WConvert's screens and routes
// ask for; `upload_files` is what applying a design's artwork and opening the
// image picker ask for. Without `edit_posts`, `unfiltered_html`, plugin, theme
// or user capabilities, nothing outside WConvert is reachable by capability —
// the mu-plugin's allow lists are the second wall, not the only one.

remove_role(DEMO_ROLE);
add_role(DEMO_ROLE, 'WConvert demo', ['read' => true, 'manage_options' => true, 'upload_files' => true]);

$demo = get_user_by('login', DEMO_LOGIN);
if ($demo === false) {
    $demoId = wp_insert_user([
        'user_login' => DEMO_LOGIN,
        'user_pass' => wp_generate_password(32, true, true),
        'user_email' => 'demo@example.com',
        'display_name' => 'Demo visitor',
        'role' => DEMO_ROLE,
    ]);
    if (is_wp_error($demoId)) {
        fail('Could not create the demo user: ' . $demoId->get_error_message());
    }
} else {
    $demo->set_role(DEMO_ROLE);
}

// ============================================================================
// WCONVERT — wipe, then five Optins through the routes a merchant's save takes
// ============================================================================

global $wpdb;
foreach (['wconvert_optins', 'wconvert_leads', 'wconvert_stats'] as $table) {
    $wpdb->query('TRUNCATE TABLE ' . $wpdb->prefix . $table); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
}
delete_option('wconvert_destinations');
// One flow definition per published revision; they would pile up run on run.
$wpdb->query($wpdb->prepare('DELETE FROM %i WHERE option_name LIKE %s', $wpdb->options, $wpdb->esc_like('wconvert_flow_') . '%'));
$container->get(OptinRepository::class)->rebuildForInstall();

// The site-wide allowance off, so nothing but each Optin's own cap applies.
rest('POST', '/wconvert/v1/optins/frequency', ['stopAfterDismiss' => false, 'stopAfterConversion' => false]);

$vocabulary = $container->get(TemplateVocabulary::class);
$degradation = $container->get(Degradation::class);

/**
 * "Every visit": once per browser session, whether the visitor closed it or
 * signed up — so a demo visitor meets every campaign again next time.
 */
const EVERY_VISIT = ['maxPerSession' => 1, 'stopAfterDismiss' => false, 'stopAfterConversion' => false];

/**
 * @param array{playbook: string, goal: string, name: string, copy: array<string, mixed>, rules: list<array<string, mixed>>, targeting?: array<string, mixed>, display_type?: string, inline_placement?: array<string, mixed>} $spec
 */
function optin(array $spec, TemplateVocabulary $vocabulary, Degradation $degradation): array
{
    $prefill = rest('GET', '/wconvert/v1/playbooks/prefill', [], ['goal' => $spec['goal'], 'playbook_id' => $spec['playbook']]);
    $config = $prefill['config'];
    $config['template']['tree'] = SlotRoles::bind($config['template']['tree'], $spec['copy'], $vocabulary);
    $config['display_rules'] = $degradation->intoDisplayConfig($spec['rules']);
    $config['frequency'] = EVERY_VISIT;
    foreach (['targeting', 'display_type', 'inline_placement'] as $key) {
        if (isset($spec[$key])) {
            $config[$key] = $spec[$key];
        }
    }
    // Prefill guesses the shop for a link button and asks the merchant to
    // check it. Here the shop IS the front page, so the guess is the answer.
    unset($config['unchecked_links']);
    if (($config['display_type'] ?? '') === 'inline') {
        unset($config['frequency']);
    }

    return rest('POST', '/wconvert/v1/optins', ['name' => $spec['name'], 'goal' => $spec['goal'], 'config' => $config]);
}

$specs = [
    'newsletter' => [
        'playbook' => 'everyday-slow-sunday-notes',
        'goal' => 'grow_email_list',
        'name' => 'Sunday brew letter',
        'copy' => [
            'eyebrow' => ['The Sunday brew letter', 'The Sunday brew letter'],
            'headline' => "Pour a cup.\nStay a while.",
            'body' => ['text' => 'One email a month: what we are roasting, a recipe worth trying and first dibs on small lots.'],
            'cta_label' => 'Send me the letter',
            'consent_text' => ['text' => 'Send me the monthly brew letter. %s', 'link' => ['label' => 'Privacy Policy']],
            'success_headline' => 'See you on Sunday.',
            'success_body' => ['text' => 'The next letter is on its way to your inbox.'],
        ],
        'rules' => [['type' => 'time_on_page', 'seconds' => 5]],
    ],
    'exit' => [
        'playbook' => 'welcome-discount',
        'goal' => 'grow_email_list',
        'name' => 'First bag 10% off (exit intent)',
        'copy' => [
            'wordmark' => ['Northbeam Coffee', 'Northbeam Coffee'],
            'eyebrow' => 'Before you go',
            'headline' => "10% off.\nYour first bag.",
            'body' => 'Join the Sunday brew letter and take 10% off your first order of beans.',
            'consent_text' => ['text' => 'Email me the monthly brew letter. %s', 'link' => ['label' => 'Privacy Policy']],
            'cta_label' => 'Join and reveal my code',
            'success_headline' => "Freshly roasted,\nfor less.",
            'success_body' => 'Use the code below for 10% off your first order.',
            'code_value' => COUPON,
            'fine_print' => [
                ['text' => 'Monthly emails. Unsubscribe anytime. First order only. %s', 'link' => ['label' => 'Privacy Policy']],
                'Apply at checkout. First order only, one use per customer.',
            ],
        ],
        'rules' => [['type' => 'exit_intent']],
    ],
    'bar' => [
        'playbook' => 'delivery-announcement',
        'goal' => 'promote_offer',
        'name' => 'Free delivery bar',
        'copy' => [
            'badge' => 'Delivery',
            'headline' => 'Free UK delivery on orders over £30',
            'cta_label' => 'Shop the beans',
        ],
        'rules' => [['type' => 'page_load']],
        // Products and posts, so the shop front page leaves its slot to the letter.
        'targeting' => ['include' => [['type' => 'singular', 'value' => 'product'], ['type' => 'singular', 'value' => 'post']]],
    ],
    'cart' => [
        'playbook' => 'cart-after-a-while',
        'goal' => 'recover_cart',
        'name' => 'Cart reminder slide-in',
        'display_type' => 'slide_in',
        'copy' => [
            'headline' => 'Still deciding?',
            'body' => 'Your beans are waiting in your cart. Roasted Tuesday, posted Thursday.',
            'cta_label' => 'Back to my cart',
            'fine_print' => 'Nothing is reserved until you check out.',
        ],
        'rules' => [['type' => 'time_on_page', 'seconds' => 6], ['type' => 'cart_has_items']],
    ],
    'article' => [
        'playbook' => 'article-end-newsletter',
        'goal' => 'grow_email_list',
        'name' => 'End-of-post signup',
        'copy' => [
            'headline' => 'Brew better, once a month',
            'body' => 'One email with new recipes from the journal and nothing else.',
            'cta_label' => 'Send me the brew letter',
            'consent_text' => ['text' => 'Send me the monthly brew letter. %s', 'link' => ['label' => 'Privacy Policy']],
            'fine_print' => ['text' => 'Monthly emails. Unsubscribe anytime. %s', 'link' => ['label' => 'Privacy Policy']],
            'success_headline' => 'Thanks for reading',
            'success_body' => 'The next brew letter is on its way to your inbox.',
        ],
        'rules' => [['type' => 'page_load']],
        'inline_placement' => ['position' => 'after_content'],
    ],
];

$optins = [];
foreach ($specs as $key => $spec) {
    $optins[$key] = optin($spec, $vocabulary, $degradation);
}

// The A/B test: the letter against a variant that leads with first dibs.
$variant = rest('POST', '/wconvert/v1/optins/' . $optins['newsletter']['id'] . '/variants');
$variantConfig = $variant['config'];
$variantConfig['template']['tree'] = SlotRoles::bind($variantConfig['template']['tree'], [
    'headline' => "Small lots.\nFirst dibs.",
    'body' => ['text' => 'Our rarest coffees sell out in days. Letter readers hear about them first.'],
    'cta_label' => 'Tell me first',
], $vocabulary);
$optins['newsletter_b'] = rest('PUT', '/wconvert/v1/optins/' . $variant['id'], ['config' => $variantConfig]);

foreach ($optins as $optin) {
    rest('POST', '/wconvert/v1/optins/' . $optin['id'] . '/publish');
}

// Each Optin's screens as published — what "Signup and screen activity" is
// keyed by: `screen:<flow hash>:<screen id>`.
$screens = [];
foreach ((array) get_option('wconvert_published_set', []) as $entry) {
    $contract = $entry['payload']['capture_contract'] ?? null;
    if (is_string($contract)) {
        $screens[$entry['id']] = array_map(static fn (array $step): string => 'screen:' . $contract . ':' . $step['id'], $entry['payload']['template']['tree']['steps'] ?? []);
    }
}

// Live for the whole window the counters cover, not since a minute ago.
$wpdb->query($wpdb->prepare(
    'UPDATE %i SET published_at = %s',
    $wpdb->prefix . 'wconvert_optins',
    gmdate('Y-m-d H:i:s', time() - (DAYS + 1) * DAY_IN_SECONDS)
));
say(sprintf('Optins published: %d (one A/B test).', count($optins)));

// ============================================================================
// 60 DAYS OF COUNTERS AND THE LEADS BEHIND THEM
// ============================================================================
// Believable rather than flattering: 2–6% conversion, weekends quieter, a
// gentle upward trend, one busy week when the discount went out, and a test
// whose winner is clear without being absurd. Seeded randomness, so the shape
// is the same every hour and only the dates move.

mt_srand(20261030);

/** Per Optin: daily impressions on a weekday, conversion rate, dismiss rate, whether a conversion is a Lead. */
$profiles = [
    'newsletter' => [42, 0.031, 0.46, true],
    'newsletter_b' => [42, 0.044, 0.41, true],
    'exit' => [34, 0.052, 0.55, true],
    'bar' => [140, 0.021, 0.12, false],
    'cart' => [26, 0.058, 0.38, false],
    'article' => [24, 0.029, 0.0, true],
];

$first = ['Amelia', 'Oliver', 'Isla', 'George', 'Ava', 'Noah', 'Freya', 'Arthur', 'Lily', 'Leo', 'Grace', 'Oscar', 'Ella', 'Harry', 'Sophie', 'Jack', 'Mia', 'Theo', 'Ruby', 'Alfie', 'Chloe', 'Henry', 'Evie', 'Finn', 'Zara', 'Samir', 'Priya', 'Tomasz', 'Aisha', 'Mateo'];
$last = ['Hughes', 'Patel', 'Walsh', 'Okafor', 'Clarke', 'Murphy', 'Nowak', 'Khan', 'Bennett', 'Reid', 'Fraser', 'Lopez', 'Shah', 'Doyle', 'Ahmed', 'Price', 'Baker', 'Turner', 'Moore', 'Kaur'];
$shapes = [
    static fn (string $f, string $l): string => "$f.$l",
    static fn (string $f, string $l): string => $f[0] . $l,
    static fn (string $f, string $l): string => $f . mt_rand(1, 99),
    static fn (string $f, string $l): string => "$f$l",
];

$stats = [];
$leads = [];
$now = time();
// Days in the site's timezone, as the counters themselves are kept (StatDay).
$zone = wp_timezone();
$today = (new \DateTimeImmutable('today', $zone))->getTimestamp();

for ($ago = DAYS - 1; $ago >= 0; $ago--) {
    $day = (new \DateTimeImmutable('@' . $today))->setTimezone($zone)->modify("-$ago days")->getTimestamp();
    $date = wp_date('Y-m-d', $day, $zone);
    $weekday = (int) wp_date('N', $day, $zone);
    $rhythm = [1 => 1.08, 2 => 1.12, 3 => 1.06, 4 => 1.0, 5 => 0.92, 6 => 0.72, 7 => 0.68][$weekday];
    $trend = 0.85 + 0.3 * (DAYS - $ago) / DAYS;
    $campaign = $ago >= 20 && $ago <= 26 ? 1.6 : 1.0;
    // Today is not over yet.
    $partial = $ago === 0 ? max(0.05, ($now - $day) / DAY_IN_SECONDS) : 1.0;

    foreach ($profiles as $key => [$base, $rate, $dismissRate, $isLead]) {
        $boost = $key === 'exit' ? $campaign : 1.0;
        $impressions = (int) round($base * $rhythm * $trend * $boost * $partial * (0.85 + mt_rand(0, 30) / 100));
        $conversions = 0;
        for ($i = 0; $i < $impressions; $i++) {
            $conversions += mt_rand() / mt_getrandmax() < $rate * ($key === 'exit' ? $campaign * 0.9 : 1.0) ? 1 : 0;
        }
        $dismissals = (int) round(($impressions - $conversions) * $dismissRate * (0.9 + mt_rand(0, 20) / 100));

        $id = $optins[$key]['id'];
        $stats[] = [$id, $date, 'impression', $impressions];
        $stats[] = [$id, $date, 'conversion', $conversions];
        $stats[] = [$id, $date, 'dismiss', $dismissals];
        if ($isLead) {
            $stats[] = [$id, $date, 'capture', $conversions];
        }
        // First screen: shown, then submitted or closed; the thank-you screen follows each submission.
        if (count($screens[$id] ?? []) >= 2) {
            [$form, $thanks] = $screens[$id];
            array_push(
                $stats,
                [$id, $date, 'screen_shown', $impressions, $form],
                [$id, $date, 'screen_advanced', $conversions, $form],
                [$id, $date, 'screen_dismissed', $dismissals, $form],
                [$id, $date, 'screen_shown', $conversions, $thanks],
            );
        }

        for ($i = 0; $isLead && $i < $conversions; $i++) {
            $at = $ago === 0 ? mt_rand($day, max($day, $now - 60)) : $day + mt_rand(7 * 3600, 23 * 3600);
            $f = $first[array_rand($first)];
            $l = $last[array_rand($last)];
            $leads[] = [
                substr(Ulid::floorAt($at * 1000), 0, 10) . substr(Ulid::generate(), 10),
                $id,
                strtolower($shapes[array_rand($shapes)]($f, $l)) . '@example.com',
                wp_date('Y-m-d H:i:s', $at, $zone),
            ];
        }
    }
}

foreach (array_chunk($stats, 200) as $chunk) {
    $rows = implode(',', array_map(static fn (array $r): string => $wpdb->prepare('(%s, %s, %s, %s, %d)', $r[0], $r[1], $r[2], $r[4] ?? '', $r[3]), $chunk));
    $wpdb->query('INSERT INTO ' . $wpdb->prefix . 'wconvert_stats (optin_id, stat_date, kind, scope, `count`) VALUES ' . $rows); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
}

$fields = (string) wp_json_encode(['answers' => (object) [], 'capture' => (object) []]);
foreach (array_chunk($leads, 200) as $chunk) {
    $rows = implode(',', array_map(static fn (array $r): string => $wpdb->prepare('(%s, %s, %s, NULL, %s, %s)', $r[0], $r[1], $r[2], $fields, $r[3]), $chunk));
    $wpdb->query('INSERT INTO ' . $wpdb->prefix . 'wconvert_leads (id, optin_id, email, phone, fields, created_at) VALUES ' . $rows); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
}

say(sprintf('Counters: %d rows. Leads: %d.', count($stats), count($leads)));
say('Demo Store seeded.');

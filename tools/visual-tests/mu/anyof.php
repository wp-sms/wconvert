<?php
/** One published "is any of" campaign for the disposable Playground only. */
declare(strict_types=1);

add_action('init', static function (): void {
    if (isset($_GET['wconvert_anyof_page'])) {
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Any-of fixture</title>';
        wp_head();
        echo '</head><body><main>Any-of visitor check</main>';
        wp_footer();
        echo '</body></html>';
        exit;
    }
    if (!isset($_GET['wconvert_anyof_seed'])) return;
    $host = wp_parse_url(home_url(), PHP_URL_HOST);
    if (!in_array($host, ['127.0.0.1', 'localhost'], true) || !defined('WCONVERT_PRO_DIR')) {
        wp_die('The any-of check requires the disposable local Pro site.');
    }
    $container = \WConvert\Bootstrap::container();
    $repository = $container->get(\WConvert\Optin\OptinRepository::class);
    // Whichever campaign another suite left published would open first.
    foreach ($repository->summaries() as $row) {
        if ($row['published_at'] !== null) $repository->unpublish($row['id']);
    }
    $tree = json_decode(file_get_contents(WCONVERT_DIR . 'tests/fixtures/journey-graph-branch-groups.json'), true, 512, JSON_THROW_ON_ERROR);
    foreach ($tree['steps'] as &$step) {
        if ($step['id'] !== 'scope') continue;
        foreach ($step['content']['children'] as &$node) {
            if (($node['id'] ?? '') === 'n1') $node['options'][] = ['value' => 'flat', 'label' => 'My flat'];
        }
        unset($node);
    }
    unset($step);
    foreach ($tree['graph']['edges'] as &$edge) {
        if ($edge['id'] === 'home_entry') $edge['when']['clauses'][0]['values'] = ['home', 'flat'];
    }
    unset($edge);
    $goal = \WConvert\Goal\Goal::CollectEnquiries;
    $config = $container->get(\WConvert\Playbook\Prefill::class)->fromScratch($goal)['config'];
    $base = json_decode(file_get_contents(WCONVERT_PRO_DIR . 'modules/journeys/templates/journey-service-enquiry.json'), true, 512, JSON_THROW_ON_ERROR);
    $config['template'] = ['tree' => $tree, 'tokens' => $base['tokens']];
    $config['template_id'] = 'journey-service-enquiry';
    $config['display_type'] = 'popup';
    $config['capture_mode'] = 'local';
    $config['display_rules'] = \WConvert\Rules\DisplayPlan::immediate();
    $optin = $repository->create('Any-of visitor check', $goal->value, $config);
    // Through REST, so publishing runs every check a real admin's click would.
    wp_set_current_user(1);
    $response = rest_do_request(new WP_REST_Request('POST', '/wconvert/v1/optins/' . $optin->id . '/publish'));
    wp_set_current_user(0);
    if ($response->is_error()) wp_die('Any-of fixture could not publish: ' . esc_html($response->as_error()->get_error_message()));
    exit('seeded');
});

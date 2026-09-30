<?php
/** Unpublished authoring fixtures for the disposable Playground only. */
declare(strict_types=1);

add_action('init', static function (): void {
    if (!isset($_GET['wconvert_visual_flow'])) return;
    $host = wp_parse_url(home_url(), PHP_URL_HOST);
    if (!in_array($host, ['127.0.0.1', 'localhost'], true) || !defined('WCONVERT_PRO_DIR')) {
        wp_die('Flow review requires the disposable local Pro site.');
    }
    $cases = [
        'branches' => 'tests/fixtures/journey-graph-branch-groups.json',
        'large-12' => 'tests/fixtures/journey-graph-large-12.json',
        'large-20' => 'tests/fixtures/journey-graph-large-20.json',
    ];
    $case = isset($cases[$_GET['wconvert_visual_flow']]) ? $_GET['wconvert_visual_flow'] : 'branches';
    $tree = json_decode(file_get_contents(WCONVERT_DIR . $cases[$case]), true, 512, JSON_THROW_ON_ERROR);
    $issue = \WConvert\Template\JourneyGraph::issue($tree);
    if ($issue !== null) wp_die('Invalid flow fixture: ' . esc_html($issue));
    $container = \WConvert\Bootstrap::container();
    $repository = $container->get(\WConvert\Optin\OptinRepository::class);
    $name = 'Flow review — ' . $case;
    $existing = array_column($repository->summaries(), 'id', 'name');
    if (!isset($existing[$name])) {
        $goal = \WConvert\Goal\Goal::CollectEnquiries;
        $config = $container->get(\WConvert\Playbook\Prefill::class)->fromScratch($goal)['config'];
        $base = json_decode(file_get_contents(WCONVERT_PRO_DIR . 'modules/journeys/templates/journey-service-enquiry.json'), true, 512, JSON_THROW_ON_ERROR);
        $config['template'] = ['tree' => $tree, 'tokens' => $base['tokens']];
        $config['template_id'] = 'journey-service-enquiry';
        $config['capture_mode'] = 'local';
        $existing[$name] = $repository->create($name, $goal->value, $config)->id;
    }
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><title>Flow authoring review</title><h1>' . esc_html($name) . '</h1>';
    echo '<p>Unpublished disposable draft. No real visitors or destination delivery.</p>';
    echo '<p><a href="' . esc_url(admin_url('admin.php?page=wconvert') . '#optins?edit=' . $existing[$name] . '&back=%23optins') . '">Open flow editor</a></p>';
    echo '<p><a href="?wconvert_visual_controls=1">Direction controls</a></p>';
    exit;
});

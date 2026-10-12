<?php
/** Disposable local WordPress: actual capture and display for the older essentials batch. */
add_action('init', static function (): void {
    if (!isset($_GET['wconvert_older_essentials'])) return;
    if (!defined('WCONVERT_DS_SECRET') || !in_array(wp_parse_url(home_url(), PHP_URL_HOST), ['127.0.0.1', 'localhost'], true)) wp_die('Disposable local site required.');
    $selection = (string) $_GET['wconvert_older_essentials'];
    if (!in_array($selection, ['project-planning-guide', 'project-readiness-guide', 'repair-workshop-news', 'local-class-news'], true)) wp_die('Unknown review setup');
    $container = \WConvert\Bootstrap::container();
    $repository = $container->get(\WConvert\Optin\OptinRepository::class);
    // This disposable site may have other review fixtures; isolate the visitor run.
    foreach ($repository->summaries() as $row) {
        if ($row['published_at'] !== null) $repository->unpublish($row['id']);
    }
    $previous = get_option('wconvert_older_essentials_fixture');
    if (is_string($previous)) $repository->delete($previous);
    $draft = $container->get(\WConvert\Playbook\Prefill::class)->fromPlaybook($selection);
    if (!$draft) wp_die('Setup missing');
    $draft['config']['display_rules'] = \WConvert\Rules\DisplayPlan::immediate();
    $draft['config']['capture_mode'] = 'local';
    $campaign = $repository->create($draft['name'], $draft['goal'], $draft['config']);
    if (!$repository->publish($campaign->id)) wp_die('Could not publish');
    update_option('wconvert_older_essentials_fixture', $campaign->id);
    $rtl = isset($_GET['rtl']) ? 'rtl' : 'ltr';
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html dir="' . $rtl . '"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Older essentials review</title>';
    wp_head();
    echo '<style>body{font:16px/1.5 system-ui;margin:0;background:#f6f4ee;color:#242220}main{max-width:48rem;margin:48px auto;padding:24px}</style></head><body><main><h1>Local review page</h1><p>Try the guide or announcement form. This fixture saves locally; no email is sent.</p><button id="page-action">Page content remains usable</button></main>';
    wp_footer(); echo '</body></html>'; exit;
});

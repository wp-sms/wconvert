<?php
/** Disposable local WordPress: actual capture and display for the selected studio batch. */
add_action('init', static function (): void {
    if (!isset($_GET['wconvert_template_batch'])) return;
    if (!defined('WCONVERT_DS_SECRET') || !in_array(wp_parse_url(home_url(), PHP_URL_HOST), ['127.0.0.1', 'localhost'], true)) wp_die('Disposable local site required.');
    $selection = (string) $_GET['wconvert_template_batch'];
    $catalog = json_decode((string) file_get_contents(WP_CONTENT_DIR . '/plugins/wconvert/tools/design-library/pilot/collection.json'), true);
    $batch = (string) ($_GET['batch'] ?? '');
    $allowed = array_column(array_filter($catalog['entries'] ?? [], static fn (array $entry): bool => $entry['batch'] === $batch), 'id');
    if (!in_array($selection, $allowed, true)) wp_die('Setup is not in the requested studio batch');
    $container = \WConvert\Bootstrap::container();
    $repository = $container->get(\WConvert\Optin\OptinRepository::class);
    // This disposable site may have other review fixtures; isolate the visitor run.
    foreach ($repository->summaries() as $row) {
        if ($row['published_at'] !== null) $repository->unpublish($row['id']);
    }
    $previous = get_option('wconvert_template_batch_fixture');
    if (is_string($previous)) $repository->delete($previous);
    $draft = $container->get(\WConvert\Playbook\Prefill::class)->fromPlaybook($selection);
    if (!$draft) wp_die('Setup missing');
    $draft['config']['display_rules'] = \WConvert\Rules\DisplayPlan::immediate();
    $draft['config']['capture_mode'] = 'local';
    $draft['config']['targeting'] = ['include' => [], 'exclude' => []];
    $draft['config']['inline_placement'] = ['position' => 'manual'];
    $campaign = $repository->create($draft['name'], $draft['goal'], $draft['config']);
    if (!$repository->publish($campaign->id)) wp_die('Could not publish');
    update_option('wconvert_template_batch_fixture', $campaign->id);
    $rtl = isset($_GET['rtl']) ? 'rtl' : 'ltr';
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html dir="' . $rtl . '"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Template batch review</title>';
    // Open only this disposable fixture's shadow roots for browser inspection.
    echo '<script>const originalAttach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){return originalAttach.call(this,{...options,mode:"open"})}</script>';
    wp_head();
    echo '<style>body{font:16px/1.5 system-ui;margin:0;background:#f6f4ee;color:#242220}main{max-width:48rem;margin:48px auto;padding:24px}</style></head><body><main><h1>Local review page</h1><p>Try the guide or announcement form. This fixture saves locally; no email is sent.</p><button id="page-action">Page content remains usable</button><div style="margin-top:24px">';
    echo \WConvert\Frontend\InlineOptinShortcode::render(['id' => $campaign->id]);
    echo '</div></main>';
    wp_footer(); echo '</body></html>'; exit;
});

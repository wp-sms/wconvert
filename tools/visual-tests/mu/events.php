<?php
/** Disposable local-only captures; never mount this fixture in a saved site. */
add_action('init', static function (): void {
    if (isset($_GET['wconvert_events_reset'])) {
        $repository = \WConvert\Bootstrap::container()->get(\WConvert\Optin\OptinRepository::class);
        foreach ($repository->summaries() as $row) {
            if ($row['published_at'] !== null) $repository->unpublish($row['id']);
        }
        exit('reset');
    }
    if (!isset($_GET['wconvert_events'])) return;
    $quiz = $_GET['wconvert_events'] === 'quiz';
    if ($quiz && !defined('WCONVERT_PRO_DIR')) wp_die('Quiz requires Pro');
    $path = $quiz ? WCONVERT_PRO_DIR . 'modules/journeys/templates/journey-content-guide.json'
        : WCONVERT_DIR . 'resources/templates/library/journey-email-then-sms.json';
    $template = json_decode(file_get_contents($path), true);
    // Library placeholders require an actual destination before contact capture.
    foreach ($template['tree']['steps'] as &$step) {
        foreach ($step['results'] ?? [] as $index => $result) $step['results'][$index]['href'] = home_url('/guide');
    }
    unset($step);
    \WConvert\Optin\PhoneCountry::setSiteDefault('US');
    $repository = \WConvert\Bootstrap::container()->get(\WConvert\Optin\OptinRepository::class);
    foreach (get_option('wconvert_events_fixtures', []) as $id) $repository->unpublish($id);
    $config = ['display_type' => 'popup', 'capture_mode' => 'local',
        'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'template' => $template];
    $issue = \WConvert\Template\CaptureContract::issue($config, $quiz ? 'find_match' : 'grow_email_list', get_privacy_policy_url());
    if ($issue !== null) wp_die('Incomplete events fixture: ' . esc_html($issue));
    $optin = $repository->create($quiz ? 'Events quiz' : 'Events email then SMS', $quiz ? 'find_match' : 'grow_email_list', $config);
    if ($repository->publish($optin->id) === null) wp_die('Events fixture could not publish');
    update_option('wconvert_events_fixtures', [$optin->id]);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Events fixture</title>';
    wp_head();
    echo '</head><body><main>Campaign event test</main>';
    wp_footer();
    echo '</body></html>';
    exit;
});

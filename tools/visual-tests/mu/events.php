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
    $repository = \WConvert\Bootstrap::container()->get(\WConvert\Optin\OptinRepository::class);
    foreach (get_option('wconvert_events_fixtures', []) as $id) $repository->unpublish($id);
    if ($_GET['wconvert_events'] === 'link') {
        // #440: a published link campaign, so a page listener can count CTA clicks.
        $bar = ($_GET['display'] ?? '') === 'floating_bar';
        if ($bar && !defined('WCONVERT_PRO_DIR')) wp_die('Floating bar requires Pro');
        $template = json_decode(file_get_contents($bar ? WCONVERT_PRO_DIR . 'modules/display-types/templates/bar-announcement.json'
            : WCONVERT_DIR . 'resources/templates/library/offer-panel.json'), true);
        $link = static function (array $node) use (&$link): array {
            if (($node['type'] ?? '') === 'button' && ($node['action'] ?? '') === 'link') $node['href'] = home_url('/sale');
            foreach (['children', 'start', 'end'] as $key) if (isset($node[$key])) $node[$key] = array_map($link, $node[$key]);
            return $node;
        };
        foreach ($template['tree']['steps'] as &$step) $step['content'] = $link($step['content']);
        unset($step);
        $config = ['display_type' => $bar ? 'floating_bar' : 'popup',
            'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'template' => $template];
        [$name, $goal] = [$bar ? 'Events link bar' : 'Events link popup', 'promote_offer'];
    } else {
        $quiz = $_GET['wconvert_events'] === 'quiz';
        if ($quiz && !defined('WCONVERT_PRO_DIR')) wp_die('Quiz requires Pro');
        $path = $quiz ? WCONVERT_PRO_DIR . 'modules/journeys/templates/journey-content-guide.json'
            : WCONVERT_DIR . 'resources/templates/library/journey-email-then-sms.json';
        $template = json_decode(file_get_contents($path), true);
        // The library ships consent hidden; prefill reveals it for a list Goal (ADR 0099).
        if (!$quiz) $template['tree'] = \WConvert\Bootstrap::container()->get(\WConvert\Privacy\PrivacyGuidance::class)
            ->treeFor($template['tree'], \WConvert\Goal\Goal::GrowEmailList);
        // Library placeholders require an actual destination before contact capture.
        foreach ($template['tree']['steps'] as &$step) {
            foreach ($step['results'] ?? [] as $index => $result) $step['results'][$index]['href'] = home_url('/guide');
        }
        unset($step);
        \WConvert\Optin\PhoneCountry::setSiteDefault('US');
        $config = ['display_type' => 'popup', 'capture_mode' => 'local',
            'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'template' => $template];
        [$name, $goal] = $quiz ? ['Events quiz', 'find_match'] : ['Events email then SMS', 'grow_email_list'];
    }
    $issue = \WConvert\Template\CaptureContract::issue($config, $goal, get_privacy_policy_url());
    if ($issue !== null) wp_die('Incomplete events fixture: ' . esc_html($issue));
    $optin = $repository->create($name, $goal, $config);
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

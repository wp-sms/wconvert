<?php
/** Disposable real-WordPress recovery journeys; never mounted in a saved site. */
add_action('init', static function (): void {
    if (!isset($_GET['wconvert_reopen']) || !defined('WCONVERT_PRO_DIR')) return;
    $kind = sanitize_key((string) $_GET['wconvert_reopen']);
    $container = \WConvert\Bootstrap::container();
    $repository = $container->get(\WConvert\Optin\OptinRepository::class);
    $ids = get_option('wconvert_reopen_fixtures', []);
    foreach ($ids as $id) $repository->unpublish($id);
    if (!isset($ids[$kind])) {
        $config = [
            'display_type' => $kind === 'slide' ? 'slide_in' : 'popup',
            'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'capture_mode' => 'local',
            'frequency' => ['maxImpressions' => 1],
            'teaser' => ['label' => 'Get my discount', 'mobile' => ['placement' => 'block_start_inline_start', 'gap' => 24]],
            'template' => ['tokens' => ['width' => '24rem', 'accent' => '#12505a'], 'tree' => ['v' => 2, 'submissions' => [['id' => 'primary', 'required' => true, 'fields' => ['n2'], 'consents' => []]], 'steps' => [
                ['id' => 'details', 'name' => 'Details', 'kind' => 'input', 'content' => ['type' => 'stack', 'children' => [['type' => 'heading', 'id' => 'n1', 'text' => 'Your discount'], ['type' => 'field', 'id' => 'n2', 'name' => 'email', 'required' => true], ['type' => 'button', 'id' => 'n3', 'label' => 'Join', 'action' => 'submit', 'submission' => 'primary']]]],
                ['id' => 'received', 'name' => 'Received', 'kind' => 'acknowledgement', 'content' => ['type' => 'stack', 'children' => [['type' => 'heading', 'id' => 'n4', 'text' => 'Submission received']]]],
            ]]],
        ];
        if ($kind === 'long') $config['teaser']['label'] = str_repeat('Long offer ', 7);
        if ($kind === 'hidden') $config['teaser']['mobile']['visible'] = false;
        $optin = $repository->create('Reopen fixture', 'collect_enquiries', $config);
        $ids[$kind] = $optin->id;
        update_option('wconvert_reopen_fixtures', $ids);
    }
    if ($repository->publish($ids[$kind]) === null) wp_die('Reopen fixture could not publish');
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html dir="' . (isset($_GET['rtl']) ? 'rtl' : 'ltr') . '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Reopen WordPress fixture</title>';
    wp_head();
    echo '<style>body{margin:0;min-height:2000px;transform:translateZ(0)}body *{font-family:Comic Sans MS!important}button{padding:30px!important}dialog{padding:60px!important;background:red!important}.sticky{position:fixed;top:calc(100vh - 70px);left:0;right:0;background:orange;z-index:2147483647;height:70px}.chat{position:fixed;top:calc(100vh - 160px);right:0;background:pink;z-index:2147483647}main{padding-top:100px}</style></head><body><main><button id="origin">Read article</button><a id="next" href="?wconvert_reopen=' . esc_attr($kind) . '&page=2">Next page</a><p>Keep reading while the reminder is visible.</p><div class="sticky">Sticky checkout and cookie controls</div><button class="chat">Chat</button></main><script>document.querySelector("#origin").focus();</script>';
    wp_footer();
    echo '</body></html>';
    exit;
});

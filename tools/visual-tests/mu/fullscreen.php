<?php
/** Disposable Playground fixture only. Never mounted into a saved site. */
add_action('init', static function (): void {
    if (!isset($_GET['wconvert_fullscreen']) || !defined('WCONVERT_PRO_DIR')) return;
    $playbook = in_array($_GET['wconvert_fullscreen'], ['fullscreen-newsletter', 'fullscreen-guide', 'fullscreen-announcement'], true)
        ? $_GET['wconvert_fullscreen'] : 'fullscreen-newsletter';
    $container = \WConvert\Bootstrap::container();
    $repository = $container->get(\WConvert\Optin\OptinRepository::class);
    $previous = get_option('wconvert_fullscreen_fixture');
    if (is_string($previous)) $repository->delete($previous);
    $draft = $container->get(\WConvert\Playbook\Prefill::class)->fromPlaybook($playbook);
    if ($draft === null) wp_die('Fullscreen setup failed to register');
    // Only the test makes this immediate. Shipping setups wait for engagement.
    $draft['config']['display_rules'] = \WConvert\Rules\DisplayPlan::immediate();
    $optin = $repository->create($draft['name'], $draft['goal'], $draft['config']);
    $repository->publish($optin->id);
    update_option('wconvert_fullscreen_fixture', $optin->id);
    header('Content-Type: text/html; charset=utf-8');
    $rtl = isset($_GET['rtl']) ? 'rtl' : 'ltr';
    echo '<!doctype html><html dir="' . $rtl . '"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fullscreen fixture</title>';
    wp_head();
    echo '<style>body{margin:0;min-height:4000px;transform:translateZ(0)}body *{font-family:Comic Sans MS!important}dialog{padding:60px!important;background:red!important}#theme-header{position:fixed;top:0;height:60px;background:orange;z-index:2147483647}</style></head><body><header id="theme-header">Hostile theme header</header><button id="opener" style="margin-top:800px">Return here</button><main>Underlying page</main><script>scrollTo(0,600);document.querySelector("#opener").focus({preventScroll:true});</script>';
    wp_footer();
    echo '</body></html>';
    exit;
});

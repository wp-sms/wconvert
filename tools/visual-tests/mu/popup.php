<?php
/** Disposable Playground fixture only. Never mounted into a saved site. */
add_action('init', static function (): void {
    if (!isset($_GET['wconvert_popup'])) return;

    $container = \WConvert\Bootstrap::container();
    $repository = $container->get(\WConvert\Optin\OptinRepository::class);
    $previous = get_option('wconvert_popup_fixture');
    if (is_string($previous)) $repository->delete($previous);

    $draft = $container->get(\WConvert\Playbook\Prefill::class)->fromPlaybook('welcome-discount');
    if ($draft === null) wp_die('Popup setup failed to register');

    // Only the test makes this immediate. Shipping setups wait for engagement.
    $draft['config']['display_rules'] = \WConvert\Rules\DisplayPlan::immediate();
    $optin = $repository->create($draft['name'], $draft['goal'], $draft['config']);
    $repository->publish($optin->id);
    update_option('wconvert_popup_fixture', $optin->id);

    header('Content-Type: text/html; charset=utf-8');
    $rtl = isset($_GET['rtl']) ? 'rtl' : 'ltr';
    echo '<!doctype html><html dir="' . $rtl . '"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Popup fixture</title>';
    wp_head();
    echo '<style>body{margin:0;min-height:4000px;transform:translateZ(0)}body *{font-family:Comic Sans MS!important}dialog{inset:0 auto auto 0!important;width:100vw!important;height:100vh!important;margin:0!important;padding:60px!important;background:red!important}#theme-header{position:fixed;inset:0 0 auto;height:60px;background:orange;z-index:2147483647}</style></head><body><header id="theme-header">Hostile theme header</header><button id="opener" style="margin-top:800px">Return here</button><main>Underlying page</main><script>scrollTo(0,600);document.querySelector("#opener").focus({preventScroll:true});</script>';
    wp_footer();
    echo '</body></html>';
    exit;
});

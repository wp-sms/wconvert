<?php
/** Disposable integration fixture; never mount this directory on a saved site. */
add_action('init', static function (): void {
    if (!isset($_GET['wconvert_analytics_fixture']) || !defined('WCONVERT_PRO_DIR')) return;
    $mode = sanitize_key((string) $_GET['wconvert_analytics_fixture']);
    $settings = new \WConvert\Pro\Module\Analytics\Settings(new \WConvert\Storage\WpOptionStore());
    $settings->save(['enabled' => $mode !== 'off', 'route' => $mode === 'gtm' ? 'gtm' : 'gtag',
        'measurement_id' => 'G-TEST123', 'consent' => $mode === 'wp' ? 'wp' : 'site',
        'exclude_managers' => false], home_url('/'));
}, 0);

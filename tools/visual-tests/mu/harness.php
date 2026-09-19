<?php
/** Disposable visual-test site only. This file is never packaged with WConvert. */
declare(strict_types=1);

require_once WP_CONTENT_DIR . '/plugins/wconvert/tools/design-system/seed/wconvert-ds-harness.php';

// Nothing on this test site may send mail, including a accidentally selected destination.
add_filter('pre_wp_mail', static fn (): bool => true);

add_action('init', static function (): void {
    if (!isset($_GET['wconvert_visual_seed'])) return;
    header('Content-Type: text/plain');
    if (!get_option('wconvert_visual_seeded')) {
        require_once WP_CONTENT_DIR . '/plugins/wconvert/tools/design-system/seed/wconvert-ds-seed.php';
        echo wconvert_ds_seed();
        update_option('wconvert_visual_seeded', true);
    } else {
        echo 'seeded';
    }
    exit;
});

// A visible control page lets manual browser checks exercise the same states as CI.
add_action('init', static function (): void {
    if (!isset($_GET['wconvert_visual_controls'])) {
        return;
    }
    if (isset($_POST['direction'])) {
        setcookie('wconvert_ds_dir', $_POST['direction'] === 'rtl' ? 'rtl' : 'ltr', ['path' => '/', 'samesite' => 'Lax']);
        setcookie('wconvert_ds_state', in_array($_POST['state'] ?? '', ['failed', 'empty', 'loading'], true) ? $_POST['state'] : '', ['path' => '/', 'samesite' => 'Lax']);
        wp_safe_redirect(admin_url('admin.php?page=wconvert'));
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><title>WConvert disposable test controls</title><h1>Disposable test site</h1>';
    echo '<form method="post"><label>Direction <select name="direction"><option>ltr</option><option>rtl</option></select></label> ';
    echo '<label>State <select name="state"><option>full</option><option>empty</option><option>loading</option><option>failed</option></select></label> <button>Open WConvert</button></form>';
    exit;
});

// The empty state uses real REST payloads with their collections emptied.
add_filter('rest_post_dispatch', static function ($response, $server, $request) {
    if (($_COOKIE['wconvert_ds_state'] ?? '') !== 'empty' || $response->get_status() !== 200) {
        return $response;
    }
    $data = $response->get_data();
    switch ($request->get_route()) {
        case '/wconvert/v1/optins':
        case '/wconvert/v1/optins/previews':
            $data = [];
            break;
        case '/wconvert/v1/dashboard':
            $data['goals'] = [];
            $data['impact'] = array_map(static function ($item) { $item['count'] = 0; return $item; }, $data['impact']);
            break;
        case '/wconvert/v1/leads':
            $data['leads'] = [];
            $data['groups'] = [];
            $data['submissions'] = 0;
            $data['next_cursor'] = null;
            $data['purpose_counts'] = ['all' => 0, 'subscribers' => 0, 'enquiries' => 0];
            break;
        case '/wconvert/v1/destinations':
            $data['destinations'] = [];
            $data['failures'] = [];
            break;
    }
    $response->set_data($data);
    return $response;
}, 10, 3);

// Pending promises suspend reads in the browser, keeping the PHP worker free.
add_action('admin_enqueue_scripts', static function (): void {
    if (($_COOKIE['wconvert_ds_state'] ?? '') === 'loading') {
        wp_add_inline_script('wp-api-fetch', "wp.apiFetch.use((options, next) => (options.path || '').startsWith('/wconvert/v1/') ? new Promise(() => {}) : next(options));", 'after');
    }
}, 100);

// Playground's SQLite translator currently leaves MySQL's <=> operator intact.
// Expand this one null-safe comparison so the real campaign summary query can
// run. Production SQL is unchanged; this visual harness does not prove MySQL
// query compatibility (the bin/verify scripts own that contract).
add_filter('query', static fn (string $sql): string => str_replace(
    'BINARY config <=> BINARY published_config',
    '((config IS NULL AND published_config IS NULL) OR (config IS NOT NULL AND published_config IS NOT NULL AND BINARY config = BINARY published_config))',
    $sql
));

// Exact-size, same-origin frames are useful when a browser's background tabs
// cannot be resized. These exercise the real WP media queries and resize code.
add_action('init', static function (): void {
    if (!isset($_GET['wconvert_visual_viewport'])) return;
    $width = $_GET['wconvert_visual_viewport'] === 'mobile' ? 390 : 1440;
    $height = $width === 390 ? 844 : 1100;
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><title>WConvert viewport review</title><style>body{margin:0;background:#dce9e2;font:14px system-ui}nav{padding:12px}iframe{display:block;border:0;margin:auto;background:white}</style>';
    echo '<nav><a href="?wconvert_visual_viewport=mobile">Mobile · 390px</a> · <a href="?wconvert_visual_viewport=desktop">Desktop · 1440px</a> · <a href="?wconvert_visual_controls=1">States and direction</a></nav>';
    echo '<iframe title="WConvert review" width="' . $width . '" height="' . $height . '" src="' . esc_url(admin_url('admin.php?page=wconvert')) . '"></iframe>';
    exit;
});

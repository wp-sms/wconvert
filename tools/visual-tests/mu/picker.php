<?php
/** Disposable local Playground verification only. */
add_action('init', static function (): void {
    if (!isset($_GET['wconvert_verify_picker'])) return;
    if (!in_array(wp_parse_url(home_url(), PHP_URL_HOST), ['127.0.0.1', 'localhost'], true)) wp_die('Disposable local site required.');
    wp_set_current_user((int) username_exists('admin'));
    define('WCONVERT_VERIFY_PICKER', true);
    header('Content-Type: text/plain; charset=utf-8');
    require WCONVERT_DIR . 'bin/verify-picker.php';
    exit;
}, 99);

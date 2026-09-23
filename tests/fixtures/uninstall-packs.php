<?php
// A separate PHP process with no WordPress or database connection.
define('WP_UNINSTALL_PLUGIN', true);
function wp_clear_scheduled_hook(string $hook): void {}
function delete_option(string $name): void {}
/** @return array{basedir: string} */
function wp_upload_dir(?string $time = null, bool $create = true): array { global $argv; return ['basedir' => $argv[1]]; }
$wpdb = new class {
    public string $options = 'test_options';
    public function get_col(string $sql): array { return []; }
    public string $prefix = 'test_';
    public function prepare(string $sql, string $name): string { return $sql; }
    public function query(string $sql): void {}
};
require dirname(__DIR__, 2) . '/uninstall.php';

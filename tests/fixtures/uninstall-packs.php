<?php
// A separate PHP process with no WordPress or database connection.
define('WP_UNINSTALL_PLUGIN', true);
function get_current_blog_id(): int { return 1; }
function delete_metadata(string $type, int $id, string $key, string $value, bool $all): bool { return true; }
function wp_clear_scheduled_hook(string $hook): void {}
$deletedOptions = [];
function delete_option(string $name): void { global $deletedOptions; $deletedOptions[] = $name; }
/** @return array{basedir: string} */
function wp_upload_dir(?string $time = null, bool $create = true): array { global $argv; return ['basedir' => $argv[1]]; }
$wpdb = new class {
    public string $options = 'test_options';
    public function get_col(string $sql): array { return ['wconvert_mail_' . str_repeat('a', 64), 'wconvert_capture_' . str_repeat('b', 64), 'wconvert_mail_site_owner']; }
    public string $prefix = 'test_';
    public function prepare(string $sql, string $name): string { return $sql; }
    public function query(string $sql): void {}
};
require dirname(__DIR__, 2) . '/uninstall.php';

foreach (['wconvert_mail_' . str_repeat('a', 64), 'wconvert_capture_' . str_repeat('b', 64)] as $owned) {
    if (!in_array($owned, $deletedOptions, true)) { fwrite(STDERR, "Owned option was retained\n"); exit(1); }
}
if (in_array('wconvert_mail_site_owner', $deletedOptions, true)) { fwrite(STDERR, "Unrelated option was deleted\n"); exit(1); }

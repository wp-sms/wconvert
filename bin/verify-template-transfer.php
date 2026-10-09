<?php
/** Native media/policy/failure checks. Run only on a disposable WordPress install. */
declare(strict_types=1);
if (!defined('WCONVERT_VERIFY_TRANSFER') || WCONVERT_VERIFY_TRANSFER !== true) throw new RuntimeException('Disposable WordPress required.');

function transferCheck(bool $ok, string $message): void {
    if (!$ok) throw new RuntimeException($message);
    echo "PASS {$message}\n";
}
/** @param array<string, mixed> $body */
function transferRequest(string $path, string $method = 'GET', array $body = []): WP_REST_Response {
    $request = new WP_REST_Request($method, '/wconvert/v1/template-transfer' . $path);
    $request->set_header('Content-Type', 'application/json');
    if ($method === 'POST') $request->set_body((string) wp_json_encode($body));
    return rest_do_request($request);
}
function transferMediaCount(): int { return count(get_posts(['post_type' => 'attachment', 'post_status' => 'inherit', 'posts_per_page' => -1, 'fields' => 'ids'])); }

$c = WConvert\Bootstrap::container();
$c->resolve(WConvert\Database\Installer::class)->install();
wp_set_current_user(0);
transferCheck(in_array(transferRequest('')->get_status(), [401, 403], true), 'anonymous transfer access is refused');
wp_set_current_user(1);
$controller = $c->resolve(WConvert\Rest\TemplateTransferController::class);
$store = (new ReflectionMethod($controller, 'sessions'))->invoke($controller);
$package = (new ReflectionMethod($controller, 'package'))->invoke($controller);
$design = json_decode((string) file_get_contents(WCONVERT_DIR . 'resources/templates/library/reading-slip.json'), true);
$design['display_type'] = 'popup';
$design = array_replace($design, WConvert\Template\TemplateVocabulary::fromManifest()->normalize($design));
$optins = $c->resolve(WConvert\Optin\OptinRepository::class);
$config = ['template' => $design, 'display_type' => 'popup'];
$optin = $optins->create('Transfer hosting verification', 'promote_offer', $config);
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAIAAAAt/+nTAAAATklEQVR4nO3PUQkAIBTAwJfFtIYzlCH8OITBAtxm7fN1wwUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjx2AQsCsKZ+cenUAAAAAElFTkSuQmCC');
$design['tree']['steps'][0]['content']['children'][] = ['type' => 'image', 'id' => 'n800', 'src' => '/a.png', 'alt' => 'First image'];
$design['tree']['steps'][0]['content']['children'][] = ['type' => 'image', 'id' => 'n801', 'src' => '/b.png', 'alt' => 'Second image'];
$source = tempnam(sys_get_temp_dir(), 'wc-hosting-');
$package->write($source, $design, static fn (string $url): string => $png . ($url === '/b.png' ? "\n" : ''));
$id = $store->create($source);
$path = '/imports/' . $id;
$before = transferMediaCount();
$preview = transferRequest($path . '/prepare', 'POST', ['optin' => $optin->id, 'config' => $config, 'mode' => 'file']);
if ($preview->get_status() !== 200) throw new RuntimeException('Prepare refused: ' . wp_json_encode($preview->get_data()));
transferCheck(true, 'native image design prepares');
$apply = ['digest' => $preview->get_data()['digest'], 'reviewed' => true];
transferCheck(transferMediaCount() === $before, 'preview adds no attachments');

$denyUpload = static fn (array $caps, string $cap): array => $cap === 'upload_files' ? ['do_not_allow'] : $caps;
add_filter('map_meta_cap', $denyUpload, 10, 2);
transferCheck(transferRequest($path . '/apply', 'POST', $apply)->get_status() === 400, 'upload permission revoked after preview is rechecked');
remove_filter('map_meta_cap', $denyUpload, 10);
$denyPng = static function (array $mimes): array { return array_filter($mimes, static fn (string $mime): bool => $mime !== 'image/png'); };
add_filter('upload_mimes', $denyPng);
transferCheck(transferRequest($path . '/apply', 'POST', $apply)->get_status() === 400, 'site MIME restrictions are enforced before media creation');
remove_filter('upload_mimes', $denyPng);
transferCheck(transferMediaCount() === $before, 'policy refusals leave Media Library unchanged');

if (is_multisite()) {
    update_site_option('upload_space_check_disabled', false);
    $space = static fn (): int => 0;
    add_filter('get_space_allowed', $space);
    transferCheck(transferRequest($path . '/apply', 'POST', $apply)->get_status() === 400, 'multisite exhausted quota is refused');
    remove_filter('get_space_allowed', $space);
    transferCheck(transferMediaCount() === $before, 'quota refusal creates no media');
}

$attempts = 0;
$failSecond = static function (array $file) use (&$attempts): array {
    if (++$attempts === 2) $file['error'] = 'Injected second-image failure';
    return $file;
};
add_filter('wp_handle_sideload_prefilter', $failSecond);
$failed = transferRequest($path . '/apply', 'POST', $apply);
remove_filter('wp_handle_sideload_prefilter', $failSecond);
transferCheck($failed->get_status() === 400 && $attempts === 2, 'second native sideload failure reaches the rollback path');
transferCheck(transferMediaCount() === $before, 'handled sideload failure removes the first attachment');

$archive = $store->view($id, static fn (string $archive): string => $archive);
$blocked = dirname($archive) . '/session.tmp';
mkdir($blocked);
set_error_handler(static fn (): bool => true);
try { $failed = transferRequest($path . '/apply', 'POST', $apply); }
finally { restore_error_handler(); rmdir($blocked); }
transferCheck($failed->get_status() === 400, 'unwritable progress checkpoint refuses Apply');
transferCheck(transferMediaCount() === $before, 'checkpoint failure removes newly created media');

$success = transferRequest($path . '/apply', 'POST', $apply);
transferCheck($success->get_status() === 200, 'Apply recovers after media/storage failures');
transferCheck(transferMediaCount() === $before + 2, 'successful Apply creates two unique attachments');
$retry = transferRequest($path . '/apply', 'POST', $apply);
transferCheck($retry->get_data() === $success->get_data() && transferMediaCount() === $before + 2, 'retry returns the same patch without duplicating media');
transferCheck($optins->find($optin->id)->config === $optin->config, 'Apply never persists the campaign');
$store->cancel($id);
transferCheck(!is_file($archive), 'Cancel removes the private archive');
transferCheck(transferMediaCount() === $before + 2, 'successful media remains available after cancelling staging');
unlink($source);
echo 'PASS native transfer verification (' . (is_multisite() ? 'multisite' : 'single site') . ")\n";

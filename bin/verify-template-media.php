<?php
/**
 * Run only on disposable WordPress; creates test drafts and media.
 * wp eval-file bin/verify-template-media.php --use-include
 * CI runs this with Free, then with Pro active.
 */
declare(strict_types=1);

use WConvert\Rest\OptinController;
use WConvert\Template\TemplateLibrary;

if (!defined('ABSPATH') || !defined('WCONVERT_VERSION')) throw new RuntimeException('Boot a disposable WordPress with WConvert active.');
wp_set_current_user(1);
$container = \WConvert\Bootstrap::container();
$controller = $container->resolve(OptinController::class);
$library = $container->resolve(TemplateLibrary::class);
$check = static function (bool $ok, string $message): void {
    if (!$ok) throw new RuntimeException($message);
    echo "PASS: $message\n";
};
$count = static fn (): int => count(get_posts(['post_type' => 'attachment', 'post_status' => 'inherit', 'posts_per_page' => -1, 'fields' => 'ids']));
$before = $count();
$entry = $library->find('halloween-engraved');
$check(is_array($entry) && $count() === $before, 'Reading bundled artwork creates no media');
$create = static function (array $template) use ($controller) {
    $request = new WP_REST_Request('POST');
    $request->set_param('name', 'Template media verification');
    $request->set_param('goal', 'promote_offer');
    $request->set_param('config', ['template_id' => $template['id'] ?? null, 'display_type' => 'popup', 'display_rules' => \WConvert\Rules\DisplayPlan::immediate(), 'template' => $template]);
    return $controller->store($request);
};
$first = $create($entry);
if ($first instanceof WP_Error) throw new RuntimeException($first->get_error_message());
$check($first instanceof WP_REST_Response && $first->get_status() === 201, 'Campaign creation succeeds');
$config = $first->get_data()['config'];
$background = $config['template']['tree']['steps'][0]['content']['tokens']['bg-image'];
preg_match('/url\("(.*?)"\)/', $background, $match);
$id = attachment_url_to_postid($match[1] ?? '');
$check($id > 0 && get_post_type($id) === 'attachment', 'Campaign background is visible in WordPress Media Library');
$after = $count();
$second = $create($entry);
if ($second instanceof WP_Error) throw new RuntimeException($second->get_error_message());
$check($second instanceof WP_REST_Response && $count() === $after, 'Second campaign reuses artwork without duplicate media');
$check($second->get_data()['config']['template']['tree']['steps'][0]['content']['tokens']['bg-image'] === $background, 'Reused artwork has the same URL');

// The same verified image store used by online gallery preview/install.
$uploads = wp_upload_dir();
$store = new \WConvert\Template\Catalog\VerifiedAssets($uploads['basedir'] . '/wconvert-template-images', $uploads['baseurl'] . '/wconvert-template-images');
$bytes = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=');
$asset = ['id' => 'proof', 'sha256' => hash('sha256', $bytes), 'mime' => 'image/png', 'bytes' => strlen($bytes), 'width' => 1, 'height' => 1, 'access' => 'free'];
$before = $count();
$urls = $store->install(hash('sha256', 'media-proof-free'), [$asset], static fn (): string => $bytes);
$check($count() === $before, 'Gallery image download/preview creates no Media Library items');
$media = \WConvert\Template\TemplateMedia::forSite();
$gallery = ['template' => ['tokens' => ['bg-image' => 'url("' . $urls['proof'] . '")'], 'tree' => ['steps' => [['name' => 'Offer', 'content' => ['type' => 'image', 'src' => $urls['proof'], 'narrow' => ['bg-image' => 'url("' . $urls['proof'] . '")']]]]]]];
$adopted = $media->adopt($gallery, 'Gallery proof');
if ($adopted instanceof WP_Error) throw new RuntimeException($adopted->get_error_message());
$galleryUrl = $adopted['template']['tree']['steps'][0]['content']['src'];
$galleryId = attachment_url_to_postid($galleryUrl);
$check($galleryId > 0, 'Gallery artwork becomes a Media Library image when used');
$check($adopted['template']['tokens']['bg-image'] === 'url("' . $galleryUrl . '")'
    && $adopted['template']['tree']['steps'][0]['content']['narrow']['bg-image'] === 'url("' . $galleryUrl . '")', 'Image, root background and mobile background reuse one attachment');
$premium = $asset; $premium['access'] = 'premium';
$premiumUrls = $store->install(hash('sha256', 'media-proof-premium'), [$premium], static fn (): string => $bytes);
$premiumConfig = ['template' => ['tokens' => ['bg-image' => 'url("' . $premiumUrls['proof'] . '")']]];
$before = $count();
$premiumAdopted = $media->adopt($premiumConfig, 'Premium proof');
$check(is_array($premiumAdopted) && $count() === $before && $premiumAdopted['template']['tokens']['bg-image'] === 'url("' . $galleryUrl . '")', 'Free and premium copies of the same artwork do not duplicate media');

// Saving an existing campaign is the same adoption boundary as creation.
$updateEntry = $entry;
foreach (\WConvert\Template\Transfer\DesignImages::slots($updateEntry) as $slot) {
    \WConvert\Template\Transfer\DesignImages::put($updateEntry, $slot['path'], $slot['background'] ? 'url("' . $premiumUrls['proof'] . '")' : $premiumUrls['proof']);
}
$update = new WP_REST_Request('PATCH');
$update->set_param('id', $first->get_data()['id']);
$update->set_param('template_source', $config['template_id']);
$update->set_param('config', array_replace($config, ['template' => $updateEntry]));
$saved = $controller->update($update);
if ($saved instanceof WP_Error) throw new RuntimeException($saved->get_error_message());
$check($saved instanceof WP_REST_Response && $saved->get_data()['config']['template']['tree']['steps'][0]['content']['tokens']['bg-image'] === 'url("' . $galleryUrl . '")', 'Saving a campaign adopts the selected gallery background');

// A deleted attachment is replaced on a later template use, never automatically on a page view.
wp_delete_attachment($galleryId, true);
$recreated = $media->adopt($gallery, 'Gallery proof');
$check(is_array($recreated) && attachment_url_to_postid($recreated['template']['tree']['steps'][0]['content']['src']) > 0, 'Later use recreates a deleted library copy');
if (!is_array($recreated)) throw new RuntimeException('Could not recreate artwork');
wp_delete_attachment(attachment_url_to_postid($recreated['template']['tree']['steps'][0]['content']['src']), true);
$denyUpload = static function (array $caps): array { $caps['upload_files'] = false; return $caps; };
add_filter('user_has_cap', $denyUpload);
$before = $count();
$denied = $media->adopt($gallery, 'Gallery proof');
$check($denied instanceof WP_Error && $count() === $before, 'Missing upload permission refuses new media');
remove_filter('user_has_cap', $denyUpload);

// A missing managed source must not silently save a broken design.
$invalid = $updateEntry;
foreach (\WConvert\Template\Transfer\DesignImages::slots($invalid) as $slot) {
    \WConvert\Template\Transfer\DesignImages::put($invalid, $slot['path'], 'url("' . $uploads['baseurl'] . '/wconvert-template-images/free/' . str_repeat('0', 64) . '.png")');
}
$update->set_param('config', array_replace($config, ['template' => $invalid]));
$refused = $controller->update($update);
$check($refused instanceof WP_Error, 'Missing artwork refuses the save');
$repository = $container->resolve(\WConvert\Optin\OptinRepository::class);
$check($repository->find($first->get_data()['id'])->config === $saved->get_data()['config'], 'Failed image preparation leaves the stored campaign unchanged');
$check($media->adopt($config, 'Existing campaign') === $config, 'Saving existing merchant/media URLs preserves their values');

// WordPress can reject a later file after accepting an earlier one.
$otherBytes = $bytes . 'second proof image';
$other = array_replace($asset, ['id' => 'other', 'sha256' => hash('sha256', $otherBytes), 'bytes' => strlen($otherBytes)]);
$otherUrls = $store->install(hash('sha256', 'media-proof-rollback'), [$other], static fn (): string => $otherBytes);
$twoImages = $gallery;
$twoImages['template']['tree']['steps'][0]['content']['src'] = $otherUrls['other'];
$failSecond = static function (array $file) use ($other): array {
    if (str_contains($file['name'], $other['sha256'])) $file['error'] = 'Simulated WordPress upload refusal';
    return $file;
};
add_filter('wp_handle_sideload_prefilter', $failSecond);
$before = $count();
$failed = $media->adopt($twoImages, 'Rollback proof');
remove_filter('wp_handle_sideload_prefilter', $failSecond);
$check($failed instanceof WP_Error && $count() === $before, 'A later upload failure removes only media created by that attempt');
$previousFile = get_attached_file($id);
$check(is_string($previousFile) && is_file($previousFile), 'An unrelated previously used attachment survives rollback');

$proEntry = $library->find('polaroid');
if ($proEntry !== null) {
    $proMedia = $media->adopt(['template' => $proEntry], $proEntry['name']);
    $check(is_array($proMedia) && $proMedia !== ['template' => $proEntry], 'Bundled Pro artwork uses the same Media Library path');
}

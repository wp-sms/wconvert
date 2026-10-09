<?php
namespace WConvert\Rest;

use WConvert\Template\Transfer\{DesignPackage, DesignImages, ImportSession, TransferDraft, TransferProblems};
use WConvert\Template\Catalog\{PackValidator, VerifiedAssets};
use WConvert\Template\{TemplateLibrary, TemplateVocabulary, TemplateFacets};
use WConvert\Optin\OptinRepository;
use WConvert\Privacy\PrivacyGuidance;
use WConvert\Goal\Goal;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

defined('ABSPATH') || exit;

/** Authenticated file transfer affects only an editor draft and explicitly imported media. */
final class TemplateTransferController implements RestController
{
    private const PREFIX = '/template-transfer';
    public const CLEANUP = 'wconvert_transfer_cleanup';

    public function __construct(
        private readonly PackValidator $validator,
        private readonly TemplateVocabulary $vocabulary,
        private readonly TemplateLibrary $library,
        private readonly OptinRepository $optins,
        private readonly OptinController $editor,
        private readonly PrivacyGuidance $privacy,
    ) {}

    public function registerRoutes(): void
    {
        foreach (['' => ['GET', 'status'], '/export' => ['POST', 'export'], '/imports' => ['POST', 'upload'],
            '/imports/(?P<id>[a-f0-9]{32})/prepare' => ['POST', 'prepare'], '/imports/(?P<id>[a-f0-9]{32})/apply' => ['POST', 'apply'],
            '/imports/(?P<id>[a-f0-9]{32})' => ['DELETE', 'cancel'], '/imports/(?P<id>[a-f0-9]{32})/images/(?P<asset>[a-f0-9]{32})' => ['GET', 'image']] as $suffix => [$method, $handler]) {
            register_rest_route(Routes::NAMESPACE, self::PREFIX . $suffix, ['methods' => $method,
                'permission_callback' => [Routes::class, 'canManage'], 'callback' => fn (WP_REST_Request $request) => $this->respond(fn () => $this->$handler($request))]);
        }
        add_filter('rest_pre_serve_request', [self::class, 'serveBinary'], 10, 4);
    }

    public static function hooks(): void { add_action(self::CLEANUP, [self::class, 'cleanup']); }

    public static function cleanup(string $owner): void
    {
        try { (new ImportSession(self::root(), $owner))->expire(); } catch (\RuntimeException $error) { /* Access still enforces expiry if the disk is unavailable. */ }
    }

    /**
     * @return array<string, mixed> */
    private function status(WP_REST_Request $request): array
    {
        self::root();
        return ['zip' => class_exists(\ZipArchive::class), 'max_bytes' => min(DesignPackage::MAX_ARCHIVE, wp_max_upload_size()), 'upload_images' => current_user_can('upload_files')];
    }

    private function export(WP_REST_Request $request): WP_REST_Response
    {
        $design = $request->get_param('design'); $omit = $request->get_param('omit') ?? [];
        PackValidator::check(is_array($design) && is_array($omit) && array_is_list($omit) && count($omit) <= 400 && strlen($request->get_body()) <= 1048576, __('Invalid export request.', 'wconvert'));
        foreach ($omit as $slot) PackValidator::check(is_string($slot), __('Invalid omitted image.', 'wconvert'));
        $path = tempnam(self::root(), 'export-');
        PackValidator::check($path !== false, __('Could not create a temporary export.', 'wconvert'));
        try {
            $this->package()->write($path, $design, [self::class, 'localImage'], $omit);
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file inside this site, never a URL.
            $bytes = file_get_contents($path);
            PackValidator::check(is_string($bytes), __('Could not read the exported design.', 'wconvert'));
            $name = sanitize_file_name((string) ($design['name'] ?? 'design')) ?: 'design';
            return self::binary($bytes, 'application/zip', $name . '.wconvert.zip');
        } finally { if (is_file($path)) wp_delete_file($path); }
    }

    /**
     * @return array<string, mixed> */
    private function upload(WP_REST_Request $request): array
    {
        $file = $request->get_file_params()['file'] ?? null;
        PackValidator::check(is_array($file) && ($file['error'] ?? -1) === UPLOAD_ERR_OK && is_uploaded_file($file['tmp_name'] ?? ''), __('Choose a WConvert design ZIP within your site’s upload limit.', 'wconvert'));
        PackValidator::check(filesize($file['tmp_name']) <= min(DesignPackage::MAX_ARCHIVE, wp_max_upload_size()), __('This file exceeds your site’s upload limit.', 'wconvert'));
        $document = $this->package()->read($file['tmp_name']);
        if ($document['assets'] !== []) $this->mediaPermission($document['assets']);
        $id = $this->sessions()->create($file['tmp_name']);
        // WP deduplicates identical single events within ten minutes. Replace
        // the old deadline so a newer session always has its own cleanup.
        wp_clear_scheduled_hook(self::CLEANUP, [self::owner()]);
        wp_schedule_single_event(time() + ImportSession::TTL + 60, self::CLEANUP, [self::owner()]);
        return ['id' => $id, 'name' => $document['design']['name'], 'images' => count($document['assets']), 'notes' => $document['notes']];
    }

    /**
     * @return array<string, mixed> */
    private function prepare(WP_REST_Request $request): array
    {
        PackValidator::check(strlen($request->get_body()) <= 1048576, __('This draft is too large to prepare.', 'wconvert'));
        return $this->sessions()->with((string) $request->get_param('id'), function (array &$session, string $archive) use ($request): array {
            PackValidator::check(!isset($session['result']), __('This import was already applied. Choose the file again to start another.', 'wconvert'));
            $package = $this->package(); $document = $package->read($archive);
            $optinId = (string) $request->get_param('optin'); $optin = $this->optins->find($optinId);
            PackValidator::check($optin !== null, __('This campaign is no longer available.', 'wconvert'));
            $config = $request->get_param('config'); $mode = $request->get_param('mode');
            PackValidator::check(is_array($config) && in_array($mode, ['file', 'keep'], true), __('Invalid import preparation.', 'wconvert'));
            $urls = $package->art();
            foreach ($document['assets'] as $asset) $urls[$asset['id']] = self::marker($asset['id']);
            $incoming = DesignImages::hydrate($document, $urls);
            $prepared = TransferDraft::prepare($incoming, $config, $mode === 'keep', is_string($config['template_id'] ?? null) ? $this->library->find($config['template_id']) : null, $this->vocabulary);
            $goal = Goal::tryFrom($optin->goal);
            if ($goal !== null) {
                $before = $prepared['patch']['template']['tree'];
                $prepared['patch']['template']['tree'] = $this->privacy->treeFor($before, $goal);
                if ($before !== $prepared['patch']['template']['tree']) $prepared['notes'][] = __('Privacy defaults were adjusted for this campaign’s purpose. Review the form wording.', 'wconvert');
            }
            $replacements = $request->get_param('links') ?? [];
            PackValidator::check(is_array($replacements) && count($replacements) <= 400, __('Invalid link changes.', 'wconvert'));
            foreach ($replacements as $url) PackValidator::check(is_string($url), __('Invalid link change.', 'wconvert'));
            $prepared['patch']['template'] = TransferDraft::replaceLinks($prepared['patch']['template'], $replacements);
            $prepared['notes'] = array_values(array_unique([...$document['notes'], ...$prepared['notes']]));
            foreach ($document['bindings'] as $binding) if (str_starts_with($binding['asset'], 'art-') && !isset($urls[$binding['asset']])) $prepared['notes'][] = __('A built-in illustration is unavailable here. Apply will omit it.', 'wconvert');
            TransferDraft::validate($prepared['patch'], $document['design']['name'], $this->validator);
            $refusal = $this->editor->transferRefusal(array_replace($config, $prepared['patch']), $optinId);
            // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- validation messages for an administrator, caught upstream and returned as a WP_Error that the admin renders as text; escaping here would print the entities.
            if ($refusal !== null) throw new \RuntimeException($refusal->get_error_message());
            $facets = TemplateFacets::of($prepared['patch']['template']['tree'], $this->vocabulary->fields());
            if ($goal !== null && ($facets['act'] !== $goal->outcome()->action || ($goal->outcome()->captureAnyOf !== [] && array_intersect($facets['captures'], $goal->outcome()->captureAnyOf) === []))) {
                $prepared['notes'][] = $goal->outcome()->requirement;
            }
            $links = TransferDraft::links($prepared['patch']['template']);
            $digest = hash('sha256', (string) wp_json_encode([$prepared, $config, $optinId], JSON_THROW_ON_ERROR));
            $session['prepared'] = $prepared + ['digest' => $digest, 'config' => $config, 'optin' => $optinId, 'links' => $links];
            $usedPictures = array_column(DesignImages::slots($prepared['patch']['template']), 'url');
            $usedAssets = array_values(array_filter($document['assets'], static fn (array $asset): bool => in_array(self::marker($asset['id']), $usedPictures, true)));
            return $prepared + ['digest' => $digest, 'links' => $links, 'assets' => array_map(static fn (array $asset): array => ['id' => $asset['id']], $usedAssets)];
        });
    }

    /**
     * @return array<string, mixed> */
    private function apply(WP_REST_Request $request): array
    {
        return $this->sessions()->with((string) $request->get_param('id'), function (array &$session, string $archive, callable $checkpoint) use ($request): array {
            $prepared = $session['prepared'] ?? null;
            PackValidator::check(is_array($prepared) && hash_equals($prepared['digest'], (string) $request->get_param('digest')), __('The preview changed. Review it again before applying.', 'wconvert'));
            PackValidator::check($request->get_param('reviewed') === true, __('Review the imported content and links before applying.', 'wconvert'));
            if (isset($session['result'])) return $session['result'];
            $package = $this->package(); $document = $package->read($archive); // Recheck current feature support.
            TransferDraft::validate($prepared['patch'], $document['design']['name'], $this->validator);
            $refusal = $this->editor->transferRefusal(array_replace($prepared['config'], $prepared['patch']), $prepared['optin']);
            // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- validation messages for an administrator, caught upstream and returned as a WP_Error that the admin renders as text; escaping here would print the entities.
            if ($refusal !== null) throw new \RuntimeException($refusal->get_error_message());
            $template = $prepared['patch']['template']; $slots = DesignImages::slots($template);
            $used = array_column($slots, 'url');
            $assets = array_values(array_filter($document['assets'], static fn (array $asset): bool => in_array(self::marker($asset['id']), $used, true)));
            if ($assets !== []) $this->mediaPermission($assets);
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/media.php';
            require_once ABSPATH . 'wp-admin/includes/image.php';
            $session['media'] ??= [];
            try {
                foreach ($assets as $asset) {
                    $attachment = $session['media'][$asset['id']] ?? null;
                    if (!is_int($attachment) || !get_attached_file($attachment) || !is_file(get_attached_file($attachment))) {
                        $temp = tempnam(self::root(), 'image-');
                        PackValidator::check($temp !== false, __('Could not stage an imported image.', 'wconvert'));
                        try {
                            $bytes = $package->image($archive, $asset);
                            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- a tempnam() file in the private transfer root, handed straight to media_handle_sideload(); see ImportSession for why not WP_Filesystem.
                            PackValidator::check(file_put_contents($temp, $bytes) === strlen($bytes), __('Could not stage an imported image.', 'wconvert'));
                            $extension = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'][$asset['mime']];
                            $attachment = media_handle_sideload(['name' => 'wconvert-' . $asset['id'] . '.' . $extension, 'tmp_name' => $temp], 0, sanitize_text_field($document['design']['name']));
                            if ($attachment instanceof WP_Error) throw new \RuntimeException($attachment->get_error_message());
                            $session['media'][$asset['id']] = $attachment;
                            $checkpoint();
                        } finally { if (is_file($temp)) wp_delete_file($temp); }
                    }
                    $url = wp_get_attachment_url($attachment);
                    PackValidator::check(is_string($url), __('An imported image is unavailable.', 'wconvert'));
                    foreach ($slots as $slot) if ($slot['url'] === self::marker($asset['id'])) DesignImages::put($template, $slot['path'], $slot['background'] ? 'url("' . $url . '")' : $url);
                }
                $prepared['patch']['template'] = $template;
                return $session['result'] = ['patch' => $prepared['patch']];
            } catch (\Throwable $error) {
                foreach ($session['media'] as $attachment) wp_delete_attachment($attachment, true);
                $session['media'] = []; $checkpoint();
                throw $error;
            }
        });
    }

    /**
     * @return array{cancelled: bool} */
    private function cancel(WP_REST_Request $request): array { $this->sessions()->cancel((string) $request->get_param('id')); return ['cancelled' => true]; }

    private function image(WP_REST_Request $request): WP_REST_Response
    {
        return $this->sessions()->view((string) $request->get_param('id'), function (string $archive) use ($request): WP_REST_Response {
            $package = $this->package(); $document = $package->read($archive);
            foreach ($document['assets'] as $asset) if ($asset['id'] === $request->get_param('asset')) return self::binary($package->image($archive, $asset), $asset['mime']);
            // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- validation messages for an administrator, caught upstream and returned as a WP_Error that the admin renders as text; escaping here would print the entities.
            throw new \RuntimeException(__('This preview image is unavailable.', 'wconvert'));
        });
    }

    private function package(): DesignPackage
    {
        $art = [];
        foreach ($this->library->all() as $entry) foreach (DesignImages::slots($entry) as $slot) {
            if (str_starts_with($slot['url'], 'data:image/svg+xml,')) $art[hash('sha256', $slot['url'])] = $slot['url'];
        }
        return new DesignPackage($this->validator, $art);
    }

    private function sessions(): ImportSession { return new ImportSession(self::root(), self::owner()); }
    private static function owner(): string { return get_current_blog_id() . ':' . get_current_user_id(); }

    /**
     * The private folder an import lives in between requests.
     *
     * `get_temp_dir()` honours `WP_TEMP_DIR`, and falls back to
     * `WP_CONTENT_DIR` when nothing else is writable — which is public, so it
     * is on the list of roots the folder may not sit under, and an install
     * whose only writable temp is public refuses imports rather than staging
     * one where a browser can fetch it. `uninstall.php` removes the folder.
     */
    private static function root(): string
    {
        $temp = realpath(get_temp_dir());
        PackValidator::check(is_string($temp), __('Private temporary storage is unavailable.', 'wconvert'));
        $documentRoot = isset($_SERVER['DOCUMENT_ROOT']) ? sanitize_text_field(wp_unslash($_SERVER['DOCUMENT_ROOT'])) : '';
        foreach ([ABSPATH, WP_CONTENT_DIR, $documentRoot, (string) wp_upload_dir(null, false)['basedir']] as $public) {
            if ($public === '') continue;
            $public = realpath($public);
            PackValidator::check($public === false || ($temp !== $public && !str_starts_with($temp, rtrim($public, '/') . '/')), __('Private temporary storage must be outside the public web directory.', 'wconvert'));
        }
        $root = $temp . '/' . self::folder();
        // Not wp_mkdir_p(): it copies the parent's permissions, and a shared
        // temp directory's are world-writable — so the folder would be open to
        // every account on the host until the chmod() below. Created 0700
        // instead, and chmod()ed again for a folder an older version made.
        // WP_Filesystem may be FTP, which cannot reach the temp directory.
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_mkdir -- see above.
        PackValidator::check(!is_link($root) && (is_dir($root) || mkdir($root, 0700)), __('Private temporary storage is unavailable.', 'wconvert'));
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_chmod -- see above.
        chmod($root, 0700);
        return $root;
    }

    /** The folder's name under the temp directory, unique to this install. */
    public static function folder(): string { return 'wconvert-transfer-' . substr(hash('sha256', ABSPATH . wp_salt('auth')), 0, 24); }

    /**
     * @param list<array<string, mixed>> $assets */
    private function mediaPermission(array $assets): void
    {
        PackValidator::check(current_user_can('upload_files'), __('You need permission to upload images before importing this file.', 'wconvert'));
        $allowed = array_values(get_allowed_mime_types());
        $total = 0;
        foreach ($assets as $asset) { PackValidator::check(in_array($asset['mime'], $allowed, true), __('Your site does not allow an image type included in this file.', 'wconvert')); $total += $asset['bytes']; }
        if (is_multisite()) PackValidator::check($total <= get_upload_space_available(), __('Your site does not have enough upload space.', 'wconvert'));
    }

    public static function localImage(string $url): ?string
    {
        $uploads = wp_upload_dir(null, false);
        $roots = [[$uploads['baseurl'], $uploads['basedir']], [plugins_url('', WCONVERT_DIR . '/wconvert.php'), WCONVERT_DIR]];
        foreach ($roots as [$baseUrl, $baseDir]) {
            if (!str_starts_with($url, rtrim($baseUrl, '/') . '/')) continue;
            $relative = rawurldecode(explode('?', substr($url, strlen(rtrim($baseUrl, '/')) + 1))[0]);
            $path = realpath($baseDir . '/' . $relative); $root = realpath($baseDir);
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file inside this site, never a URL.
            if ($path !== false && $root !== false && str_starts_with($path, rtrim($root, '/') . '/') && is_file($path) && is_readable($path) && filesize($path) <= VerifiedAssets::MAX_BYTES) return file_get_contents($path) ?: null;
        }
        $id = attachment_url_to_postid($url);
        if ($id) {
            $path = get_attached_file($id);
            // A CDN lookup can identify the attachment without identifying the
            // selected crop. Never substitute its full-size original silently.
            $filename = basename((string) wp_parse_url($url, PHP_URL_PATH));
            if (is_string($path) && basename($path) !== $filename) {
                $metadata = wp_get_attachment_metadata($id);
                $sizes = is_array($metadata) ? ($metadata['sizes'] ?? []) : [];
                $match = array_filter($sizes, static fn (array $size): bool => ($size['file'] ?? '') === $filename);
                $path = $match === [] ? false : dirname($path) . '/' . $filename;
            }
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file inside this site, never a URL.
            if (is_string($path) && is_file($path) && is_readable($path) && filesize($path) <= VerifiedAssets::MAX_BYTES) return file_get_contents($path) ?: null;
        }
        return null;
    }

    private static function marker(string $id): string { return 'https://wconvert.invalid/transfer/' . $id; }

    private static function binary(string $bytes, string $mime, ?string $filename = null): WP_REST_Response
    {
        $response = new WP_REST_Response($bytes);
        $response->header('Content-Type', $mime);
        $response->header('Cache-Control', 'private, no-store');
        $response->header('X-Content-Type-Options', 'nosniff');
        $response->header('X-WConvert-Binary', '1');
        if ($filename !== null) $response->header('Content-Disposition', 'attachment; filename="' . str_replace(['"', "\r", "\n"], '', $filename) . '"');
        return $response;
    }

    /**
     * @param mixed $served
     * @param mixed $result
     * @param mixed $request
     * @param mixed $server */
    public static function serveBinary($served, $result, $request, $server): bool
    {
        if ($served) return true;
        if ($result instanceof WP_REST_Response && str_starts_with($request->get_route(), '/' . Routes::NAMESPACE . self::PREFIX) && ($result->get_headers()['X-WConvert-Binary'] ?? '') === '1') {
            // Validated image or ZIP bytes, served with their own Content-Type
            // and `nosniff`, so the browser never interprets them as HTML.
            // Escaping would corrupt them; WP_REST_Server has no binary mode.
            echo $result->get_data(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- binary bytes, see above.
            return true;
        }
        return (bool) $served;
    }

    /**
     * @param callable(): mixed $run */
    private function respond(callable $run): mixed
    {
        try { return $run(); }
        catch (TransferProblems $error) { return new WP_Error('wconvert_transfer_images', $error->getMessage(), ['status' => 422, 'problems' => $error->problems]); }
        catch (\TypeError|\ValueError $error) { return new WP_Error('wconvert_transfer_invalid', __('This design file contains invalid values.', 'wconvert'), ['status' => 400]); }
        catch (\RuntimeException|\JsonException|\InvalidArgumentException $error) { return new WP_Error('wconvert_transfer_refused', $error->getMessage(), ['status' => 400]); }
    }
}

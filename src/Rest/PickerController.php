<?php

namespace WConvert\Rest;

use WConvert\Discovery\CollectionLibrary;
use WConvert\Discovery\PickerDocuments;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/** Authenticated local discovery and private planning. No network or campaign writes. */
final class PickerController implements RestController
{
    public function __construct(private readonly CollectionLibrary $collections, private readonly \WConvert\Template\TemplateLibrary $templates) {}

    public function registerRoutes(): void
    {
        register_rest_route(Routes::NAMESPACE, '/picker', ['methods' => 'GET', 'callback' => [$this, 'index'], 'permission_callback' => [Routes::class, 'canManage']]);
        foreach (['preferences', 'occasions'] as $document) {
            register_rest_route(Routes::NAMESPACE, '/picker/' . $document, [
                'methods' => 'PUT', 'callback' => fn (WP_REST_Request $request) => $this->write($request, $document),
                'permission_callback' => [Routes::class, 'canManage'],
                'args' => ['revision' => ['required' => true, 'type' => 'integer', 'minimum' => 0], 'data' => ['required' => true, 'type' => 'object']],
            ]);
        }
    }

    public function index(): WP_REST_Response
    {
        return new WP_REST_Response([
            'schema' => 1, 'today' => wp_date('Y-m-d'), 'timezone' => wp_timezone_string(),
            'server_time' => microtime(true), 'timezone_offset' => (int) wp_date('Z'),
            'collections' => $this->collections->all(),
            'preferences' => $this->readPreferences(),
            'saved_designs' => $this->savedDesigns(),
            'occasions' => get_option(PickerDocuments::OCCASIONS, ['schema' => 1, 'revision' => 0, 'items' => []]),
        ]);
    }

    /** @return array<string, mixed> */
    private function readPreferences(): array
    {
        $value = get_user_meta(get_current_user_id(), PickerDocuments::USER_KEY . get_current_blog_id(), true);
        return is_array($value) ? $value : PickerDocuments::preferences();
    }

    /** Preserve recognizable saved entries even after retirement from discovery.
     * @return list<array<string, mixed>>
     */
    private function savedDesigns(): array
    {
        $saved = array_values($this->readPreferences()['saved']); $known = [];
        foreach ($this->templates->all() as $entry) {
            $key = $entry['design_key'] ?? 'registered:' . $entry['id'];
            $known[$key] ??= ['name' => $entry['name'], 'retired' => ($entry['catalog_current'] ?? true) === false];
            if (($entry['catalog_current'] ?? true) === true) $known[$key] = ['name' => $entry['name'], 'retired' => false];
        }
        return array_map(static fn (string $key): array => ['key' => $key, 'name' => $known[$key]['name'] ?? __('Saved design', 'wconvert'), 'retired' => $known[$key]['retired'] ?? true], $saved);
    }

    public function write(WP_REST_Request $request, string $document): WP_REST_Response|WP_Error
    {
        // add_option provides an atomic, bounded write lock for the shared site
        // document and per-user document. Finally releases it even on validation failure.
        $user = get_current_user_id();
        $lock = 'wconvert_picker_lock_' . ($document === 'preferences' ? 'user_' . $user : 'occasions');
        $lease = ['at' => time(), 'token' => wp_generate_uuid4()];
        if (!add_option($lock, $lease, '', false)) {
            $previous = get_option($lock, []);
            $since = (int) ($previous['at'] ?? 0);
            // A crashed worker must not permanently block settings. Return a
            // conflict after clearing an expired lease; do not proceed unlocked.
            if ($since < time() - 60) $this->unlock($lock, $previous);
            return new WP_Error('wconvert_picker_busy', __('Another change is being saved. Retry in a moment.', 'wconvert'), ['status' => 409]);
        }
        try {
            $current = $document === 'preferences' ? $this->readPreferences() : get_option(PickerDocuments::OCCASIONS, ['schema' => 1, 'revision' => 0, 'items' => []]);
            if ($request->get_param('revision') !== $current['revision']) return new WP_Error('wconvert_picker_conflict', __('These settings changed in another window. Reload them before saving.', 'wconvert'), ['status' => 409]);
            $input = $request->get_param('data');
            if (!is_array($input)) throw new \InvalidArgumentException('Invalid document.');
            $validated = $document === 'preferences' ? PickerDocuments::validatePreferences($input) : ['items' => PickerDocuments::validateOccasions($input['items'] ?? null)];
            $next = ['schema' => 1, 'revision' => $current['revision'] + 1] + $validated;
            $saved = $document === 'preferences'
                ? update_user_meta($user, PickerDocuments::USER_KEY . get_current_blog_id(), $next)
                : update_option(PickerDocuments::OCCASIONS, $next, false);
            if ($saved === false) return new WP_Error('wconvert_picker_save_failed', __('Could not save. Your previous settings are intact.', 'wconvert'), ['status' => 500]);
            return new WP_REST_Response($next);
        } catch (\InvalidArgumentException $error) {
            return new WP_Error('wconvert_picker_invalid', $error->getMessage(), ['status' => 400]);
        } finally { $this->unlock($lock, $lease); }
    }
    /** Delete only our lease; a stalled worker cannot release a later writer.
     * @param array<string, mixed> $lease
     */
    private function unlock(string $key, array $lease): void
    {
        global $wpdb;
        $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name = %s AND option_value = %s", $key, maybe_serialize($lease)));
        wp_cache_delete($key, 'options'); wp_cache_delete('notoptions', 'options');
    }

}

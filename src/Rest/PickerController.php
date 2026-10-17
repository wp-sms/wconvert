<?php

namespace WConvert\Rest;

use WConvert\Discovery\CollectionLibrary;
use WConvert\Discovery\OccasionStore;
use WConvert\Discovery\PickerDocuments;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/** Authenticated local discovery and private planning. No network or campaign writes. */
final class PickerController implements RestController
{
    public function __construct(private readonly CollectionLibrary $collections, private readonly \WConvert\Template\TemplateLibrary $templates, private readonly OccasionStore $occasions) {}

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
            'country_suggestion' => \WConvert\Discovery\CountrySuggestion::fromTimezone(wp_timezone_string()),
            'server_time' => microtime(true), 'timezone_offset' => (int) wp_date('Z'),
            'collections' => $this->collections->all(),
            'preferences' => $this->readPreferences(),
            'saved_designs' => $this->savedDesigns(),
            'occasions' => $this->occasions->read(),
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
        $input = $request->get_param('data');
        $revision = $request->get_param('revision');
        if ($document === 'occasions') {
            $saved = $this->occasions->write(static function () use ($input): mixed {
                if (!is_array($input)) throw new \InvalidArgumentException('Invalid document.');
                return $input['items'] ?? null;
            }, is_int($revision) ? $revision : -1);
            return $saved instanceof WP_Error ? $saved : new WP_REST_Response($saved);
        }
        $user = get_current_user_id();
        $saved = OccasionStore::leased('wconvert_picker_lock_user_' . $user, function () use ($input, $revision, $user) {
            $current = $this->readPreferences();
            if ($revision !== $current['revision']) return OccasionStore::conflict();
            if (!is_array($input)) throw new \InvalidArgumentException('Invalid document.');
            $next = ['schema' => 1, 'revision' => $current['revision'] + 1] + PickerDocuments::validatePreferences($input);
            return update_user_meta($user, PickerDocuments::USER_KEY . get_current_blog_id(), $next) === false ? OccasionStore::saveFailed() : $next;
        });
        return $saved instanceof WP_Error ? $saved : new WP_REST_Response($saved);
    }

}

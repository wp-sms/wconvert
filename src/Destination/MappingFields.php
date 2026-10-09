<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/** Short-lived provider field discovery shared by setup and queued sends. */
final class MappingFields
{
    /** @param array<string, mixed> $credentials
     * @return list<array{value: string, label: string, type?: 'boolean'}>
     */
    public static function for(DestinationType $type, Destination $destination, array $credentials, bool $refresh = false): array
    {
        if (!method_exists($type, 'mappingFields')) return [];
        $key = 'wconvert_fields_v2_' . substr(hash('sha256', (string) wp_json_encode([
            $type->id(), $destination->connectionId, $credentials, $destination->settings,
        ])), 0, 40);
        $cached = !$refresh && function_exists('get_transient') ? get_transient($key) : false;
        $raw = is_array($cached) ? $cached : $type->mappingFields($credentials, $destination->settings);
        $fields = [];
        foreach ($raw as $field) {
            if (is_array($field) && is_string($field['value'] ?? null) && is_string($field['label'] ?? null)) {
                $fields[] = ['value' => $field['value'], 'label' => $field['label']]
                    + (($field['type'] ?? null) === 'boolean' ? ['type' => 'boolean'] : []);
            }
        }
        if (!is_array($cached) && function_exists('set_transient')) set_transient($key, $fields, 300);
        return $fields;
    }

    /** @param array{value: string, label: string, type?: string} $field */
    public static function accepts(array $field, mixed $value): bool
    {
        return ($field['type'] ?? 'text') === 'boolean' ? $value === true : is_string($value);
    }
}

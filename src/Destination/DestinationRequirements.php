<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/** Provider-owned prerequisites, shared by push validation and admin guidance. */
final class DestinationRequirements
{
    /**
     * @param list<string> $captureAnyOf At least one of these canonical identifiers.
     * @param array<string, array{label: string, type: string}> $settings Required saved values.
     * @param list<string> $fields Canonical values used by this adapter, not a promise to overwrite Contacts.
     * @param array<string, array{setting: string, label: string, scope: string}> $mappedFields
     */
    public function __construct(
        public readonly array $captureAnyOf = [],
        public readonly array $settings = [],
        public readonly array $fields = [],
        public readonly array $mappedFields = [],
    ) {
    }

    /** @param array<string, mixed> $values */
    public function acceptsCapture(array $values): bool
    {
        foreach ($this->captureAnyOf as $key) {
            if (self::text($values[$key] ?? null) !== '') return true;
        }
        return $this->captureAnyOf === [];
    }

    /** @param array<string, mixed> $settings
     * @return list<string>
     */
    public function missingSettings(array $settings): array
    {
        $missing = [];
        foreach ($this->settings as $key => $field) {
            if ($field['type'] === 'ids' ? self::ids($settings[$key] ?? null) === [] : self::text($settings[$key] ?? null) === '') {
                $missing[] = $key;
            }
        }
        return $missing;
    }

    /** @param mixed $value */
    public static function text($value): string
    {
        return is_string($value) ? trim($value) : '';
    }

    /** @param mixed $value
     * @return list<string>
     */
    public static function ids($value): array
    {
        return array_values(array_unique(array_filter(array_map(
            self::text(...), is_array($value) ? $value : []
        ), static fn (string $id): bool => $id !== '')));
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return ['capture_any_of' => $this->captureAnyOf, 'settings' => $this->settings,
            'fields' => $this->fields, 'mapped_fields' => $this->mappedFields];
    }
}

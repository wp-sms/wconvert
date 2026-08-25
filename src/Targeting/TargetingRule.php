<?php

namespace WConvert\Targeting;

defined('ABSPATH') || exit;

/**
 * One `{type, scalar}` entry from an Optin's include or exclude list.
 *
 * Flat, closed and never nested (ADR 0005). An entry naming a type this
 * install does not know is dropped at construction rather than carried as an
 * unknown — see {@see self::fromArray()}.
 *
 * @since 0.1.0
 */
final class TargetingRule
{
    public function __construct(
        public readonly TargetingType $type,
        public readonly string $value,
    ) {
    }

    /**
     * Build a rule from stored config, or null if it names no known type.
     *
     * @param mixed $entry
     */
    public static function fromArray($entry): ?self
    {
        if (!is_array($entry) || !isset($entry['type']) || !is_string($entry['type'])) {
            return null;
        }

        $type = TargetingType::tryFrom($entry['type']);

        if ($type === null) {
            return null;
        }

        $value = $entry['value'] ?? null;

        if (!is_scalar($value)) {
            return null;
        }

        return new self($type, (string) $value);
    }

    /**
     * @return array{type: string, value: string}
     */
    public function toArray(): array
    {
        return ['type' => $this->type->value, 'value' => $this->value];
    }
}

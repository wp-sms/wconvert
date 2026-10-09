<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/** Identity of the saved route instruction, excluding its label and secret. */
final class RouteIdentity
{
    public static function of(Destination $destination): string
    {
        $settings = self::ordered($destination->settings);
        return hash('sha256', (string) wp_json_encode([$destination->type, $destination->connectionId, $settings]));
    }

    /** @param array<string|int, mixed> $value
     * @return array<string|int, mixed>
     */
    private static function ordered(array $value): array
    {
        if (!array_is_list($value)) ksort($value);
        foreach ($value as &$entry) {
            if (is_array($entry)) $entry = self::ordered($entry);
        }
        return $value;
    }
}

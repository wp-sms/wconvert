<?php
namespace WConvert\Pro\Module\Analytics;

defined('ABSPATH') || exit;

/** One pending interaction, carried by the existing WooCommerce session. */
final class Attribution
{
    public const WINDOW = 1800;
    public const KEY = 'wconvert_attribution';
    public const META = '_wconvert_attribution';

    /** @param array<string, mixed> $value */
    public static function eligible(array $value, int $now): bool
    {
        return ($value['version'] ?? null) === 1 && is_int($value['at'] ?? null) && $value['at'] <= $now && $value['at'] + self::WINDOW > $now
            && is_string($value['arm'] ?? null) && \WConvert\Support\Ulid::isOne($value['arm'])
            && is_string($value['family'] ?? null) && \WConvert\Support\Ulid::isOne($value['family'])
            && is_string($value['receipt'] ?? null) && preg_match('/^[a-f0-9]{32}$/D', $value['receipt']) === 1;
    }

    /** A click request is short-lived and uniquely identified, not a visitor identifier. */
    public static function clickToken(string $event, int $sentAt, int $now): bool
    {
        return preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D', $event) === 1
            && abs($now - $sentAt) <= 120;
    }

    public static function consent(): bool
    {
        return function_exists('wp_has_consent') && in_array(apply_filters('wp_get_consent_type', false), ['optin', 'optout'], true)
            && wp_has_consent('statistics');
    }
}

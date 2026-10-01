<?php
namespace WConvert\Discovery;
defined('ABSPATH') || exit;

/** A setup hint about the site, never visitor geolocation or a saved market. */
final class CountrySuggestion
{
    /** @return array{code: string, timezone: string}|null */
    public static function fromTimezone(string $timezone): ?array
    {
        if (!str_contains($timezone, '/')) return null;
        try { $location = (new \DateTimeZone($timezone))->getLocation(); }
        catch (\Exception $error) { return null; }
        $code = $location === false ? '' : $location['country_code'];
        if (!preg_match('/^[A-Z]{2}$/D', $code) || in_array($code, ['XX', 'ZZ'], true)) return null;
        return ['code' => $code, 'timezone' => $timezone];
    }
}

<?php

namespace WConvert\Optin;

use WConvert\Template\TemplateTree;

defined('ABSPATH') || exit;

/** Validates the site's starting country and freezes it into phone fields at publish. */
final class PhoneCountry
{
    private const OPTION = 'wconvert_phone_default_country';

    /** @return list<array{code: string, name: string}> */
    public static function all(): array
    {
        static $countries = null;
        if ($countries === null) {
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a local file inside this site, never a URL.
            $decoded = json_decode((string) file_get_contents(WCONVERT_DIR . 'resources/phone/countries.json'), true);
            $countries = [];
            if (is_array($decoded)) {
                foreach ($decoded as $country) {
                    if (!is_array($country) || !is_string($country['code'] ?? null) || !is_string($country['name'] ?? null)) continue;
                    $countries[] = ['code' => $country['code'], 'name' => $country['name']];
                }
            }
        }
        return $countries;
    }

    public static function valid(mixed $code): bool
    {
        if (!is_string($code)) return false;
        foreach (self::all() as $country) {
            if (($country['code'] ?? null) === $code) return true;
        }
        return false;
    }

    public static function siteDefault(): string
    {
        if (!function_exists('get_option')) return '';
        $code = get_option(self::OPTION, '');
        return self::valid($code) ? $code : '';
    }

    public static function setSiteDefault(string $code): bool
    {
        if (!self::valid($code)) return false;
        update_option(self::OPTION, $code, false);
        return true;
    }

    /**
     * Null means a phone field has neither a valid override nor a site default.
     * @param array<string, mixed> $config
     * @return array<string, mixed>|null
     */
    public static function resolved(array $config, ?string $siteDefault = null): ?array
    {
        $missing = false;
        $default = $siteDefault;
        $resolved = TemplateTree::rewrittenIn($config, static function (array $node) use (&$default, &$missing): array {
            if (($node['type'] ?? null) !== 'field' || ($node['name'] ?? null) !== 'phone') return $node;
            $held = $node['phone_country'] ?? 'site';
            if ($held === 'site' && $default === null) $default = self::siteDefault();
            $country = $held === 'site' ? $default : $held;
            if (!self::valid($country)) { $missing = true; return $node; }
            $node['phone_country'] = $country;
            return $node;
        });
        return $missing ? null : $resolved;
    }
}

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

    /**
     * The country a phone field set to "site default" starts on: the one in
     * Settings, or — with none chosen — {@see suggested()}. So a fresh phone
     * setup has nothing to fix (ADR 0133), and the admin and the publish
     * check read one value.
     */
    public static function effectiveDefault(): string
    {
        $chosen = self::siteDefault();

        return $chosen !== '' ? $chosen : (self::suggested()['country'] ?? '');
    }

    /**
     * A starting country read from what WordPress already knows: the store's
     * own address when WooCommerce has one, else the region in the site's
     * language. Settings offers it beside an empty default, and until one is
     * chosen it is what a "site default" phone field starts on
     * ({@see effectiveDefault()}; ADR 0133 amends the "never saved" rule).
     *
     * Computed on read — no option of its own.
     *
     * @return array{country: string, from: 'store'|'language'}|null
     */
    public static function suggested(): ?array
    {
        $store = class_exists('WooCommerce') && function_exists('get_option') ? get_option('woocommerce_default_country', '') : null;
        return self::suggestion(is_string($store) ? $store : null, function_exists('get_locale') ? get_locale() : '');
    }

    /**
     * The pure half of {@see suggested()}. WooCommerce stores its base location
     * as `DE` or `US:CA`; a locale is `de_DE`, `de_DE_formal` or a bare `de`,
     * and only the last carries no country to suggest.
     *
     * @return array{country: string, from: 'store'|'language'}|null
     */
    public static function suggestion(?string $storeLocation, string $locale): ?array
    {
        $store = $storeLocation === null ? '' : explode(':', $storeLocation)[0];
        if (self::valid($store)) return ['country' => $store, 'from' => 'store'];
        if (preg_match('/^[a-z]{2,3}_([A-Z]{2})(?:_|$)/', $locale, $match) === 1 && self::valid($match[1])) {
            return ['country' => $match[1], 'from' => 'language'];
        }
        return null;
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
            if ($held === 'site' && $default === null) $default = self::effectiveDefault();
            $country = $held === 'site' ? $default : $held;
            if (!self::valid($country)) { $missing = true; return $node; }
            $node['phone_country'] = $country;
            return $node;
        });
        return $missing ? null : $resolved;
    }
}

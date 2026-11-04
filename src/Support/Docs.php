<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * The guides the PHP side links to, by slug (ADR 0145). The admin's twin is
 * `resources/admin/src/shell/docs.ts`; both name only articles that exist on
 * wconvert.io's `docs.ts`.
 *
 * @since 1.0.0
 */
final class Docs
{
    public const URL = 'https://wconvert.io/docs/';

    public const SUPPORT = 'https://wconvert.io/support/';

    public const PRICING = 'https://wconvert.io/pricing/';

    public const TEMPLATES = 'https://wconvert.io/templates/';

    /** The plugin that owns a link, as its `utm_campaign` (ADR 0189). */
    public const FREE = 'wconvert-free';

    public const PRO = 'wconvert-pro';

    public const POPUP_NOT_SHOWING = 'popup-not-showing';

    public const UPDATE = 'update-wconvert';

    public const WEBHOOKS = 'webhooks';

    /**
     * An address with its four tags, placed before any `#section` so the
     * browser still sends them (ADR 0189). Fixed values only: never the site,
     * the version, the user or a count.
     *
     * @param string $content The spot the link sits in, as its `utm_content`.
     * @param string $product {@see self::FREE} or {@see self::PRO}: the plugin that owns the link.
     */
    public static function tagged(string $url, string $content, string $product = self::FREE): string
    {
        $parts = explode('#', $url, 2);
        $query = 'utm_source=wp-admin&utm_medium=plugin&utm_campaign=' . $product . '&utm_content=' . $content;

        return $parts[0] . (str_contains($parts[0], '?') ? '&' : '?') . $query . (isset($parts[1]) ? '#' . $parts[1] : '');
    }

    /** A guide's address, optionally at one of its section ids, tagged with the spot it is linked from. */
    public static function url(string $guide = '', string $section = '', string $content = 'guide', string $product = self::FREE): string
    {
        return self::tagged(self::URL . ($guide !== '' ? $guide . '/' : '') . ($section !== '' ? '#' . $section : ''), $content, $product);
    }
}

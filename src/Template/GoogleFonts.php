<?php

namespace WConvert\Template;

use WConvert\Frontend\PageCache;

defined('ABSPATH') || exit;

/** A site decision, never a permission carried by an imported design. */
final class GoogleFonts
{
    public const OPTION = 'wconvert_google_fonts';

    public static function enabled(): bool
    {
        return function_exists('get_option') && in_array(get_option(self::OPTION, 0), [1, '1'], true);
    }

    public static function set(bool $enabled): void
    {
        $changed = self::enabled() !== $enabled;
        update_option(self::OPTION, $enabled ? 1 : 0, false);
        if ($changed) PageCache::purge();
    }

    /** @param list<array{label: string, stack: string}> $siteFonts
     * @return list<string>
     */
    public static function siteFamilies(array $siteFonts): array
    {
        return array_values(array_unique(array_map(static fn (array $font): string => strtolower(trim(explode(',', $font['stack'])[0], " \t\n\r\0\x0B\"'")), $siteFonts)));
    }
}

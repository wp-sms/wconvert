<?php

namespace WConvert\Assets;

defined('ABSPATH') || exit;

/**
 * A file Vite wrote into `public/`.
 *
 * Cache-busts on the file's own mtime, so a rebuilt bundle gets a new URL
 * without anyone remembering to bump a version.
 *
 * @since 0.1.0
 */
final class BuiltAsset
{
    public static function version(string $absolutePath): string
    {
        $mtime = is_file($absolutePath) ? filemtime($absolutePath) : false;

        return $mtime !== false ? (string) $mtime : WCONVERT_VERSION;
    }
}

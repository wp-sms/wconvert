<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * One JSON file on disk, decoded, or null.
 *
 * Two {@see TemplateSource}s read files and neither may throw: a library entry
 * that fails to decode is a {@see \WConvert\Support\Rejection} the library
 * records, and one bad file must not take the picker down with it.
 *
 * Deliberately NOT {@see \WConvert\Support\JsonManifest}, which is the
 * *fail-closed* reader for the two vocabulary manifests — those are files the
 * plugin cannot function without, so an unreadable one is a fatal that names
 * itself. A design is not: forty of them and one bad file is thirty-nine
 * designs.
 *
 * @since 0.1.0
 */
final class JsonFile
{
    /**
     * @return array<string, mixed>|null
     */
    public static function read(string $file): ?array
    {
        $raw = is_readable($file) ? file_get_contents($file) : false;
        $decoded = $raw === false ? null : json_decode($raw, true);

        return is_array($decoded) ? $decoded : null;
    }
}

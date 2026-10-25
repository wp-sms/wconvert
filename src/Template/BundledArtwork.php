<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * A bundled design names each photo once, as a file (ADR 0172): an image's
 * `src` is `artwork:<sha256>.webp`, a background `url("artwork:<sha256>.webp")`,
 * and the bytes live in the ZIP's own `resources/template-artwork/`. A site
 * reads them as cacheable plugin URLs ({@see self::forSite()}); a tool with no
 * site reads the bytes themselves ({@see self::inlined()}).
 * `tools/design-library/build/artwork-files.mjs` is the JavaScript twin.
 */
final class BundledArtwork
{
    public const DIRECTORY = 'resources/template-artwork/';

    private const REFERENCE = '#^artwork:([a-f0-9]{64})\.webp$#D';

    /**
     * Each photo as this site's plugin URL. A missing file throws, so a reader
     * can leave that one design out. The bytes are checked where they are used
     * — `inlined()`, and `TemplateMedia` when a campaign adopts or exports one
     * — rather than hashing every photo on every request that lists designs.
     *
     * @param array<string, mixed> $entry
     * @return array<string, mixed>
     * @throws \RuntimeException When a named file is not in this ZIP.
     */
    public static function forSite(array $entry, string $pluginDir, string $pluginUrl): array
    {
        // No plugin URL means no site: a CLI tool reading the bundled library gets the bytes.
        if ($pluginUrl === '') return self::inlined($entry, $pluginDir);
        return self::walk($entry, static function (string $name, string $file) use ($pluginUrl): string {
            if (!is_file($file)) throw self::broken($name);
            return rtrim($pluginUrl, '/') . '/' . self::DIRECTORY . $name;
        }, $pluginDir);
    }

    /**
     * Each photo as its own bytes, a data URI: what the studio, the exporter and
     * other tools outside WordPress draw from.
     *
     * @param array<string, mixed> $entry
     * @return array<string, mixed>
     * @throws \RuntimeException When a named file is missing or its bytes are not its name.
     */
    public static function inlined(array $entry, string $pluginDir): array
    {
        return self::walk($entry, static function (string $name, string $file): string {
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- a content-addressed file inside this plugin, never a URL.
            $bytes = is_file($file) ? file_get_contents($file) : false;
            if (!is_string($bytes) || hash('sha256', $bytes) !== substr($name, 0, 64)) throw self::broken($name);
            return 'data:image/webp;base64,' . base64_encode($bytes);
        }, $pluginDir);
    }

    /**
     * @param array<string, mixed> $entry
     * @param callable(string, string): string $source A file's name and path → what the design shows.
     * @return array<string, mixed>
     */
    private static function walk(array $entry, callable $source, string $pluginDir): array
    {
        $resolve = static function (string $reference) use ($source, $pluginDir): ?string {
            if (!preg_match(self::REFERENCE, $reference, $match)) return null;
            $name = $match[1] . '.webp';
            return $source($name, rtrim($pluginDir, '/') . '/' . self::DIRECTORY . $name);
        };
        $walk = static function (mixed $value) use (&$walk, $resolve): mixed {
            if (is_array($value)) return array_map($walk, $value);
            if (!is_string($value) || !str_contains($value, 'artwork:')) return $value;
            if (($picture = $resolve($value)) !== null) return $picture;
            // A background keeps its `url()`, so DesignImages still sees a picture.
            if (preg_match('#^url\\((["\']?)(artwork:[^"\')]+)\\1\\)$#D', $value, $match) && ($picture = $resolve($match[2])) !== null) {
                return 'url("' . $picture . '")';
            }
            return $value;
        };
        return $walk($entry);
    }

    private static function broken(string $name): \RuntimeException
    {
        // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- a file name for a log or a CLI, never printed to a page.
        return new \RuntimeException('Bundled artwork is missing or altered: ' . $name);
    }
}

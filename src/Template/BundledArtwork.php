<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * A bundled design names each photo once, as a file (ADR 0172): an image's
 * `src` is `artwork:<sha256>.webp`, a background `url("artwork:<sha256>.webp")`,
 * and the bytes live in the ZIP's own `resources/template-artwork/`. A site
 * reads them as cacheable plugin URLs; without a plugin URL (a CLI tool, an
 * export) they are written back as data URIs. `tools/design-library/build/
 * artwork-files.mjs` is the JavaScript twin.
 */
final class BundledArtwork
{
    public const DIRECTORY = 'resources/template-artwork/';

    private const REFERENCE = '#^artwork:([a-f0-9]{64})\.(webp|png|jpg)$#D';

    private const MIME = ['webp' => 'image/webp', 'png' => 'image/png', 'jpg' => 'image/jpeg'];

    /** @var array<string, true> Files already checked against their names in this request. */
    private static array $verified = [];

    /**
     * @param array<string, mixed> $entry
     * @return array<string, mixed>
     * @throws \RuntimeException When a named file is missing or its bytes are not its name: a broken ZIP, never a picture to guess.
     */
    public static function forSite(array $entry, string $pluginDir, string $pluginUrl): array
    {
        $resolve = static function (string $reference) use ($pluginDir, $pluginUrl): ?string {
            if (!preg_match(self::REFERENCE, $reference, $match)) return null;
            $name = $match[1] . '.' . $match[2];
            $file = rtrim($pluginDir, '/') . '/' . self::DIRECTORY . $name;
            if (!isset(self::$verified[$file])) {
                if (!is_file($file) || hash_file('sha256', $file) !== $match[1]) throw new \RuntimeException('Bundled artwork is missing or altered: ' . $name);
                self::$verified[$file] = true;
            }
            return $pluginUrl !== ''
                ? rtrim($pluginUrl, '/') . '/' . self::DIRECTORY . $name
                : 'data:' . self::MIME[$match[2]] . ';base64,' . base64_encode((string) file_get_contents($file));
        };
        $walk = static function (mixed $value) use (&$walk, $resolve): mixed {
            if (is_array($value)) return array_map($walk, $value);
            if (!is_string($value) || !str_contains($value, 'artwork:')) return $value;
            if (($source = $resolve($value)) !== null) return $source;
            // A background keeps its `url()`, so DesignImages still sees a picture.
            if (preg_match('#^url\\(["\']?(artwork:[^"\')]+)["\']?\\)$#D', $value, $match) && ($source = $resolve($match[1])) !== null) {
                return 'url("' . $source . '")';
            }
            return $value;
        };
        return $walk($entry);
    }
}

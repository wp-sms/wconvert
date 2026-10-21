<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * Keep portable source artwork, but serve shipped raster bytes as cacheable files.
 *
 * Only an exact, content-addressed file shipped with this plugin is substituted.
 * No remote fetching, file creation or changes to merchant-uploaded images occur.
 */
final class BundledArtwork
{
    /**
     * @param array<string, mixed> $entry
     * @return array<string, mixed>
     */
    public static function forSite(array $entry, string $pluginDir, string $pluginUrl): array
    {
        if ($pluginUrl === '') {
            return $entry;
        }
        $walk = static function (array $node) use (&$walk, $pluginDir, $pluginUrl): array {
            $source = $node['src'] ?? '';
            if (($node['type'] ?? '') === 'image' && is_string($source)
                && preg_match('#^data:image/(jpeg|webp);base64,([A-Za-z0-9+/=]+)$#D', $source, $match)) {
                $bytes = base64_decode($match[2], true);
                if ($bytes !== false) {
                    $relative = 'resources/template-artwork/' . hash('sha256', $bytes) . ($match[1] === 'jpeg' ? '.jpg' : '.webp');
                    $file = rtrim($pluginDir, '/') . '/' . $relative;
                    if (is_file($file) && hash_file('sha256', $file) === hash('sha256', $bytes)) {
                        $node['src'] = rtrim($pluginUrl, '/') . '/' . $relative;
                    }
                }
            }
            foreach (['children', 'start', 'end'] as $key) {
                if (isset($node[$key]) && is_array($node[$key])) {
                    $node[$key] = array_map($walk, $node[$key]);
                }
            }
            return $node;
        };
        foreach ($entry['tree']['steps'] ?? [] as $index => $step) {
            if (isset($step['content']) && is_array($step['content'])) {
                $entry['tree']['steps'][$index]['content'] = $walk($step['content']);
            }
        }
        return $entry;
    }
}

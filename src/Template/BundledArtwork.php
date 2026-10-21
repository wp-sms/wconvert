<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/** Serve exact, reviewed bundled raster bytes as cacheable files, including painted backgrounds. */
final class BundledArtwork
{
    /**
     * @param array<string, mixed> $entry
     * @return array<string, mixed>
     */
    public static function forSite(array $entry, string $pluginDir, string $pluginUrl): array
    {
        if ($pluginUrl === '') return $entry;
        $local = static function (string $source) use ($pluginDir, $pluginUrl): string {
            if (!preg_match('#^data:image/(jpeg|webp);base64,([A-Za-z0-9+/=]+)$#D', $source, $match)) return $source;
            $bytes = base64_decode($match[2], true);
            if ($bytes === false) return $source;
            $relative = 'resources/template-artwork/' . hash('sha256', $bytes) . ($match[1] === 'jpeg' ? '.jpg' : '.webp');
            $file = rtrim($pluginDir, '/') . '/' . $relative;
            return is_file($file) && hash_file('sha256', $file) === hash('sha256', $bytes)
                ? rtrim($pluginUrl, '/') . '/' . $relative : $source;
        };
        $walk = static function (array $node) use (&$walk, $local): array {
            if (($node['type'] ?? '') === 'image' && is_string($node['src'] ?? null)) $node['src'] = $local($node['src']);
            foreach (['tokens', 'narrow'] as $bag) {
                $picture = $node[$bag]['bg-image'] ?? null;
                // One authored picture only. Gradients, merchant URLs and unrecognised data stay untouched.
                if (is_string($picture) && preg_match('#^url\\(["\']?(data:image/(?:jpeg|webp);base64,[A-Za-z0-9+/=]+)["\']?\\)$#D', $picture, $match)) {
                    $source = $local($match[1]);
                    if ($source !== $match[1]) $node[$bag]['bg-image'] = 'url("' . $source . '")';
                }
            }
            foreach (['children', 'start', 'end'] as $key) {
                if (isset($node[$key]) && is_array($node[$key])) $node[$key] = array_map($walk, $node[$key]);
            }
            return $node;
        };
        $entry = $walk($entry);
        foreach ($entry['tree']['steps'] ?? [] as $index => $step) {
            if (isset($step['content']) && is_array($step['content'])) $entry['tree']['steps'][$index]['content'] = $walk($step['content']);
        }
        return $entry;
    }
}

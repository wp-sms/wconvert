<?php
namespace WConvert\Template\Transfer;

use WConvert\Template\Catalog\PackValidator;

defined('ABSPATH') || exit;

/** Image addresses stay outside the inert package tree. Paths refer to validated slots only. */
final class DesignImages
{
    /**
     * @param array<string, mixed> $design
     *
     * @return array<string, array{path: list<int|string>, url: string, background: bool}>
     */
    public static function slots(array $design): array
    {
        $found = [];
        self::walk($design, [], $found);
        return $found;
    }

    /**
     * @param array<mixed> $node
     * @param list<int|string> $path
     * @param array<string, array{path: list<int|string>, url: string, background: bool}> $found */
    private static function walk(array $node, array $path, array &$found): void
    {
        if (($node['type'] ?? '') === 'image') {
            PackValidator::check(!isset($node['src']) || is_string($node['src']), __('This design has an invalid image address.', 'wconvert'));
            $address = [...$path, 'src'];
            $found[implode('/', $address)] = ['path' => $address, 'url' => is_string($node['src'] ?? null) ? $node['src'] : '', 'background' => false];
        }
        foreach ($node as $key => $value) {
            if (in_array($key, ['tokens', 'narrow'], true) && is_array($value) && isset($value['bg-image'])) {
                $raw = $value['bg-image'];
                PackValidator::check(is_string($raw), __('This design has an invalid background image.', 'wconvert'));
                $url = $raw === 'none' || $raw === '' ? '' : $raw;
                if (preg_match('/^url\([\'"]?(.*?)[\'"]?\)$/s', $url, $match)) $url = $match[1];
                $address = [...$path, $key, 'bg-image'];
                $found[implode('/', $address)] = ['path' => $address, 'url' => $url, 'background' => true];
            } elseif (is_array($value)) self::walk($value, [...$path, $key], $found);
        }
    }

    /** @param array<string, mixed> $design
     * @param array{path: list<int|string>, url: string, background: bool} $slot
     */
    public static function label(array $design, array $slot): string
    {
        $path = $slot['path'];
        if (($path[0] ?? '') !== 'tree') return __('Design background', 'wconvert');
        $screen = $design['tree']['steps'][$path[2]]['name'] ?? __('Screen', 'wconvert');
        return sprintf($slot['background'] ? __('Background on “%s”', 'wconvert') : __('Image on “%s”', 'wconvert'), $screen);
    }

    /**
     * @param array<string, mixed> $design
     * @param list<int|string> $path */
    public static function put(array &$design, array $path, string $value): void
    {
        $at = &$design;
        foreach ($path as $key) $at = &$at[$key];
        $at = $value;
    }

    /**
     * @param array<string, mixed> $document
     * @param array<string, string> $urls
     * @return array<string, mixed> */
    public static function hydrate(array $document, array $urls): array
    {
        $design = $document['design'];
        $slots = self::slots($design);
        foreach ($document['bindings'] as $binding) {
            $slot = $slots[$binding['slot']];
            $url = $urls[$binding['asset']] ?? '';
            self::put($design, $slot['path'], $slot['background'] ? ($url === '' ? 'none' : 'url("' . $url . '")') : $url);
        }
        return $design;
    }
}

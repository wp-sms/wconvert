<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/** Closed, bounded authoring data; never accepts HTML, scripts or font URLs. */
final class DesignFeatures
{
    /** @return list<array{family: string, faces: list<array{weight: int, italic: bool}>}> */
    public static function fonts(mixed $value): array
    {
        $fonts = [];
        foreach (is_array($value) ? array_slice($value, 0, 4) : [] as $font) {
            if (!is_array($font) || !is_string($font['family'] ?? null)) continue;
            $family = trim($font['family']);
            if (!preg_match('/^[A-Za-z][A-Za-z0-9 ]{0,79}$/D', $family)) continue;
            $faces = [];
            foreach (is_array($font['faces'] ?? null) ? array_slice($font['faces'], 0, 12) : [] as $variant) {
                if (!is_array($variant) || !is_int($variant['weight'] ?? null) || $variant['weight'] < 100 || $variant['weight'] > 900) continue;
                $italic = ($variant['italic'] ?? false) === true;
                $faces[($italic ? '1:' : '0:') . $variant['weight']] = ['weight' => $variant['weight'], 'italic' => $italic];
            }
            if ($faces === []) continue;
            ksort($faces);
            $fonts[$family] = ['family' => $family, 'faces' => array_values($faces)];
        }
        return array_values($fonts);
    }

    /** @return array<string, mixed>|null */
    public static function decorations(mixed $value): ?array
    {
        if (!is_array($value) || !is_string($value['label'] ?? null) || trim($value['label']) === '') return null;
        $items = [];
        foreach (is_array($value['items'] ?? null) ? array_slice($value['items'], 0, 8) : [] as $item) {
            if (!is_array($item) || !in_array($item['kind'] ?? null, ['bat', 'eyes', 'sparkle', 'equalizer', 'rings', 'pixel', 'bubbles', 'balloon', 'barcode', 'halo'], true)) continue;
            $placement = self::placement($item);
            if ($placement === null) continue;
            $entry = ['kind' => $item['kind']] + $placement;
            if (in_array($item['motion'] ?? null, ['none', 'float', 'flap', 'blink', 'drift', 'pulse', 'levels', 'arrive'], true)) $entry['motion'] = $item['motion'];
            if (in_array($item['color'] ?? null, ['fg', 'accent', 'muted', 'accent-fg'], true)) $entry['color'] = $item['color'];
            $narrow = self::placement($item['narrow'] ?? null);
            if ($narrow !== null) $entry['narrow'] = $narrow;
            $items[] = $entry;
        }
        if ($items === []) return null;
        return ['label' => mb_substr(trim($value['label']), 0, 80), 'hidden' => ($value['hidden'] ?? false) === true, 'items' => $items];
    }

    /** @return array{x: int|float, y: int|float, size: int|float}|null */
    private static function placement(mixed $value): ?array
    {
        if (!is_array($value)) return null;
        foreach (['x', 'y', 'size'] as $key) {
            if (!isset($value[$key]) || (!is_int($value[$key]) && !is_float($value[$key])) || !is_finite((float) $value[$key])) return null;
        }
        return ['x' => max(0, min(100, $value['x'])), 'y' => max(0, min(100, $value['y'])), 'size' => max(12, min(160, $value['size']))];
    }
}

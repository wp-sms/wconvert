<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/** Merchant pictures travel between suitable slots; uncertain matches stay visible in review. */
final class PictureTransfer
{
    /**
     * Matching stays within each screen and picture kind. Ordinals are safe only
     * when both layouts have the same number of slots. A single picture can
     * change kind, but meaningful alt text must never become a decorative background.
     * Stable leaf IDs identify the original image even after sibling reordering.
     *
     * @param array<string, mixed> $mine
     * @param array<string, mixed>|null $original
     * @param array<string, mixed> $target
     * @return array{template: array<string, mixed>, unplaced: int, unverified: int}
     */
    public static function prepare(array $mine, ?array $original, array $target): array
    {
        $sources = self::slots($mine);
        $before = $original === null ? [] : self::slots($original);
        $destinations = self::slots($target);
        $unplaced = 0;
        $unverified = 0;
        foreach ($sources as $slot) {
            if ($original === null) {
                if (self::hasPicture($slot)) $unverified++;
                continue;
            }
            $old = null;
            foreach ($before as $candidate) {
                if ($slot['id'] !== null ? $candidate['id'] === $slot['id']
                    : $candidate['kind'] === $slot['kind'] && $candidate['screen'] === $slot['screen'] && $candidate['ordinal'] === $slot['ordinal']) {
                    $old = $candidate;
                    break;
                }
            }
            $changes = [];
            foreach ($slot['values'] as $key => $value) {
                if ($value !== ($old['values'][$key] ?? null)) $changes[$key] = $value;
            }
            if ($changes === [] || !self::hasPicture($slot)) continue;
            if (isset($changes['picture']) && !isset($changes['mobile-picture'])) {
                // A target's sample mobile photo must not hide the carried desktop photo.
                $changes['mobile-picture'] = null;
            }

            $group = static fn (array $other): bool => $other['kind'] === $slot['kind'] && $other['screen'] === $slot['screen'];
            $fromGroup = array_filter($sources, $group);
            $toGroup = array_filter($destinations, $group);
            $destination = null;
            if (count($fromGroup) === count($toGroup)) {
                foreach ($toGroup as $candidate) {
                    if ($candidate['ordinal'] === $slot['ordinal']) $destination = $candidate;
                }
            }
            // No guessing between several pictures or between Form and Success.
            if ($destination === null && count($sources) === 1 && count($destinations) === 1) {
                $candidate = $destinations[0];
                if (($slot['screen'] === $candidate['screen'] || min($slot['screen'], $candidate['screen']) === -1 && max($slot['screen'], $candidate['screen']) === 0)
                    && !isset($slot['values']['mobile-picture'])
                    && !($slot['kind'] === 'image' && $candidate['kind'] === 'background' && ($slot['values']['alt'] ?? '') !== '')) {
                    $destination = $candidate;
                }
            }
            if ($destination === null) {
                $unplaced++;
                continue;
            }
            if ($destination['kind'] !== $slot['kind']) {
                $changes = $destination['kind'] === 'image'
                    ? ['src' => self::address((string) ($slot['values']['picture'] ?? '')), 'alt' => '']
                    : ['picture' => 'url("' . addcslashes((string) ($slot['values']['src'] ?? ''), "\\\"") . '")'];
                // Cross-kind moves keep the destination's crop rather than guessing at geometry.
            }
            foreach ($changes as $key => $value) {
                $path = $destination['path'];
                $tail = match ($key) {
                    'picture' => ['tokens', 'bg-image'],
                    'mobile-picture' => ['narrow', 'bg-image'],
                    'position' => ['tokens', 'image-position'],
                    'mobile-position' => ['narrow', 'image-position'],
                    default => [$key],
                };
                self::write($target, [...$path, ...$tail], $value);
            }
        }
        return ['template' => $target, 'unplaced' => $unplaced, 'unverified' => $unverified];
    }

    /**
     * @param array<string, mixed> $template
     * @return list<array{path: list<int|string>, screen: int, kind: string, ordinal: int, id: mixed, values: array<string, mixed>}>
     */
    private static function slots(array $template): array
    {
        $slots = [];
        $ordinals = [];
        if (($template['tokens']['bg-image'] ?? 'none') !== 'none') self::addSlot($slots, $ordinals, $template, [], -1, 'background');
        foreach ($template['tree']['steps'] ?? [] as $index => $step) self::walk($slots, $ordinals, $step, ['tree', 'steps', $index], $index);
        return $slots;
    }

    /**
     * @param list<array{path: list<int|string>, screen: int, kind: string, ordinal: int, id: mixed, values: array<string, mixed>}> $slots
     * @param array<string, int> $ordinals
     * @param array<string, mixed> $node
     * @param list<int|string> $path
     */
    private static function walk(array &$slots, array &$ordinals, array $node, array $path, int $screen): void
    {
        if (($node['type'] ?? '') === 'image') self::addSlot($slots, $ordinals, $node, $path, $screen, 'image');
        if (in_array($node['type'] ?? '', ['panel', 'media'], true)) self::addSlot($slots, $ordinals, $node, $path, $screen, 'background');
        foreach (TemplateTree::CHILD_KEYS as $key) {
            foreach ($node[$key] ?? [] as $index => $child) self::walk($slots, $ordinals, $child, [...$path, $key, $index], $screen);
        }
    }

    /**
     * @param list<array{path: list<int|string>, screen: int, kind: string, ordinal: int, id: mixed, values: array<string, mixed>}> $slots
     * @param array<string, int> $ordinals
     * @param array<string, mixed> $node
     * @param list<int|string> $path
     */
    private static function addSlot(array &$slots, array &$ordinals, array $node, array $path, int $screen, string $kind): void
    {
        $values = $kind === 'image' ? array_intersect_key($node, ['src' => true, 'alt' => true]) : [];
        foreach (['tokens' => '', 'narrow' => 'mobile-'] as $bag => $prefix) {
            if ($kind === 'background' && isset($node[$bag]['bg-image'])) $values[$prefix . 'picture'] = $node[$bag]['bg-image'];
            if (isset($node[$bag]['image-position'])) $values[$prefix . 'position'] = $node[$bag]['image-position'];
        }
        $group = $screen . ':' . $kind;
        $ordinal = $ordinals[$group] ?? 0;
        $ordinals[$group] = $ordinal + 1;
        $slots[] = ['path' => $path, 'screen' => $screen, 'kind' => $kind, 'ordinal' => $ordinal,
            'id' => $node['id'] ?? null, 'values' => $values];
    }

    /** @param array<string, mixed> $slot */
    private static function hasPicture(array $slot): bool
    {
        return $slot['kind'] === 'image' ? ($slot['values']['src'] ?? '') !== ''
            : self::address((string) ($slot['values']['picture'] ?? '')) !== '' || self::address((string) ($slot['values']['mobile-picture'] ?? '')) !== '';
    }

    private static function address(string $value): string
    {
        return preg_match('/^url\(\s*([\'"]?)(.*?)\1\s*\)$/i', trim($value), $match) === 1 ? $match[2] : '';
    }

    /**
     * @param array<string, mixed> $template
     * @param list<int|string> $path
     */
    private static function write(array &$template, array $path, mixed $value): void
    {
        $cursor = &$template;
        $last = array_pop($path);
        foreach ($path as $key) {
            if ($value === null && !isset($cursor[$key])) return;
            $cursor = &$cursor[$key];
        }
        if ($value === null) unset($cursor[$last]);
        else $cursor[$last] = $value;
    }
}

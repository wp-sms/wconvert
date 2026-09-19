<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/** Stored configuration vocabulary only. Automatic insertion is supplied by Pro. */
final class InlinePlacement
{
    /** @return array{position: string, paragraph?: int, fallback?: string}|null */
    public static function normalize(mixed $value): ?array
    {
        if (!is_array($value)) {
            return null;
        }
        $position = $value['position'] ?? null;
        if (in_array($position, ['before_content', 'after_content'], true)) {
            return ['position' => $position];
        }
        $paragraph = $value['paragraph'] ?? null;
        if ($position !== 'after_paragraph' || !is_int($paragraph) || $paragraph < 1 || $paragraph > 100) {
            return null;
        }
        return ['position' => $position, 'paragraph' => $paragraph,
            'fallback' => ($value['fallback'] ?? null) === 'skip' ? 'skip' : 'after_content'];
    }
}

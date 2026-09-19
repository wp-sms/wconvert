<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/**
 * Where a non-modal overlay sits in the viewport.
 *
 * Placement belongs to the container, not to the Template copied into it.
 * Defaults are represented by absence so existing Optins and payloads retain
 * their current bottom-edge behaviour at zero extra cost.
 *
 * @since 0.1.0
 */
enum OverlayPlacement: string
{
    case BlockStart = 'block_start';
    case BlockEnd = 'block_end';
    case BlockStartInlineStart = 'block_start_inline_start';
    case BlockStartInlineEnd = 'block_start_inline_end';
    case BlockEndInlineStart = 'block_end_inline_start';
    case BlockEndInlineEnd = 'block_end_inline_end';

    /**
     * Return the stored non-default spelling, or null when it must be absent.
     *
     * @param mixed $value
     */
    public static function normalize(DisplayType $displayType, $value): ?string
    {
        $placement = is_string($value) ? self::tryFrom($value) : null;

        if ($displayType === DisplayType::FloatingBar) {
            return $placement === self::BlockStart ? $placement->value : null;
        }

        if ($displayType === DisplayType::SlideIn) {
            return match ($placement) {
                self::BlockStartInlineStart,
                self::BlockStartInlineEnd,
                self::BlockEndInlineStart => $placement->value,
                default => null,
            };
        }

        return null;
    }
}

<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/** Passive configuration shared by both editions; presentation belongs to Pro. */
final class Teaser
{
    /**
     * @param mixed $value
     * @return array<string, mixed>|null
     */
    public static function normalize(string $displayType, $value): ?array
    {
        if (!in_array($displayType, ['popup', 'slide_in'], true) || $value === null || $value === false) {
            return null;
        }
        $value = is_array($value) ? $value : [];
        $label = is_string($value['label'] ?? null) ? trim(strip_tags($value['label'])) : '';
        $length = preg_match_all('/./us', $label);
        if ($label === '' || $length === false || $length > 80) {
            throw new \InvalidArgumentException('Reopen button text must contain 1–80 characters.');
        }
        $result = ['label' => $label] + self::position($value);
        // Same string-valued colour tokens as the Template vocabulary. The
        // renderer assigns individual CSS properties, never authored CSS text.
        foreach (['background', 'color'] as $key) {
            if (isset($value[$key]) && is_string($value[$key]) && trim($value[$key]) !== '') {
                $result[$key] = trim($value[$key]);
            }
        }
        if (isset($value['mobile']) && is_array($value['mobile'])) {
            $mobile = self::position($value['mobile'], false);
            if (($value['mobile']['visible'] ?? true) === false) {
                $mobile = ['visible' => false] + $mobile;
            }
            if ($mobile !== []) $result['mobile'] = $mobile;
        }
        return $result;
    }

    /**
     * Compact wire tuple: text, corner, gap, background, foreground, mobile.
     * Authored configuration remains descriptive; trailing defaults cost nothing.
     * @param array<string, mixed> $value
     * @return list<mixed>
     */
    public static function forPayload(array $value): array
    {
        $mobile = isset($value['mobile']) && is_array($value['mobile']) ? $value['mobile'] : [];
        $packed = [$value['label'] ?? '', self::corner($value['placement'] ?? null), $value['gap'] ?? null,
            $value['background'] ?? null, $value['color'] ?? null,
            $mobile === [] ? null : self::trim([$mobile['visible'] ?? null, self::corner($mobile['placement'] ?? null), $mobile['gap'] ?? null])];
        return self::trim($packed);
    }

    /** @param mixed $value */
    private static function corner($value): ?int
    {
        $index = array_search($value, ['block_start_inline_start', 'block_start_inline_end', 'block_end_inline_start', 'block_end_inline_end'], true);
        return $index === false ? null : $index;
    }

    /**
     * @param list<mixed> $values
     * @return list<mixed>
     */
    private static function trim(array $values): array
    {
        while ($values !== [] && end($values) === null) array_pop($values);
        return $values;
    }

    /**
     * @param array<string, mixed> $value
     * @return array<string, mixed>
     */
    private static function position(array $value, bool $defaults = true): array
    {
        $result = [];
        $placement = OverlayPlacement::normalize(DisplayType::SlideIn, $value['placement'] ?? null);
        if ($placement !== null) $result['placement'] = $placement;
        // A mobile bottom-end override is meaningful if desktop differs.
        if (!$defaults && ($value['placement'] ?? null) === 'block_end_inline_end') $result['placement'] = 'block_end_inline_end';
        if (isset($value['gap']) && is_numeric($value['gap'])) {
            $gap = max(8, min(96, (int) $value['gap']));
            if (!$defaults || $gap !== 16) $result['gap'] = $gap;
        }
        return $result;
    }
}

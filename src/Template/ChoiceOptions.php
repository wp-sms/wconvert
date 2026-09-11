<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/** Stable answer keys and editable labels, constrained by the template manifest. */
final class ChoiceOptions
{
    /**
     * @param mixed $options
     * @param array<string, mixed> $constraints
     * @return list<array{value: string, label: string}>
     */
    public static function normalize($options, array $constraints): array
    {
        $kept = [];
        $seen = [];
        $limit = (int) ($constraints['max_items'] ?? 12);
        $length = (int) ($constraints['label_max_length'] ?? 120);
        $pattern = (string) ($constraints['value_pattern'] ?? '^[a-z][a-z0-9_-]{0,47}$');

        foreach (is_array($options) && array_is_list($options) ? $options : [] as $option) {
            if (!is_array($option) || !is_string($option['value'] ?? null) || !is_string($option['label'] ?? null)) {
                continue;
            }

            $value = $option['value'];
            $label = trim($option['label']);
            $characters = preg_match_all('/./us', $label);

            if (preg_match('~' . $pattern . '~D', $value) !== 1 || $label === '' || $characters === false || $characters > $length || isset($seen[$value])) {
                continue;
            }

            $kept[] = ['value' => $value, 'label' => $label];
            $seen[$value] = true;

            if (count($kept) >= $limit) {
                break;
            }
        }

        return $kept;
    }
}

<?php

namespace WConvert\Pro\Frontend;

defined('ABSPATH') || exit;

/**
 * Pro's loader words, translated here and printed beside free's.
 *
 * The same route as `WConvert\Frontend\PageLabels`: the visitor's page carries
 * no `wp.i18n`, so PHP translates and the loader reads `data-labels` by
 * position. Pro's positions start at 100, so free's list can grow without
 * moving them, and only a word that differs from its English is added.
 *
 * **Append; never reorder.** `pageLabel(101, 'Loading current products…')` in
 * the TypeScript is entry 101 here, and `PageLabelsTest` holds the two to each
 * other.
 *
 * @since 0.1.0
 */
final class ProPageLabels
{
    public const FIRST = 100;

    /** What each position says in English, from {@see self::FIRST}. */
    public const ENGLISH = [
        'Please answer this question.',
        'Loading current products…',
        'These products are unavailable right now. Please use the link below.',
        'Products could not load. You can still use the link below.',
        'Retry products',
        'View %s',
    ];

    public static function hooks(): void
    {
        add_filter('wconvert_page_labels', [self::class, 'add']);
    }

    /**
     * @param mixed $labels Free's position => word map.
     * @return array<int, string>
     */
    public static function add($labels): array
    {
        $labels = is_array($labels) ? $labels : [];

        foreach (self::translated() as $offset => $label) {
            if ($label !== self::ENGLISH[$offset]) {
                $labels[self::FIRST + $offset] = $label;
            }
        }

        return $labels;
    }

    /** @return list<string> In {@see self::ENGLISH}'s order. */
    public static function translated(): array
    {
        return [
            __('Please answer this question.', 'wconvert-pro'),
            __('Loading current products…', 'wconvert-pro'),
            __('These products are unavailable right now. Please use the link below.', 'wconvert-pro'),
            __('Products could not load. You can still use the link below.', 'wconvert-pro'),
            __('Retry products', 'wconvert-pro'),
            /* translators: %s: a product's name. The link opens that product's page. */
            __('View %s', 'wconvert-pro'),
        ];
    }
}

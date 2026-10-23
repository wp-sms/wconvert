<?php

namespace WConvert\Frontend;

defined('ABSPATH') || exit;

/**
 * The words the renderer and the loader write themselves, translated here.
 *
 * The visitor's page carries no `wp.i18n` (ADR 0004), so a close button's name,
 * a countdown's units and a field's fallback label cannot be translated where
 * they are drawn. PHP translates them instead — so they reach the POT like any
 * other call — and {@see PayloadTag} prints the list as `data-labels`, which
 * `resources/renderer/src/page-labels.ts` reads. The admin's previews get the
 * same list through `AdminMenu::settings()`.
 *
 * **Read by position.** `pageLabel(0, 'Close')` is entry 0 here, and
 * `PageLabelsTest` holds every `pageLabel()` call in the TypeScript to this
 * list's English, so a reordering here fails a test rather than renaming a
 * button. Append; never reorder.
 *
 * @since 0.1.0
 */
final class PageLabels
{
    /** What each position says in English — what renders wherever nothing is printed. */
    public const ENGLISH = [
        'Close',
        'Campaign',
        'Time remaining',
        'Days',
        'Hours',
        'Mins',
        'Secs',
        'Email address',
        'Phone number',
        'Name',
        'Interested in',
        'Choose an option',
        'Copy code',
        'Copied',
        'Copy failed. Select the code.',
        'Apply code',
        'Submission not confirmed. Please try again.',
    ];

    /**
     * The list in the site's language, in {@see self::ENGLISH}'s order.
     *
     * @return list<string>
     */
    public static function translated(): array
    {
        return [
            __('Close', 'wconvert'),
            /* translators: A popup's accessible name, used when its design has no heading. */
            _x('Campaign', 'accessible name of a popup with no heading', 'wconvert'),
            /* translators: The accessible name of a countdown timer. */
            __('Time remaining', 'wconvert'),
            _x('Days', 'countdown unit', 'wconvert'),
            _x('Hours', 'countdown unit', 'wconvert'),
            /* translators: Minutes, abbreviated to fit under a countdown digit. */
            _x('Mins', 'countdown unit, abbreviated', 'wconvert'),
            /* translators: Seconds, abbreviated to fit under a countdown digit. */
            _x('Secs', 'countdown unit, abbreviated', 'wconvert'),
            __('Email address', 'wconvert'),
            __('Phone number', 'wconvert'),
            _x('Name', 'a form field asking for a person\'s name', 'wconvert'),
            __('Interested in', 'wconvert'),
            __('Choose an option', 'wconvert'),
            __('Copy code', 'wconvert'),
            /* translators: Confirms a discount code was copied to the clipboard. */
            _x('Copied', 'a code was copied', 'wconvert'),
            __('Copy failed. Select the code.', 'wconvert'),
            __('Apply code', 'wconvert'),
            __('Submission not confirmed. Please try again.', 'wconvert'),
        ];
    }

    /**
     * The words that differ from English, by position — free's, and Pro's
     * from position 100 through `wconvert_page_labels`.
     *
     * Only the differing ones, so an untranslated site prints nothing at all
     * and a translated one prints only what changes.
     *
     * @return array<int, string>
     */
    public static function differing(): array
    {
        $labels = [];

        foreach (self::translated() as $index => $label) {
            if ($label !== self::ENGLISH[$index]) {
                $labels[$index] = $label;
            }
        }

        /**
         * Filters the visitor-facing words the loader reads off the page.
         *
         * Pro adds its loader's words at positions from 100, and only where
         * they differ from English.
         *
         * @param array<int, string> $labels Position => translated word.
         */
        $filtered = apply_filters('wconvert_page_labels', $labels);

        return is_array($filtered) ? array_filter($filtered, 'is_string') : $labels;
    }

    /** The `data-labels` value, or null where every word is English. */
    public static function attribute(): ?string
    {
        $labels = self::differing();

        if ($labels === []) {
            return null;
        }

        $json = wp_json_encode($labels, JSON_FORCE_OBJECT | JSON_UNESCAPED_UNICODE);

        return $json === false ? null : $json;
    }
}

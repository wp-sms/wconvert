<?php

namespace WConvert\Rules;

defined('ABSPATH') || exit;

/**
 * The rule vocabulary's WORDS.
 *
 * ============================================================================
 * THE DATA LIVES IN THE MANIFEST. THE WORDS LIVE WHERE make-pot CAN SEE THEM.
 * ============================================================================
 * That split is ADR 0013's, applied one file over. A [[Playbook]] is bundled
 * as PHP returning an array rather than as the JSON a [[Template]] ships as,
 * because "a Playbook is nothing but words and `wp i18n make-pot` cannot see a
 * JSON string, so a JSON bundled registry ships an English-only library". The
 * rule manifest is the opposite case — it is read by two runtimes and must
 * stay one file — so the words come out of it instead of the data going into
 * PHP.
 *
 * The result is one hand-written duplicate, which is what ADR 0005 allows on
 * the condition that a test asserts parity:
 * {@see \WConvert\Tests\Unit\Rules\RuleLabelParityTest} fails in both
 * directions — a manifest entry with no label, and a label for something the
 * manifest does not declare.
 *
 * **Nothing here is a second vocabulary.** A key with no label falls back to
 * the key, so a build whose manifest is ahead of its translations shows a
 * merchant `utm_medium` rather than an empty control. The parity test is what
 * keeps that fallback from becoming the normal case.
 *
 * @since 0.1.0
 */
final class RuleLabels
{
    /**
     * What each rule type is called on screen.
     *
     * @return array<string, string>
     */
    public static function types(): array
    {
        return [
            'post' => __('A specific page or post', 'wconvert'),
            'singular' => __('Any single item of a type', 'wconvert'),
            'archive' => __('An archive listing', 'wconvert'),
            'term' => __('A category or tag', 'wconvert'),
            'url' => __('A URL path', 'wconvert'),
            'logged_in' => __('Signed-in visitors', 'wconvert'),
            'page_load' => __('Shows immediately', 'wconvert'),
            'time_on_page' => __('Time on the page', 'wconvert'),
            'scroll_depth' => __('Scroll depth', 'wconvert'),
            'click_element' => __('Clicks an element', 'wconvert'),
            'device' => __('Device', 'wconvert'),
            'query_param' => __('A URL parameter', 'wconvert'),
        ];
    }

    /**
     * What each param is called, keyed `type.param`.
     *
     * Keyed by both because the same param name means different things under
     * different types — `query_param`'s `value` is what the parameter must
     * equal, and a Targeting rule's `value` is the page it names.
     *
     * @return array<string, string>
     */
    public static function params(): array
    {
        return [
            'post.value' => __('Page or post ID', 'wconvert'),
            'singular.value' => __('Content type', 'wconvert'),
            'archive.value' => __('Content type', 'wconvert'),
            'term.value' => __('Term ID', 'wconvert'),
            'url.value' => __('Path, with * as a wildcard', 'wconvert'),
            'logged_in.value' => __('Signed in', 'wconvert'),
            'time_on_page.seconds' => __('Seconds', 'wconvert'),
            'scroll_depth.percent' => __('Percent of the page', 'wconvert'),
            'click_element.selector' => __('CSS selector', 'wconvert'),
            'device.in' => __('Shows on', 'wconvert'),
            'query_param.key' => __('Parameter name', 'wconvert'),
            'query_param.value' => __('Any of these values', 'wconvert'),
        ];
    }

    /**
     * What each preset is called, keyed `type.preset`.
     *
     * These are the legible shortcuts the builder ships over a type's general
     * form (ADR 0005) — the whole reason a merchant never has to know that
     * "came from a campaign" is `query_param {key: utm_source}`.
     *
     * @return array<string, string>
     */
    public static function presets(): array
    {
        return [
            'time_on_page.after_a_moment' => __('After a few seconds', 'wconvert'),
            'time_on_page.after_a_read' => __('Once they have read a while', 'wconvert'),
            'scroll_depth.halfway_down' => __('Half way down the page', 'wconvert'),
            'scroll_depth.near_the_end' => __('Near the end of the page', 'wconvert'),
            'device.mobile_only' => __('On mobile only', 'wconvert'),
            'device.not_on_mobile' => __('Anywhere but mobile', 'wconvert'),
            'device.desktop_only' => __('On desktop only', 'wconvert'),
            'query_param.utm_source' => __('Came from a particular source', 'wconvert'),
            'query_param.utm_medium' => __('Came through a particular medium', 'wconvert'),
            'query_param.utm_campaign' => __('Came from a particular campaign', 'wconvert'),
        ];
    }

    /**
     * What each value of a closed option set is called, keyed `control.value`.
     *
     * Only controls whose options are known when the vocabulary is written are
     * here. A `post_type`'s options are a fact about the install, so they are
     * resolved and labelled by WordPress itself in {@see RuleCatalogue}.
     *
     * @return array<string, string>
     */
    public static function options(): array
    {
        return [
            'device_set.mobile' => __('Mobile', 'wconvert'),
            'device_set.tablet' => __('Tablet', 'wconvert'),
            'device_set.desktop' => __('Desktop', 'wconvert'),
        ];
    }

    /**
     * One label, or the key itself where nothing names it.
     *
     * ============================================================================
     * A MISSING LABEL FALLS BACK TO THE KEY, DELIBERATELY.
     * ============================================================================
     * A build whose manifest is ahead of its translations shows a merchant
     * `utm_medium` rather than an empty control. The parity test is what keeps
     * that fallback from becoming the normal case; without it, the fallback
     * would be the mechanism by which a missing label goes unnoticed forever.
     *
     * Params, presets and options are keyed by two parts because the same
     * short name means different things under different types —
     * `query_param`'s `value` is what the parameter must equal, and a
     * Targeting rule's `value` is the page it names.
     */
    public static function type(string $type): string
    {
        return self::types()[$type] ?? $type;
    }

    public static function param(string $type, string $param): string
    {
        return self::params()[$type . '.' . $param] ?? $param;
    }

    public static function preset(string $type, string $preset): string
    {
        return self::presets()[$type . '.' . $preset] ?? $preset;
    }

    public static function option(string $control, string $value): string
    {
        return self::options()[$control . '.' . $value] ?? $value;
    }
}

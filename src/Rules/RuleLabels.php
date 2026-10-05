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
            'singular' => __('All items of a content type', 'wconvert'),
            'archive' => __('Content archive', 'wconvert'),
            'term' => __('A category or tag', 'wconvert'),
            'url' => __('A URL path', 'wconvert'),
            'logged_in' => __('Sign-in status', 'wconvert'),
            'page_load' => __('Shows immediately', 'wconvert'),
            'inactivity' => __('Visitor inactivity', 'wconvert'),
            'time_on_page' => __('Time delay', 'wconvert'),
            'scroll_depth' => __('Scroll depth', 'wconvert'),
            'click_element' => __('Clicks a button or link', 'wconvert'),
            'exit_intent' => __('About to leave', 'wconvert'),
            'scroll_up' => __('Scrolls back up', 'wconvert'),
            // "Role" rather than "Role or membership", which is what this
            // becomes on an install with a membership adapter registered
            // ({@see \WConvert\Targeting\RoleSource}). The list a merchant
            // reads is the site's own — every role, plus whatever an adapter
            // offers — so the heading naming only what free ships would go
            // stale, and naming what free does not would over-claim today.
            'role' => __('User role', 'wconvert'),
            'device' => __('Device', 'wconvert'),
            'ad_blocking' => __('Ad-block status', 'wconvert'),
            'time_of_day' => __('Time of day', 'wconvert'),
            'query_param' => __('URL parameter / UTM tag', 'wconvert'),
            'referrer' => __('Where they came from', 'wconvert'),
            'cart_products' => __('Products in the cart', 'wconvert'),
            'cart_categories' => __('Categories in the cart', 'wconvert'),
            'cart_quantity' => __('Total item quantity', 'wconvert'),
            'cart_amount' => __('Products after discounts', 'wconvert'),
            'products_ready' => __('Has eligible product recommendations', 'wconvert'),
            'cart_has_items' => __('Has something in their cart', 'wconvert'),
            'cart_value_min' => __('Cart is worth at least', 'wconvert'),
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
            'post.value' => __('Page or post', 'wconvert'),
            'singular.value' => __('Content type', 'wconvert'),
            'archive.value' => __('Content type', 'wconvert'),
            'term.value' => __('Category or tag', 'wconvert'),
            'url.value' => __('Path, with * as a wildcard', 'wconvert'),
            'logged_in.value' => __('Signed in to this site?', 'wconvert'),
            'inactivity.seconds' => __('Seconds without activity', 'wconvert'),
            'time_on_page.seconds' => __('Seconds', 'wconvert'),
            'scroll_depth.percent' => __('Percent of the page', 'wconvert'),
            'click_element.selector' => __('CSS selector', 'wconvert'),
            'device.in' => __('Shows on', 'wconvert'),
            'ad_blocking.value' => __('Status to match', 'wconvert'),
            'query_param.key' => __('Parameter name', 'wconvert'),
            // "Hours" rather than "Window" or "Between": the merchant is
            // choosing the hours it may show in, and the hint under the
            // control is what says whose clock those hours are on. A
            // [[Schedule]]'s two boxes are labelled "Start showing it on"
            // and are a different question — a campaign's lifetime, not a
            // window that comes round again every day.
            'time_of_day.between' => __('Hours', 'wconvert'),
            // Plural and permissive, because the set is ORed: holding ANY of
            // them is enough, and nobody holds two membership levels and a
            // WordPress role at once by design.
            'role.value' => __('Any of these roles', 'wconvert'),
            'query_param.value' => __('Any of these values', 'wconvert'),
            // "Came from" rather than "Referrer": the merchant's word for it,
            // and the one the hint under the control then narrows to the page
            // immediately before this one.
            'referrer.in' => __('Came from', 'wconvert'),
            // No currency symbol and no formatting: the threshold is in the
            // store's own currency, which is exactly why a [[Playbook]] may
            // not supply one and the param is marked `authored` (ADR 0013).
            'cart_products.ids' => __('Products or variations', 'wconvert'),
            'cart_products.operator' => __('Cart contains', 'wconvert'),
            'cart_categories.ids' => __('Product categories', 'wconvert'),
            'cart_categories.operator' => __('Cart contains', 'wconvert'),
            'cart_categories.descendants' => __('Include subcategories', 'wconvert'),
            'cart_quantity.range' => __('Item quantity', 'wconvert'),
            'cart_amount.range' => __('Amount excluding tax and shipping', 'wconvert'),
            'cart_value_min.amount' => __('Cart total, in your store currency', 'wconvert'),
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
            'time_on_page.after_a_moment' => __('After 5 seconds', 'wconvert'),
            'time_on_page.after_a_read' => __('After 15 seconds', 'wconvert'),
            'scroll_depth.halfway_down' => __('Halfway down (50%)', 'wconvert'),
            'scroll_depth.near_the_end' => __('Near the end (80%)', 'wconvert'),
            'device.mobile_only' => __('On mobile only', 'wconvert'),
            'device.not_on_mobile' => __('Anywhere but mobile', 'wconvert'),
            'device.desktop_only' => __('On desktop only', 'wconvert'),
            // Starting points rather than claims about this merchant's hours,
            // which is what a preset is (ADR 0005). Both carry no phrase of
            // their own, so the summary reads the type's with the hours
            // substituted in — and the merchant sees the actual window rather
            // than a label that might not be theirs.
            'time_of_day.office_hours' => __('Daytime (09:00–17:00)', 'wconvert'),
            'time_of_day.evenings' => __('Evening (18:00–00:00)', 'wconvert'),
            'query_param.utm_source' => __('Source (utm_source)', 'wconvert'),
            'query_param.utm_medium' => __('Medium (utm_medium)', 'wconvert'),
            'query_param.utm_campaign' => __('Campaign (utm_campaign)', 'wconvert'),
            'referrer.from_search' => __('Came from a search engine', 'wconvert'),
            'referrer.from_social' => __('Came from social media', 'wconvert'),
            'referrer.arrived_directly' => __('Arrived with no referring page', 'wconvert'),
        ];
    }

    /**
     * What each rule type reads as **inside a sentence**, keyed by type.
     *
     * ========================================================================
     * A NAME AND A PHRASE ARE DIFFERENT WORDS FOR THE SAME RULE, AND BOTH ARE
     * NEEDED.
     * ========================================================================
     * {@see self::types()} names a rule where it is being CHOSEN — "Time on
     * the page", a heading over a control. This is the same rule read where a
     * summary describes an Optin — *"Fires after 5 seconds on the page"* — and
     * a name substituted into that sentence produces "Fires Time on the page".
     * Neither spelling can be derived from the other in any language, which is
     * why this is a second table rather than a transformation.
     *
     * **The two client axes only.** The When and Who sections summarise
     * themselves by reading their rules; the Where section summarises itself
     * by COUNTING them, because naming pages needs an async lookup that would
     * flicker and would go blank the day it 500s. So a Targeting type has no
     * phrase and {@see self::phrase()} falls back to its name — which is
     * honest rather than empty, and is what the parity test pins.
     *
     * **Positional placeholders, in declared param order.** `%1$s` rather than
     * `%s` throughout, including where there is only one: a translator whose
     * language puts the object first cannot reorder bare placeholders, and
     * `query_param` needs two. {@see \WConvert\Optin\Suspension::reason()}
     * already sets that house style.
     *
     * @return array<string, string>
     */
    public static function phrases(): array
    {
        return [
            'page_load' => __('as soon as the page loads', 'wconvert'),
            /* translators: %1$s: a number of seconds. */
            'inactivity' => __('after %1$s seconds without input', 'wconvert'),
            /* translators: %1$s: a number of seconds. */
            'time_on_page' => __('after %1$s seconds on the page', 'wconvert'),
            /* translators: %1$s: a percentage of the page height, without the sign. */
            'scroll_depth' => __('once they scroll %1$s%% down the page', 'wconvert'),
            /* translators: %1$s: a CSS selector, e.g. “.pricing-button”. */
            'click_element' => __('when someone clicks %1$s', 'wconvert'),
            'exit_intent' => __('when they are about to leave', 'wconvert'),
            'scroll_up' => __('when they scroll back up', 'wconvert'),
            /* translators: %1$s: one or more device names, already joined, e.g. “mobile or tablet”. */
            'device' => __('they are on %1$s', 'wconvert'),
            /* translators: %1$s: an ad-block status, already translated — "detected" or "not detected". */
            'ad_blocking' => __('ad blocking is %1$s', 'wconvert'),
            /* translators: %1$s: a range of times on a 24-hour clock, e.g. “09:00-17:00”. */
            'time_of_day' => __('the time on your site is %1$s', 'wconvert'),
            /* translators: 1: a URL parameter name, e.g. “utm_source”. 2: one or more values, already joined. */
            'query_param' => __('%1$s is %2$s', 'wconvert'),
            /* translators: %1$s: one or more traffic sources, already joined, e.g. “Search or example.com”. */
            'referrer' => __('they came from %1$s', 'wconvert'),
            /* translators: 1: product names, already joined. 2: how many must match, e.g. “any”. */
            'cart_products' => __('their cart contains %2$s of products %1$s', 'wconvert'),
            /* translators: 1: category names, already joined. 2: how many must match, e.g. “any”. 3: yes or no. */
            'cart_categories' => __('their cart contains %2$s of categories %1$s; include subcategories: %3$s', 'wconvert'),
            /* translators: %1$s: a quantity range, already formatted. */
            'cart_quantity' => __('their cart item quantity is %1$s', 'wconvert'),
            /* translators: %1$s: an amount range, already formatted. */
            'cart_amount' => __('their discounted products total is %1$s, excluding tax and shipping', 'wconvert'),
            'products_ready' => __('eligible product recommendations are available', 'wconvert'),
            'cart_has_items' => __('their cart is not empty', 'wconvert'),
            /* translators: %1$s: a cart total in the store’s own currency, unformatted. */
            'cart_value_min' => __('their cart is worth at least %1$s', 'wconvert'),
        ];
    }

    /**
     * What each preset reads as inside a sentence, keyed `type.preset`.
     *
     * **Its placeholders are the params the preset does NOT fix, in declared
     * order** — which is the whole reason a preset gets its own phrase rather
     * than borrowing its type's. A preset exists to spare the merchant the
     * general form (ADR 0005), and *"after 5 seconds on the page"* with the 5
     * substituted back in is the general form with extra steps. So
     * `after_a_moment` fixes `seconds` and reads with no placeholder at all,
     * and `utm_source` fixes `key` and reads with one — the value.
     *
     * @return array<string, string>
     */
    public static function presetPhrases(): array
    {
        return [
            'time_on_page.after_a_moment' => __('after 5 seconds on the page', 'wconvert'),
            'time_on_page.after_a_read' => __('after 15 seconds on the page', 'wconvert'),
            'scroll_depth.halfway_down' => __('after scrolling 50 percent of the page', 'wconvert'),
            'scroll_depth.near_the_end' => __('after scrolling 80 percent of the page', 'wconvert'),
            'device.mobile_only' => __('they are on mobile', 'wconvert'),
            'device.not_on_mobile' => __('they are not on mobile', 'wconvert'),
            'device.desktop_only' => __('they are on desktop', 'wconvert'),
            /* translators: %1$s: one or more campaign sources, already joined, e.g. “google or bing”. */
            'query_param.utm_source' => __('they came from %1$s', 'wconvert'),
            /* translators: %1$s: one or more campaign mediums, already joined. */
            'query_param.utm_medium' => __('they arrived through %1$s', 'wconvert'),
            /* translators: %1$s: one or more campaign names, already joined. */
            'query_param.utm_campaign' => __('they came from the %1$s campaign', 'wconvert'),
            'referrer.from_search' => __('they came from a search engine', 'wconvert'),
            'referrer.from_social' => __('they came from social media', 'wconvert'),
            'referrer.arrived_directly' => __('they arrived with no referring page', 'wconvert'),
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
            'enum.any' => __('Any selected item', 'wconvert'),
            'enum.all' => __('Every selected item', 'wconvert'),
            'enum.none' => __('None of the selected items', 'wconvert'),
            'enum.detected' => __('Detected', 'wconvert'),
            'enum.not_detected' => __('Not detected', 'wconvert'),
            // The channel names a merchant already reads in their analytics,
            // so the control and the report agree about what "Direct" means.
            'referrer_set.direct' => __('Direct', 'wconvert'),
            'referrer_set.search' => __('Search', 'wconvert'),
            'referrer_set.social' => __('Social', 'wconvert'),
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

    /**
     * One phrase, **falling back to the rule's NAME** rather than to its key.
     *
     * Different from every fallback above, and deliberately. A Targeting type
     * genuinely has no phrase — its section counts rather than reads — so this
     * fallback is the normal case there rather than a build being ahead of its
     * translations, and a summary reading *"Fires post"* would be worse than
     * one reading *"Fires A specific page or post"*.
     */
    public static function phrase(string $type): string
    {
        return self::phrases()[$type] ?? self::type($type);
    }

    /** One preset's phrase, or null where the preset has none to offer. */
    public static function presetPhrase(string $type, string $preset): ?string
    {
        return self::presetPhrases()[$type . '.' . $preset] ?? null;
    }
}

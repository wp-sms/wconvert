<?php

namespace WConvert\Pro\Frontend;

defined('ABSPATH') || exit;

/**
 * The words Pro's inspector explanations use, beside free's panel labels.
 *
 * The reopen button and the content lock explain themselves in the panel from
 * code that is handed an entry rather than the report, so they read their
 * words off the inspector's tag by group and key
 * (`resources/loader/src/inspect/labels.ts`). The keys here are the ones
 * `recovery-inspect.ts` and `content-lock/loader/inspect.ts` ask for.
 *
 * @since 0.1.0
 */
final class ProInspectorLabels
{
    public static function hooks(): void
    {
        add_filter('wconvert_inspector_labels', [self::class, 'add']);
    }

    /**
     * @param mixed $labels Free's panel labels.
     * @return array<string, mixed>
     */
    public static function add($labels): array
    {
        $labels = is_array($labels) ? $labels : [];

        $labels['recovery'] = [
            'unsupported' => __('Reopen button unavailable for this format or missing design.', 'wconvert-pro'),
            /* translators: Appended, after a space, to the sentence explaining the reopen button. */
            'session' => __('Session storage is unavailable; recovery lasts only on this page.', 'wconvert-pro'),
            'stopped' => __('Reopen button stopped for this tab session after dismissal or completion.', 'wconvert-pro'),
            'configuration' => __('Reopen button configuration is unavailable.', 'wconvert-pro'),
            'schedule' => __('Reopen button hidden: Campaign is outside its schedule.', 'wconvert-pro'),
            'conversion' => __('Reopen button stopped: this Campaign was completed.', 'wconvert-pro'),
            'site_conversion' => __('Reopen button stopped by the site-wide completion setting.', 'wconvert-pro'),
            'consent' => __('Reopen button hidden: required storage consent is withheld.', 'wconvert-pro'),
            'condition' => __('Reopen button hidden: a required condition is false or unavailable.', 'wconvert-pro'),
            'mobile' => __('Reopen button hidden by the mobile visibility setting.', 'wconvert-pro'),
            'available' => __('Reopen button available. A click skips triggers, view limits, cooldown and dismissal.', 'wconvert-pro'),
            'another' => __('Another overlay owns this page; the reopen button cannot claim its place.', 'wconvert-pro'),
            'waiting' => __('Reopen button appears only after this Campaign is shown and deliberately dismissed.', 'wconvert-pro'),
        ];

        $labels['content_lock'] = [
            'none' => __('Content lock: no supported region on this page; content remains readable.', 'wconvert-pro'),
            'locked' => __('Content lock active: the selected region will open after acknowledged form capture.', 'wconvert-pro'),
            'captured' => __('Unlocked after submission. This browser remembers this campaign’s unlock for 30 days.', 'wconvert-pro'),
            'remembered' => __('Readable: this browser remembers an unlock. No new conversion is recorded.', 'wconvert-pro'),
            'unavailable' => __('Content stays readable: the Campaign was not eligible at initial page readiness.', 'wconvert-pro'),
            'invalid' => __('Still readable: check nesting, active embeds, or this campaign’s earlier manual anchor.', 'wconvert-pro'),
            'another' => __('Content stays readable: another content lock owns this page’s single locker slot.', 'wconvert-pro'),
            'fallback' => __('Content stays readable: gate unavailable. Not counted as a conversion.', 'wconvert-pro'),
            'configured' => __('Content lock is set up. Test the live region and form here.', 'wconvert-pro'),
        ];

        return $labels;
    }
}

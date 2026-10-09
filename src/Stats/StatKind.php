<?php

namespace WConvert\Stats;

defined('ABSPATH') || exit;

/**
 * What a counted act was — **a closed set, with no filter and no
 * registry** (ADR 0019).
 *
 * The closure is the point. `wconvert_stats`' entire justification is a
 * bounded row count, and an open registry means unbounded `kind` cardinality
 * on exactly that table — one row per kind per Optin per day, for every kind
 * anybody's plugin ever invented. It would also be the fourth hand-maintained
 * cross-cutting list this project has refused (ADR 0005, ADR 0012, ADR 0015).
 *
 * An enum rather than a `VARCHAR` validated by hand, and rather than a
 * database `ENUM`: the column stays `VARCHAR(32)` so that adding a case is a
 * code change a reviewer reads instead of a migration, and `tryFrom()` is the
 * one place the set is enforced.
 *
 * @since 0.1.0
 */
enum StatKind: string
{
    /**
     * One Optin appearing to one visitor, once. The denominator of conversion
     * rate, and nothing else in the system records one — which is why it is
     * counted rather than derived (CONTEXT.md, Impression).
     */
    case Impression = 'impression';
    case ScreenShown = 'screen_shown';
    case ScreenAdvanced = 'screen_advanced';
    case ScreenSkipped = 'screen_skipped';
    case ScreenDismissed = 'screen_dismissed';

    /**
     * The visitor doing the thing the Optin exists to make them do. One Optin
     * has exactly one converting act, derived from its design (ADR 0059).
     */
    case Conversion = 'conversion';
    case CartAddition = 'cart_addition';
    case ProductShown = 'product_shown';
    case ProductClick = 'product_click';
    case Capture = 'capture';
    case ResultClick = 'result_click';

    /**
     * A **deliberate** close — the button, `Esc`, the backdrop, or the
     * browser's own light-dismiss. The four gestures are one thing, not four:
     * no merchant acts differently on "closed with Escape" than on "clicked
     * the X". Dismissal and conversion may overlap after reopening, so daily
     * counters cannot reconstruct abandonment (ADR 0101).
     */
    case Dismiss = 'dismiss';

    /**
     * A lead-magnet email push was accepted by the mail service.
     * Counts send events, not inbox arrivals or unique recipients; resends can
     * count again. Submissions minus sends is not a failure count (ADR 0085).
     * Only PHP can record this kind; browser beacons cannot assert it.
     */
    case LeadMagnetDelivered = 'lead_magnet_delivered';

    /** Generic event labels. Goal headlines add channel-specific meaning (ADR 0085). */
    public function label(): string
    {
        return match ($this) {
            self::ScreenShown => __('Screen shown', 'wconvert'),
            self::ScreenAdvanced => __('Screen completed', 'wconvert'),
            self::ScreenSkipped => __('Screen skipped', 'wconvert'),
            self::ScreenDismissed => __('Screen dismissed', 'wconvert'),
            self::Impression => __('Impressions', 'wconvert'),
            self::Conversion => __('Conversions', 'wconvert'),
            self::ProductShown => __('Product cards shown', 'wconvert'),
            self::ProductClick => __('Product links clicked', 'wconvert'),
            self::CartAddition => __('Items added to basket', 'wconvert'),
            self::Capture => __('Captured submissions', 'wconvert'),
            self::ResultClick => __('Result link clicks', 'wconvert'),
            self::Dismiss => __('Dismissals', 'wconvert'),
            self::LeadMagnetDelivered => __('Emails accepted for sending', 'wconvert'),
        };
    }

    /**
     * The kind a *browser* may assert, or null.
     *
     * The beacon endpoint is public and
     * unauthenticated by necessity — a nonce baked into a page the full-page
     * cache serves byte-identically to everyone authenticates nothing — so the
     * honest limit on it is what a browser could possibly know. It saw the
     * Optin, it converted, it closed it. It cannot have watched an email send
     * (ADR 0019, ADR 0020).
     */
    public static function fromBeacon(string $value): ?self
    {
        $kind = self::tryFrom($value);

        return in_array($kind, [self::LeadMagnetDelivered, self::Capture, self::CartAddition, self::ProductShown, self::ProductClick], true) ? null : $kind;
    }
}

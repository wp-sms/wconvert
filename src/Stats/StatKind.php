<?php

namespace WConvert\Stats;

defined('ABSPATH') || exit;

/**
 * What a counted act was — **a closed set of four, with no filter and no
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

    /**
     * The visitor doing the thing the Optin exists to make them do. One Optin
     * has exactly one converting act, fixed by its [[Goal]] (ADR 0020).
     */
    case Conversion = 'conversion';

    /**
     * A **deliberate** close — the button, `Esc`, the backdrop, or the
     * browser's own light-dismiss. The four gestures are one thing, not four:
     * no merchant acts differently on "closed with Escape" than on "clicked
     * the X". Leaving without converting is not one of them, and is already
     * `impressions − conversions − dismissals` (CONTEXT.md, Dismissal).
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
            self::Impression => __('Impressions', 'wconvert'),
            self::Conversion => __('Conversions', 'wconvert'),
            self::Dismiss => __('Dismissals', 'wconvert'),
            self::LeadMagnetDelivered => __('Emails accepted for sending', 'wconvert'),
        };
    }

    /**
     * The kind a *browser* may assert, or null.
     *
     * Three of the four, not four. The beacon endpoint is public and
     * unauthenticated by necessity — a nonce baked into a page the full-page
     * cache serves byte-identically to everyone authenticates nothing — so the
     * honest limit on it is what a browser could possibly know. It saw the
     * Optin, it converted, it closed it. It cannot have watched an email send
     * (ADR 0019, ADR 0020).
     */
    public static function fromBeacon(string $value): ?self
    {
        $kind = self::tryFrom($value);

        return $kind === self::LeadMagnetDelivered ? null : $kind;
    }
}

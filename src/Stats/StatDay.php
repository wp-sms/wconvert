<?php

namespace WConvert\Stats;

defined('ABSPATH') || exit;

/**
 * Which day a counted act belongs to — **the site's day, never UTC's**.
 *
 * The dashboard is the only consumer and it says "Today", which has to mean
 * the merchant's today. A merchant in Tokyo whose day is stamped in UTC reads
 * every morning's numbers split across two rows forever, and no amount of
 * presentation arithmetic puts them back together once the counters are
 * merged (ADR 0019).
 *
 * ============================================================================
 * THE TIMEZONE IS A BOUNDARY, NOT A STUB.
 * ============================================================================
 * `tests/bootstrap.php` stubs `current_time()` and `get_date_from_gmt()` to
 * answer as though the site were on UTC — deliberately, and consistently with
 * each other, because the lead log renders a group's `latest_at` beside a
 * Lead's `created_at` and two stubs disagreeing about what time it is would
 * show up exactly there. A seam built on those stubs therefore cannot prove
 * anything about timezones: the test would agree with the bootstrap rather
 * than with WordPress.
 *
 * So the arithmetic is {@see self::of()}, which is pure, takes the zone as an
 * argument, and is proven against real non-UTC zones with no WordPress in
 * sight. {@see self::today()} is the one line that asks WordPress what zone
 * the site is on, and it is proven where a real site's `timezone_string` can
 * be set — `bin/verify-stats.php`. Everything downstream takes a date string
 * it was handed.
 *
 * **A merchant who changes their site timezone does not retro-fix old rows.**
 * That seam is booked knowingly, and it is preferable to every merchant east
 * of London reading a split day forever (ADR 0019).
 *
 * @since 0.1.0
 */
final class StatDay
{
    /** A MySQL `DATE`. */
    public const FORMAT = 'Y-m-d';

    /**
     * The day a moment falls on, read on a given clock.
     *
     * Pure, total, and the whole of the rule: a Conversion at 23:10 UTC on the
     * 3rd is the 4th in Tokyo and the 3rd in Honolulu, and both merchants are
     * right about their own day.
     */
    public static function of(\DateTimeImmutable $moment, \DateTimeZone $siteZone): string
    {
        return $moment->setTimezone($siteZone)->format(self::FORMAT);
    }

    /**
     * Today, on the site's own clock.
     *
     * `wp_timezone()` rather than `current_time()`: it returns the zone as an
     * object, which is the thing {@see self::of()} needs, and it honours both
     * halves of WordPress's timezone setting — a named zone with its own DST
     * history, or a bare UTC offset for a site that never set one.
     */
    public static function today(): string
    {
        return self::of(new \DateTimeImmutable('now', new \DateTimeZone('UTC')), wp_timezone());
    }
}

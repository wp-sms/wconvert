<?php

namespace WConvert\Pro\License;

use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\License\LicenseManager;

defined('ABSPATH') || exit;

/**
 * Asks the store about the licence once a day, when there is a reason to.
 *
 * Nexus mints a renewal coupon as expiry approaches, a renewal or a refund
 * changes the expiry, and a seat freed from the account changes the site
 * count — none of which this site hears about unless it asks. Asking on every
 * admin page is the SDK's #39; asking never leaves the License page wrong for
 * a year. So a daily event, which calls only when one of three things is true
 * (WP Statistics' cadence):
 *
 * - **16 days or fewer remain** — the renewal window, when the offer and the
 *   date matter;
 * - **it has expired** — a renewal may have landed;
 * - **the last answer is 7 days old**, or there has never been one — the
 *   floor, which is all a licence with no end date ever gets.
 *
 * Scheduled the way free's `LeadPruner` is, and unscheduled when Pro is
 * deactivated. The licence is kept on deactivation; only deleting Pro releases
 * the seat.
 *
 * @since 0.1.0
 */
final class RefreshCron
{
    public const HOOK = 'wconvert_pro_license_refresh';

    private const RENEWAL_WINDOW = 16 * DAY_IN_SECONDS;

    private const STALE_AFTER = 7 * DAY_IN_SECONDS;

    public function __construct(private readonly LicenseManager $licence)
    {
    }

    public function hooks(): void
    {
        add_action(self::HOOK, [$this, 'run']);

        if (wp_next_scheduled(self::HOOK) === false) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'daily', self::HOOK);
        }
    }

    public static function unschedule(): void
    {
        wp_clear_scheduled_hook(self::HOOK);
    }

    public function run(): void
    {
        $stored = get_option(SdkConfig::OPTION_KEY);
        $licence = is_array($stored) && is_array($stored['license'] ?? null) ? $stored['license'] : null;

        if ($licence === null || !self::isDue($licence, time())) {
            return;
        }

        // The status first, then the sites: the SDK asks for the site list
        // only with this site's domain, which Nexus answers only for a domain
        // holding a seat — so the status check is what still lands when this
        // site has lost its own.
        $this->licence->refreshStatus();
        $this->licence->refreshSites();
    }

    /**
     * @param array<string, mixed> $licence The stored licence.
     */
    public static function isDue(array $licence, int $now): bool
    {
        if (empty($licence['license_key'])) {
            return false;
        }

        $lastSuccess = (int) ($licence['last_success_at'] ?? 0);

        if ($lastSuccess === 0 || $now - $lastSuccess >= self::STALE_AFTER) {
            return true;
        }

        $expires = strtotime((string) ($licence['expires_at'] ?? ''));

        // No end date: the staleness floor above is the whole schedule.
        if ($expires === false) {
            return false;
        }

        return $expires - $now <= self::RENEWAL_WINDOW;
    }
}

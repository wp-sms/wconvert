<?php

namespace WConvert\Pro\License;

use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\License\LicenseManager;
use WConvert\Pro\Deps\VeronaLabs\WpPremiumSdk\Store\PremiumStore;

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

    public function __construct(
        private readonly LicenseManager $license,
        private readonly PremiumStore $store,
    ) {
    }

    public function hooks(): void
    {
        add_action(self::HOOK, [$this, 'run']);

        // On `init`, as free's `LeadPruner` does: hooks() runs on
        // `plugins_loaded`, and wp_schedule_event() reads wp_get_schedules(),
        // whose `cron_schedules` filter makes WooCommerce load its
        // translations too early (#373).
        add_action('init', [$this, 'schedule']);
    }

    public function schedule(): void
    {
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
        $license = $this->store->get('license');

        if ($license === null || !self::isDue($license, time())) {
            return;
        }

        // The status first, then the sites: the SDK asks for the site list
        // only with this site's domain, which Nexus answers only for a domain
        // holding a seat — so the status check is what still lands when this
        // site has lost its own.
        $this->license->refreshStatus();
        $this->license->refreshSites();
    }

    /**
     * @param array<string, mixed> $license The stored licence.
     */
    public static function isDue(array $license, int $now): bool
    {
        if (empty($license['license_key'])) {
            return false;
        }

        $lastSuccess = (int) ($license['last_success_at'] ?? 0);

        if ($lastSuccess === 0 || $now - $lastSuccess >= self::STALE_AFTER) {
            return true;
        }

        // Refused as expired: the SDK records the status and keeps the date,
        // which may still be far off — or absent.
        if (($license['status'] ?? '') === 'expired') {
            return true;
        }

        $expires = strtotime((string) ($license['expires_at'] ?? ''));

        // No end date: the staleness floor above is the whole schedule.
        if ($expires === false) {
            return false;
        }

        return $expires - $now <= self::RENEWAL_WINDOW;
    }
}

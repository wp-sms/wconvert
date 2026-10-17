<?php
namespace WConvert\Pro\Module\CartRecovery;

use WConvert\Optin\Schedule;
use WConvert\Rest\Routes;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

/**
 * Whether a code a campaign shows stays valid after the campaign ends (#287).
 *
 * A Black Friday bar showing BF30 ends on 2 December, and BF30 runs to the end
 * of the year: anyone who copied it keeps a discount the merchant thought had
 * ended with the sale. The code block's panel says so while there is still
 * time to change the coupon.
 *
 * **Read-only, by ADR 0127's seam posture.** It looks a coupon up by its code
 * and reads one meta value, `date_expires`. It never loads the coupon object
 * and writes nothing into WooCommerce (ADR 0025), so it names none of the
 * tokens `NoWriteIntoWooCommerceTest` bans.
 */
final class CouponExpiry
{
    public const OK = 'ok';
    public const OUTLIVES = 'outlives';
    public const NO_EXPIRY = 'no_expiry';
    public const UNKNOWN = 'unknown';

    public function hooks(): void
    {
        add_action('rest_api_init', function (): void {
            register_rest_route(Routes::NAMESPACE, '/coupon-expiry', [
                'methods' => 'GET', 'permission_callback' => [Routes::class, 'canManage'],
                'callback' => [$this, 'show'],
                'args' => [
                    'code' => ['required' => true, 'type' => 'string', 'maxLength' => 100],
                    'ends_at' => ['type' => 'string', 'maxLength' => 32],
                ],
            ]);
        });
    }

    public function show(WP_REST_Request $request): WP_REST_Response
    {
        $code = trim((string) $request->get_param('code'));
        $id = $code === '' ? 0 : (int) wc_get_coupon_id_by_code($code);
        // The builder holds the end as an input's value, which may spell the gap `T`.
        $raw = $request->get_param('ends_at');
        $endsAt = is_string($raw) && trim($raw) !== '' ? str_replace('T', ' ', substr(trim($raw), 0, 16)) : null;
        $expires = null;
        if ($id > 0) {
            $stored = get_post_meta($id, 'date_expires', true);
            $expires = is_numeric($stored) && (int) $stored > 0 ? (int) $stored : null;
        }
        $zone = wp_timezone();
        $verdict = $id > 0 ? self::verdict($expires, $endsAt, $zone) : self::UNKNOWN;
        $end = $endsAt === null ? null : \DateTimeImmutable::createFromFormat('!' . Schedule::FORMAT, $endsAt, $zone);

        return new WP_REST_Response([
            'verdict' => $verdict,
            'expires' => $expires === null ? null : wp_date((string) get_option('date_format', 'F j, Y'), $expires, $zone),
            'ends' => $end === false || $end === null ? null : wp_date(get_option('date_format', 'F j, Y') . ' ' . get_option('time_format', 'H:i'), $end->getTimestamp(), $zone),
        ]);
    }

    /**
     * How a coupon's expiry sits against a campaign's end.
     *
     * WooCommerce's `date_expires` is the instant the coupon stops working.
     * The campaign's `ends_at` is a wall time in the site's timezone and is
     * exclusive (ADR 0050). A campaign with no end never stops showing the
     * code, so no expiry can outlive it.
     *
     * @return self::OK|self::OUTLIVES|self::NO_EXPIRY|self::UNKNOWN
     */
    public static function verdict(?int $expires, ?string $endsAt, \DateTimeZone $zone): string
    {
        if ($endsAt === null) return self::OK;
        $end = \DateTimeImmutable::createFromFormat('!' . Schedule::FORMAT, $endsAt, $zone);
        if ($end === false || $end->format(Schedule::FORMAT) !== $endsAt) return self::UNKNOWN;
        if ($expires === null) return self::NO_EXPIRY;
        return $expires > $end->getTimestamp() ? self::OUTLIVES : self::OK;
    }
}

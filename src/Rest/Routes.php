<?php

namespace WConvert\Rest;

defined('ABSPATH') || exit;

/**
 * Shared REST namespace and explicit permissions for each surface.
 *
 * These are here rather than on whichever controller happened to be written
 * first. A second controller reaching for `OptinController::NAMESPACE` reads
 * as though Optins own the namespace, and the day a third route wants a
 * different capability the answer should be a change to this file rather than
 * a divergence nobody notices.
 *
 * @since 0.1.0
 */
final class Routes
{
    public const NAMESPACE = 'wconvert/v1';

    /**
     * The one capability every administration surface is gated on.
     *
     * Named rather than written out at each `current_user_can()`, because the
     * eligibility inspector is gated on it OUTSIDE the REST layer — it prints
     * a report of every Optin on the site into a front-end page, and the day
     * this capability changes, that gate and the routes must change together
     * or the quietest surface is the one left open.
     */
    public const MANAGE_CAPABILITY = 'manage_options';

    /**
     * Campaign management uses one capability. Capture and beacons are public
     * by nature. The separate canPlaceCampaign permission allows post authors
     * to read only published picker choices, never Campaign management data.
     */
    public static function canManage(): bool
    {
        return current_user_can(self::MANAGE_CAPABILITY);
    }

    /** Read-only published Campaign choices for WordPress post/page authors. */
    public static function canPlaceCampaign(): bool
    {
        return current_user_can('edit_posts') || current_user_can('edit_pages');
    }

    /**
     * The capture endpoint, and it is public **by nature**.
     *
     * The visitor filling in a popup is not logged in and has no capability to
     * check. A nonce is no substitute either: the payload is baked into HTML
     * the full-page cache serves byte-identically to everyone, so a nonce in
     * it is the same nonce for every visitor for the cache's lifetime and
     * authenticates nothing (ADR 0004).
     *
     * So this returns true, deliberately and permanently, and the protection
     * lives where it can actually hold — in
     * {@see \WConvert\Rest\CaptureController} re-reading everything about the
     * form from the server's own published copy, and trusting the client for
     * nothing but the values a person typed.
     */
    public static function canCapture(): bool
    {
        return true;
    }

    /**
     * The analytics beacon, and it is public for the same reason and one more.
     *
     * The same reason: it fires from a page the full-page cache serves
     * byte-identically to every visitor, so a nonce in it is the same nonce for
     * everyone for the cache's lifetime and authenticates nothing (ADR 0004).
     *
     * The one more: **the beacon is stateless**, so there is nothing here to
     * authenticate. It carries no visitor id, no device id and no hashed
     * fingerprint, because WConvert mints none (ADR 0017) — what arrives is an
     * Optin id that is already public and one of three words.
     *
     * What that leaves is hardening rather than authentication, and it is
     * light and deliberate: the id is validated against the published set, the
     * IP is hashed into a short-lived transient as a rate limit, and prefetch,
     * prerender and bot traffic is dropped. It stops there, because what abuse
     * costs is a wrong number on one merchant's dashboard rather than data loss
     * or a breach (ADR 0019).
     */
    public static function canBeacon(): bool
    {
        return true;
    }
}
